import { NextRequest, NextResponse } from "next/server";
import { requestLogin } from "@/lib/auth";
import { sendMagicLink } from "@/lib/mail";

// POST { email } -> emails a login link. Always returns 200 regardless of
// whether the email is new or known, so this endpoint can't be used to probe
// which addresses have accounts.
export async function POST(req: NextRequest) {
  let email: string;

  try {
    ({ email } = await req.json());
  } catch {
    return NextResponse.json({ error: "invalid json body" }, { status: 400 });
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "invalid email" }, { status: 400 });
  }

  const token = await requestLogin(email);
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/verify?token=${token}`;

  await sendMagicLink(email, url);

  return NextResponse.json({ ok: true });
}
