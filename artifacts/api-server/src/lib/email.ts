import nodemailer from "nodemailer";
import { logger } from "./logger";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@educare.example.com";
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email }, "SMTP not configured — password reset email was not sent");
    return;
  }

  await transport.sendMail({
    from: `"EduCare Portal" <${from}>`,
    to: email,
    subject: "Reset your EduCare password",
    text: [
      "Hi,",
      "",
      "We received a request to reset the password for your EduCare Portal account.",
      "",
      "Click the link below to set a new password. The link expires in 1 hour.",
      "",
      resetUrl,
      "",
      "If you didn't request a password reset, you can safely ignore this email.",
      "",
      "— EduCare Portal",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
          <img src="https://via.placeholder.com/48x48.png?text=EC" alt="EduCare" style="margin-bottom: 16px;" />
          <h2 style="margin: 0 0 8px;">Reset your password</h2>
          <p style="color: #555;">We received a request to reset the password for your EduCare Portal account.</p>
          <p style="color: #555;">Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
          <a href="${resetUrl}" style="
            display: inline-block;
            margin: 16px 0;
            padding: 12px 24px;
            background: #2d6a4f;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          ">Reset password</a>
          <p style="color: #888; font-size: 13px;">Or copy this URL into your browser:<br /><a href="${resetUrl}" style="color: #2d6a4f;">${resetUrl}</a></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">If you didn't request a password reset, you can safely ignore this email.</p>
        </body>
      </html>
    `,
  });

  logger.info({ email }, "Password reset email sent");
}
