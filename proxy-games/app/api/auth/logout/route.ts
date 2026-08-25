import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

// POST /api/auth/logout — ends the current session and sends the player home.
// Plain form-postable on purpose so the nav logout button needs no client JS.
export async function POST(req: NextRequest) {
  await logout();
  // 303, not the NextResponse.redirect default of 307: this follows a POST,
  // and 307 would preserve the method, re-POSTing to "/" (no handler there).
  return NextResponse.redirect(new URL('/', req.url), 303);
}
