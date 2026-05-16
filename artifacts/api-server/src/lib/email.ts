/**
 * Transactional email via Resend SMTP relay.
 *
 * Required environment variables (set as Replit Secrets):
 *   SMTP_HOST = smtp.resend.com
 *   SMTP_PORT = 465
 *   SMTP_USER = resend
 *   SMTP_PASS = <Resend API key>          ← secret, never committed
 *   SMTP_FROM = onboarding@resend.dev     ← update to system@educareoshc.com.au
 *                                            after verifying the domain at resend.com/domains
 *
 * When all five vars are present the server logs:
 *   "Email: SMTP configured — transactional emails will be delivered"
 * When any are missing it logs a warning and skips sending.
 */
import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface PostNotificationEmailOptions {
  postTitle: string;
  excerpt: string | null;
  portalUrl: string;
}

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

/**
 * Log SMTP configuration status at startup. Call once from the server entry point.
 * Confirms whether the SMTP_* env vars are present so missing config is immediately visible in logs.
 */
export function logEmailConfig(): void {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const configured = !!(host && user && pass);
  logger.info(
    { smtp: { host: host ?? "(not set)", user: user ?? "(not set)", from: from ?? "(not set)", configured } },
    configured ? "Email: SMTP configured — transactional emails will be delivered" : "Email: SMTP not configured — transactional emails will be skipped",
  );
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
      "Click the link below to set a new password. The link expires in 4 hours.",
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
          <h2 style="margin: 0 0 8px;">Reset your password</h2>
          <p style="color: #555;">We received a request to reset the password for your EduCare Portal account.</p>
          <p style="color: #555;">Click the button below to set a new password. This link expires in <strong>4 hours</strong>.</p>
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

export interface LoginInstructionsEmailOptions {
  recipientName: string;
  loginEmail: string;
  loginUrl: string;
  setPasswordUrl: string;
  isAlreadyConnected: boolean;
  accountType: "staff" | "guardian";
}

export async function sendLoginInstructionsEmail(
  email: string,
  opts: LoginInstructionsEmailOptions,
): Promise<void> {
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@educare.example.com";
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email }, "SMTP not configured — login instructions email was not sent");
    return;
  }

  const portalLabel = opts.accountType === "guardian" ? "Family Portal" : "EduCare Portal";
  const actionLabel = opts.isAlreadyConnected ? "Reset your password" : "Set your password";
  const actionDesc = opts.isAlreadyConnected
    ? "Your account already has a password. Use the link below to set a new one."
    : "Your account has been set up. Click the link below to choose a password and get started.";

  const subject = opts.isAlreadyConnected
    ? `Your ${portalLabel} login details`
    : `You've been invited to ${portalLabel}`;

  await transport.sendMail({
    from: `"EduCare Portal" <${from}>`,
    to: email,
    subject,
    text: [
      `Hi ${opts.recipientName},`,
      "",
      actionDesc,
      "",
      `Login email: ${opts.loginEmail}`,
      "",
      `${actionLabel}: ${opts.setPasswordUrl}`,
      "",
      `Once you have set a password you can log in at: ${opts.loginUrl}`,
      "",
      "This link expires in 4 hours.",
      "",
      "— EduCare Portal",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 8px;">${subject}</h2>
          <p style="color: #555;">Hi ${opts.recipientName.replace(/</g, "&lt;").replace(/>/g, "&gt;")},</p>
          <p style="color: #555;">${actionDesc}</p>
          <table style="background: #f8f9fa; border-radius: 8px; padding: 16px; margin: 16px 0; width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 8px; color: #888; font-size: 13px; white-space: nowrap;">Login email</td>
              <td style="padding: 4px 8px; font-weight: 600; font-size: 13px;">${opts.loginEmail.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
            </tr>
            <tr>
              <td style="padding: 4px 8px; color: #888; font-size: 13px; white-space: nowrap;">Login page</td>
              <td style="padding: 4px 8px; font-size: 13px;"><a href="${opts.loginUrl}" style="color: #2d6a4f;">${opts.loginUrl}</a></td>
            </tr>
          </table>
          <a href="${opts.setPasswordUrl}" style="
            display: inline-block;
            margin: 8px 0 16px;
            padding: 12px 24px;
            background: #2d6a4f;
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          ">${actionLabel}</a>
          <p style="color: #888; font-size: 13px;">This link expires in <strong>4 hours</strong>. If you didn't expect this email, you can safely ignore it.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #aaa; font-size: 12px;">EduCare Portal — sent by your centre administrator.</p>
        </body>
      </html>
    `,
  });

  logger.info({ email, accountType: opts.accountType }, "Login instructions email sent");
}

export interface ContactEnquiryEmailOptions {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceName: string;
  message?: string;
}

export async function sendContactEnquiryEmail(opts: ContactEnquiryEmailOptions): Promise<void> {
  const to = "system@educareoshc.com.au";
  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@educare.example.com";
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email: opts.email }, "SMTP not configured — contact enquiry email was not sent");
    return;
  }

  const fullName = `${opts.firstName} ${opts.lastName}`;
  const messageBlock = opts.message
    ? `Message:\n${opts.message}`
    : "No message provided.";

  await transport.sendMail({
    from: `"EduCare Website" <${from}>`,
    to,
    replyTo: opts.email,
    subject: `New enquiry from ${fullName} — ${opts.serviceName}`,
    text: [
      `New contact enquiry received via the EduCare website.`,
      "",
      `Name:         ${fullName}`,
      `Email:        ${opts.email}`,
      `Phone:        ${opts.phone}`,
      `Service:      ${opts.serviceName}`,
      "",
      messageBlock,
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="margin: 0 0 4px; color: #1b5e20;">New website enquiry</h2>
          <p style="color: #555; margin: 0 0 20px;">Submitted via the EduCare public website.</p>
          <table style="width:100%; border-collapse:collapse; background:#f8f9fa; border-radius:8px; padding:4px;">
            <tr>
              <td style="padding:8px 12px; color:#888; font-size:13px; white-space:nowrap; vertical-align:top;">Name</td>
              <td style="padding:8px 12px; font-weight:600; font-size:13px;">${fullName.replace(/</g, "&lt;")}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px; color:#888; font-size:13px; white-space:nowrap; vertical-align:top;">Email</td>
              <td style="padding:8px 12px; font-size:13px;"><a href="mailto:${opts.email.replace(/</g, "&lt;")}" style="color:#1b5e20;">${opts.email.replace(/</g, "&lt;")}</a></td>
            </tr>
            <tr>
              <td style="padding:8px 12px; color:#888; font-size:13px; white-space:nowrap; vertical-align:top;">Phone</td>
              <td style="padding:8px 12px; font-size:13px;">${opts.phone.replace(/</g, "&lt;")}</td>
            </tr>
            <tr>
              <td style="padding:8px 12px; color:#888; font-size:13px; white-space:nowrap; vertical-align:top;">Service</td>
              <td style="padding:8px 12px; font-size:13px;">${opts.serviceName.replace(/</g, "&lt;")}</td>
            </tr>
            ${opts.message ? `
            <tr>
              <td style="padding:8px 12px; color:#888; font-size:13px; white-space:nowrap; vertical-align:top;">Message</td>
              <td style="padding:8px 12px; font-size:13px; white-space:pre-wrap;">${opts.message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>
            </tr>` : ""}
          </table>
          <p style="color:#aaa; font-size:12px; margin-top:24px;">Reply directly to this email to respond to ${fullName.replace(/</g, "&lt;")}.</p>
        </body>
      </html>
    `,
  });

  logger.info({ service: opts.serviceName, email: opts.email }, "Contact enquiry email sent");
}

export async function sendPostNotificationEmail(
  recipients: string[],
  opts: PostNotificationEmailOptions,
): Promise<void> {
  if (recipients.length === 0) return;

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@educare.example.com";
  const transport = createTransport();

  if (!transport) {
    logger.warn({ count: recipients.length }, "SMTP not configured — post notification emails were not sent");
    return;
  }

  const excerptHtml = opts.excerpt
    ? `<p style="color:#555; margin: 0 0 16px;">${opts.excerpt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";
  const excerptText = opts.excerpt ? `\n\n${opts.excerpt}` : "";

  const errors: string[] = [];
  await Promise.all(
    recipients.map(async (email) => {
      try {
        await transport.sendMail({
          from: `"EduCare Portal" <${from}>`,
          to: email,
          subject: `New post: ${opts.postTitle}`,
          text: [
            "Hi,",
            "",
            `A new post has been published on the Family Portal: "${opts.postTitle}"${excerptText}`,
            "",
            "Read it here:",
            opts.portalUrl,
            "",
            "— EduCare Portal",
          ].join("\n"),
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
                <h2 style="margin: 0 0 8px;">New post published</h2>
                <h3 style="margin: 0 0 12px; color: #2d6a4f;">${opts.postTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
                ${excerptHtml}
                <a href="${opts.portalUrl}" style="
                  display: inline-block;
                  margin: 8px 0 16px;
                  padding: 12px 24px;
                  background: #2d6a4f;
                  color: #fff;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                ">Read post</a>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #aaa; font-size: 12px;">You received this email because you have a Family Portal account. Log in at <a href="${opts.portalUrl}" style="color: #2d6a4f;">${opts.portalUrl}</a>.</p>
              </body>
            </html>
          `,
        });
      } catch (err) {
        errors.push(email);
        logger.error({ email, err }, "Failed to send post notification email");
      }
    }),
  );

  const sent = recipients.length - errors.length;
  logger.info({ sent, failed: errors.length }, "Post notification emails dispatched");
}
