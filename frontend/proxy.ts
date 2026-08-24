import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);

/**
 * Customer-facing routes: reachable with no `access_token` at all. Everything
 * not listed here (and not a staff auth page) is an ops route and bounces an
 * anonymous visitor to `/team`.
 *
 * `/orders` is unambiguous because **staff orders live at `/pos/orders`** — the
 * ops Order History spine entry (`lib/nav/spine.ts`) and the staff order detail
 * route both sit under `/pos`, which leaves `/orders/[id]/track` entirely to the
 * customer.
 *
 * Matched with {@link matchesPath}, not `startsWith`. This matters: a bare
 * prefix match on `/p` would make `/pos`, `/pos/orders`, `/profile` and any
 * future `/permissions` publicly reachable, and `/search` would swallow a
 * `/search-admin`. Segment-aware matching is the only correct rule here.
 */
const PUBLIC_PATHS = [
  '/login',
  '/menu',
  '/events',
  '/feedback',
  '/profile',
  '/shop',
  '/p',
  '/experiences',
  '/search',
  '/cart',
  '/checkout',
  '/account',
  '/orders',
];

/**
 * Staff-facing auth pages. `/team` is in the list because the frozen homepage
 * links to it three times and `lib/auth.ts` / `lib/api-client.ts` still send
 * logged-out users there — but SPEC §6.2 also gives `/team` to the ops Team hub.
 * Two routes cannot share a path, so the login form lives at `/sign-in` and a
 * logged-out `/team` is **rewritten** (URL preserved) onto it. See the `/team`
 * branch in {@link proxy}.
 */
const STAFF_AUTH_PAGES = [
  '/team',
  '/sign-in',
  '/forgot-password',
  '/set-password',
  '/reset-password',
];

/**
 * Segment-aware prefix match — `/team` must not swallow `/team-contribution`,
 * and `/p` must not swallow `/pos`.
 */
function matchesPath(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  // Landing page is always public
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Public pages — always accessible (the storefront, customer login, tracking)
  if (PUBLIC_PATHS.some((p) => matchesPath(pathname, p))) {
    return NextResponse.next();
  }

  // Staff auth pages (/team, /sign-in, /forgot-password, /set-password, /reset-password)
  if (STAFF_AUTH_PAGES.some((p) => matchesPath(pathname, p))) {
    let isValidStaff = false;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        // A customer token on a staff auth page is not staff — they see the form.
        isValidStaff = payload.type === 'staff';
      } catch {
        // Token invalid — treat as logged out.
      }
    }

    if (matchesPath(pathname, '/team')) {
      // Authenticated staff fall through to the ops Team hub at app/(ops)/team.
      if (isValidStaff) return NextResponse.next();
      // Everyone else gets the login form rendered *under the /team URL*, so the
      // frozen homepage's three /team links keep working unchanged. Cloning
      // `nextUrl` preserves `?redirect=` and `?message=`, which the form reads.
      const signIn = request.nextUrl.clone();
      signIn.pathname = '/sign-in';
      return NextResponse.rewrite(signIn);
    }

    // /sign-in, /forgot-password, /set-password, /reset-password keep the
    // existing behaviour: signed-in staff are bounced to the dashboard.
    if (isValidStaff) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/team', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Customer tokens should not access ops routes — redirect to public profile
    if (payload.type === 'customer') {
      return NextResponse.redirect(new URL('/account', request.url));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId as string);
    response.headers.set('x-role-code', payload.roleCode as string);
    return response;
  } catch {
    const loginUrl = new URL('/team', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|scroll-frames|logo\\.png|.*\\.mp4).*)'],
};
