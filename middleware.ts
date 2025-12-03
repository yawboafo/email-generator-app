import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-change-this-in-production'
);

// Routes that require authentication
const protectedRoutes = [
  '/api/generate-emails',
  '/api/generate-emails-job',
  '/api/verify-emails',
  '/api/verify-emails-job',
  '/api/scrape-emails',
  '/api/scrape-emails-job',
  '/api/send-emails',
  '/api/jobs',
  '/api/ai-generate',
  '/api/find-emails',
  '/api/generate-verified-emails',
];

// Routes that should redirect to dashboard if authenticated
const authRoutes = ['/login', '/signup'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth-token')?.value;
  const { pathname } = request.nextUrl;

  // Check if route requires authentication
  const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
  const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

  // Verify token
  let isAuthenticated = false;
  if (token) {
    try {
      await jwtVerify(token, secret);
      isAuthenticated = true;
    } catch (error) {
      // Token is invalid
      isAuthenticated = false;
    }
  }

  // Redirect to login if trying to access protected route without auth
  if (isProtectedRoute && !isAuthenticated) {
    return NextResponse.json(
      { error: 'Unauthorized - Please login' },
      { status: 401 }
    );
  }

  // Redirect to dashboard if trying to access auth routes while authenticated
  if (isAuthRoute && isAuthenticated) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/api/generate-emails/:path*',
    '/api/verify-emails/:path*',
    '/api/scrape-emails/:path*',
    '/api/send-emails/:path*',
    '/api/jobs/:path*',
    '/api/ai-generate/:path*',
    '/api/find-emails/:path*',
    '/api/generate-verified-emails/:path*',
    '/login',
    '/signup',
  ],
};
