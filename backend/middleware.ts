import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const isAuthPage = request.nextUrl.pathname.startsWith('/login');
  const isDashboardPage = request.nextUrl.pathname.startsWith('/dashboard');

  if (isDashboardPage && !token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthPage && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// THIS IS THE KEY CHANGE: Added (?!api) to ignore API routes
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
    '/dashboard/:path*', 
    '/login'
  ],
};