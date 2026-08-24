// Swap this for whatever you already have wired from the other project —
// Resend shown here since it needs the least setup. Nothing else in the
// auth flow cares which provider sends the email.

export async function sendMagicLink(email: string, url: string) {
  if (!process.env.RESEND_API_KEY) {
    // Dev fallback: log it instead of sending, so local auth works with zero config.
    console.log(`[dev] magic link for ${email}: ${url}`);
    return;
  }

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM ?? 'login@yourdomain.com',
      to: email,
      subject: 'Your sign-in link',
      html: `<p>Click to sign in:</p><p><a href="${url}">${url}</a></p><p>Expires in 15 minutes.</p>`,
    }),
  });
}
