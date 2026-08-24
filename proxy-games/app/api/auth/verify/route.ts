import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// GET /api/auth/verify?token=... — the link a player clicks in their email.
// Sets the session cookie, then redirects into the app. Never expose the
// token itself in the redirect target; it's already been burned by this point.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(new URL('/?auth=missing_token', req.url));
  }

  const playerId = await verifyToken(token);
  if (!playerId) {
    return NextResponse.redirect(new URL('/?auth=expired', req.url));
  }

  return NextResponse.redirect(new URL('/?auth=welcome', req.url));
}
