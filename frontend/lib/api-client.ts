const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Every non-2xx response becomes one of these, and the **HTTP status is part of
 * the contract** — the checkout path branches on it (P5b decision 4):
 *
 * - `POST /customer/orders` → **`410 Gone`**: the quote is still in Redis but
 *   its `expires_at` passed. Re-quote in place and say the price was refreshed.
 * - `POST /customer/orders` → **`404`**: the quote is gone entirely (never
 *   issued, already spent, TTL reaped). Bounce to `/cart`.
 * - **`400`** on the quote, coupon and order routes carries a message written
 *   for the customer (`This coupon has expired`,
 *   `Add ₹150.00 more to use this coupon`, `"X" is no longer available …`).
 *   Show `error.message` verbatim; never guess at the reason.
 * - **`503`** on the checkout routes means Redis is down — a retry, not a fault
 *   the customer can fix.
 *
 * `message` is the server's `message` field when the body is JSON, falling back
 * to the status text. `body` is the parsed payload when there was one, so a
 * caller that needs a field beyond the message (a validation array, a code) can
 * reach it without a second parse.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** The parsed response body, or `undefined` when it was not JSON. */
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Narrows an unknown `catch` binding. Prefer it over a bare `instanceof` chain. */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** The HTTP status of a failure, or `null` when it was not an API failure at all. */
export function apiErrorStatus(error: unknown): number | null {
  return isApiError(error) ? error.status : null;
}

/**
 * The server's human message when there is one, otherwise `fallback`.
 *
 * The coupon and quote paths depend on this: their `400`s are written for the
 * customer, so a generic "Something went wrong" would be strictly worse than
 * what the server already said.
 */
export function apiErrorMessage(error: unknown, fallback: string): string {
  return isApiError(error) && error.message ? error.message : fallback;
}

/**
 * Nest's `ValidationPipe` answers `{ message: string[] }` for a DTO failure;
 * every hand-thrown `HttpException` answers `{ message: string }`. Flatten both
 * so a call site never renders `["x","y"]`.
 */
function readMessage(body: unknown, fallback: string): string {
  if (typeof body !== 'object' || body === null) return fallback;
  const raw = (body as { message?: unknown }).message;
  if (typeof raw === 'string' && raw) return raw;
  if (Array.isArray(raw)) {
    const joined = raw.filter((m): m is string => typeof m === 'string').join(', ');
    if (joined) return joined;
  }
  return fallback;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = response.statusText;
    let body: unknown;
    try {
      body = await response.json();
      message = readMessage(body, message);
    } catch {
      // response body is not JSON
    }
    throw new ApiError(response.status, message, body);
  }
  return response.json() as Promise<T>;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function attemptRefresh(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const options: RequestInit = {
    method,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response = await fetch(url, options);

  if (response.status === 401) {
    // Customer auth endpoints handle their own 401 — don't redirect to staff login
    const isCustomerEndpoint = path.startsWith('/customer-auth') || path.startsWith('/customer/');
    if (isCustomerEndpoint) {
      throw new ApiError(401, 'Not authenticated');
    }

    const refreshed = await attemptRefresh();
    if (refreshed) {
      response = await fetch(url, options);
    } else {
      // Import dynamically to avoid issues in non-browser environments
      if (typeof window !== 'undefined') {
        const { useAuthStore } = await import('@/lib/stores/auth-store');
        useAuthStore.getState().clearUser();
        window.location.href = '/team';
      }
      throw new ApiError(401, 'Session expired');
    }
  }

  return handleResponse<T>(response);
}

export const apiClient = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
