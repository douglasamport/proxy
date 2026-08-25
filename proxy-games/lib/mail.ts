import nodemailer from 'nodemailer';

// Gmail SMTP via nodemailer. Nothing else in the auth flow cares which
// provider sends the email — this is the only function that knows.

export async function sendMagicLink(email: string, url: string) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    // Dev fallback: log it instead of sending, so local auth works with zero config.
    console.log(`[dev] magic link for ${email}: ${url}`);
    return;
  }

  const transport = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transport.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: email,
    subject: 'Your sign-in link',
    text: `Click this link to sign in:\n\n${url}\n\nThis link expires in 15 minutes.`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2>Sign in to Proxy Games</h2>
        <p>Click the button below to sign in. This link expires in 15 minutes.</p>
        <a href="${url}" style="display:inline-block; background:#2563eb; color:white; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600;">
          Sign In
        </a>
        <p style="color:#888; font-size:12px; margin-top:24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  });
}
