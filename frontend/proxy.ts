import { jwtVerify } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const PUBLIC_PATHS = ['/login', '/forgot-password', '/set-password', '/reset-password', '/menu', '/events', '/feedback', '/profile'];
const AUTH_PAGES = ['/login', '/forgot-password', '/set-password', '/reset-password'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  // Landing page is always public
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Public pages (menu, events, feedback) — always accessible
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If logged-in user visits an auth page (login, etc.), redirect to dashboard
    if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && token) {
      try {
        await jwtVerify(token, JWT_SECRET);
        return NextResponse.redirect(new URL('/dashboard', request.url));
      } catch {
        // Token invalid — let them through to login
      }
    }
    return NextResponse.next();
  }

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Customer tokens should not access ops routes — redirect to public profile
    if (payload.type === 'customer') {
      return NextResponse.redirect(new URL('/profile', request.url));
    }

    const response = NextResponse.next();
    response.headers.set('x-user-id', payload.userId as string);
    response.headers.set('x-role-code', payload.roleCode as string);
    return response;
  } catch {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|scroll-frames|logo\\.png|.*\\.mp4).*)'],
};
