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
import path from "path";
import nodemailer from "nodemailer";
import { logger } from "./logger";

export interface BehaviouralNotificationEmailOptions {
  childName: string;
  behaviourDescription: string;
  supportRequest: string;
  branding?: EmailBranding;
}

export interface PostNotificationEmailOptions {
  postTitle: string;
  excerpt: string | null;
  portalUrl: string;
}

export interface LoginInstructionsEmailOptions {
  recipientName: string;
  loginEmail: string;
  loginUrl: string;
  setPasswordUrl: string;
  isAlreadyConnected: boolean;
  accountType: "staff" | "guardian";
}

export interface ContactEnquiryEmailOptions {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  serviceName: string;
  message?: string;
}

export interface EmailBranding {
  senderName: string;
  logoUrl: string | null;
  templates?: {
    passwordReset?: { subject?: string; intro?: string };
    loginInvite?: { subject?: string; intro?: string };
    loginResend?: { subject?: string; intro?: string };
    postNotification?: { subject?: string; intro?: string };
    contactEnquiry?: { subject?: string; intro?: string };
    welcomeEmail?: { subject?: string; intro?: string };
  };
}

function buildLogoHtml(branding?: EmailBranding): string {
  if (!branding?.logoUrl) return "";
  const name = (branding.senderName ?? "EduCare Portal").replace(/"/g, "&quot;");
  return `<img src="${branding.logoUrl}" alt="${name}" style="height:52px;display:block;margin-bottom:20px;max-width:220px;object-fit:contain;" />`;
}

function fromName(branding?: EmailBranding): string {
  return branding?.senderName ?? "EduCare Portal";
}

function smtpFrom(): string {
  return (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "noreply@educare.example.com").trim();
}

function createTransport() {
  const host = process.env.SMTP_HOST?.trim();
  const port = parseInt(process.env.SMTP_PORT ?? "587", 10);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

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
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = smtpFrom();
  const configured = !!(host && user && pass);
  logger.info(
    { smtp: { host: host ?? "(not set)", user: user ?? "(not set)", from: from ?? "(not set)", configured } },
    configured ? "Email: SMTP configured — transactional emails will be delivered" : "Email: SMTP not configured — transactional emails will be skipped",
  );
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, branding?: EmailBranding): Promise<void> {
  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email }, "SMTP not configured — password reset email was not sent");
    return;
  }

  const subject = branding?.templates?.passwordReset?.subject ?? "Reset your EduCare password";
  const intro = branding?.templates?.passwordReset?.intro ?? "We received a request to reset the password for your EduCare Portal account.";

  await transport.sendMail({
    from: `"${fromName(branding)}" <${from}>`,
    to: email,
    subject,
    text: [
      "Hi,",
      "",
      intro,
      "",
      "Click the link below to set a new password. The link expires in 4 hours.",
      "",
      resetUrl,
      "",
      "If you didn't request a password reset, you can safely ignore this email.",
      "",
      `— ${fromName(branding)}`,
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
          ${buildLogoHtml(branding)}
          <h2 style="margin: 0 0 8px;">${subject}</h2>
          <p style="color: #555;">${intro}</p>
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

export async function sendLoginInstructionsEmail(
  email: string,
  opts: LoginInstructionsEmailOptions,
  branding?: EmailBranding,
): Promise<void> {
  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email }, "SMTP not configured — login instructions email was not sent");
    return;
  }

  const portalLabel = opts.accountType === "guardian" ? "Family Portal" : "EduCare Portal";
  const templateKey = opts.isAlreadyConnected ? "loginResend" : "loginInvite";
  const actionLabel = opts.isAlreadyConnected ? "Reset your password" : "Set your password";

  const defaultSubject = opts.isAlreadyConnected
    ? `Your ${portalLabel} login details`
    : `You've been invited to ${portalLabel}`;
  const defaultIntro = opts.isAlreadyConnected
    ? "Your account already has a password. Use the link below to set a new one."
    : "Your account has been set up. Click the link below to choose a password and get started.";

  const subject = branding?.templates?.[templateKey]?.subject ?? defaultSubject;
  const intro = branding?.templates?.[templateKey]?.intro ?? defaultIntro;

  await transport.sendMail({
    from: `"${fromName(branding)}" <${from}>`,
    to: email,
    subject,
    text: [
      `Hi ${opts.recipientName},`,
      "",
      intro,
      "",
      `Login email: ${opts.loginEmail}`,
      "",
      `${actionLabel}: ${opts.setPasswordUrl}`,
      "",
      `Once you have set a password you can log in at: ${opts.loginUrl}`,
      "",
      "This link expires in 4 hours.",
      "",
      `— ${fromName(branding)}`,
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
          ${buildLogoHtml(branding)}
          <h2 style="margin: 0 0 8px;">${subject}</h2>
          <p style="color: #555;">Hi ${opts.recipientName.replace(/</g, "&lt;").replace(/>/g, "&gt;")},</p>
          <p style="color: #555;">${intro}</p>
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
          <p style="color: #aaa; font-size: 12px;">${fromName(branding)} — sent by your centre administrator.</p>
        </body>
      </html>
    `,
  });

  logger.info({ email, accountType: opts.accountType }, "Login instructions email sent");
}

export async function sendContactEnquiryEmail(opts: ContactEnquiryEmailOptions, branding?: EmailBranding): Promise<void> {
  const to = "system@educareoshc.com.au";
  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email: opts.email }, "SMTP not configured — contact enquiry email was not sent");
    return;
  }

  const fullName = `${opts.firstName} ${opts.lastName}`;
  const intro = branding?.templates?.contactEnquiry?.intro ?? "Submitted via the EduCare public website.";
  const messageBlock = opts.message
    ? `Message:\n${opts.message}`
    : "No message provided.";

  await transport.sendMail({
    from: `"${fromName(branding)} Website" <${from}>`,
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
          ${buildLogoHtml(branding)}
          <h2 style="margin: 0 0 4px; color: #1b5e20;">New website enquiry</h2>
          <p style="color: #555; margin: 0 0 20px;">${intro}</p>
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

export interface GuardianNoticeEmailOptions {
  noticeTitle: string;
  priority: string;
  content: string;
  portalUrl: string;
}

export async function sendGuardianNoticeEmail(
  recipients: string[],
  opts: GuardianNoticeEmailOptions,
  branding?: EmailBranding,
): Promise<void> {
  if (recipients.length === 0) return;

  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ count: recipients.length }, "SMTP not configured — guardian notice emails were not sent");
    return;
  }

  const priorityLabel = opts.priority.charAt(0).toUpperCase() + opts.priority.slice(1);
  const isUrgent = opts.priority === "urgent" || opts.priority === "high";
  const priorityColor = opts.priority === "urgent" ? "#dc2626" : opts.priority === "high" ? "#d97706" : "#3b82f6";
  const subjectPrefix = isUrgent ? `[${priorityLabel}] ` : "";
  const subject = `${subjectPrefix}New notice: ${opts.noticeTitle}`;
  const contentHtml = opts.content
    ? `<p style="color:#555; margin: 0 0 16px; white-space: pre-wrap;">${opts.content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";

  const errors: string[] = [];
  await Promise.all(
    recipients.map(async (email) => {
      try {
        await transport.sendMail({
          from: `"${fromName(branding)}" <${from}>`,
          to: email,
          subject,
          text: [
            "Hi,",
            "",
            `A new notice has been posted on the Family Portal.`,
            "",
            `Title: ${opts.noticeTitle}`,
            opts.content ? `\n${opts.content}\n` : "",
            "Log in to view the full notice:",
            opts.portalUrl,
            "",
            `— ${fromName(branding)}`,
          ].join("\n"),
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
                ${buildLogoHtml(branding)}
                <h2 style="margin: 0 0 8px;">New notice from your centre</h2>
                <div style="display:inline-block; margin-bottom:12px; padding: 3px 10px; border-radius:99px; background:${priorityColor}20; color:${priorityColor}; font-size:12px; font-weight:600; text-transform:capitalize;">
                  ${priorityLabel}
                </div>
                <h3 style="margin: 0 0 12px; color: #1b5e20;">${opts.noticeTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
                ${contentHtml}
                <a href="${opts.portalUrl}" style="
                  display: inline-block;
                  margin: 8px 0 16px;
                  padding: 12px 24px;
                  background: #1b5e20;
                  color: #fff;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                ">View notice</a>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #aaa; font-size: 12px;">You received this email because you have a Family Portal account. Log in at <a href="${opts.portalUrl}" style="color: #1b5e20;">${opts.portalUrl}</a>.</p>
              </body>
            </html>
          `,
        });
      } catch (err) {
        errors.push(email);
        logger.error({ email, err }, "Failed to send guardian notice email");
      }
    }),
  );

  const sent = recipients.length - errors.length;
  logger.info({ sent, failed: errors.length }, "Guardian notice emails dispatched");
}

export interface WeeklyPlanPublishedEmailOptions {
  planTitle: string;
  weekOf: string | null;
  portalUrl: string;
}

export async function sendWeeklyPlanPublishedEmail(
  recipients: string[],
  opts: WeeklyPlanPublishedEmailOptions,
  branding?: EmailBranding,
): Promise<void> {
  if (recipients.length === 0) return;

  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ count: recipients.length }, "SMTP not configured — weekly plan emails were not sent");
    return;
  }

  const weekLabel = opts.weekOf ? `week of ${opts.weekOf}` : "the coming week";
  const subject = `Weekly learning program published — ${weekLabel}`;
  const weekHtml = opts.weekOf
    ? `<p style="color:#555; margin: 0 0 16px;">The weekly learning program for the <strong>week of ${opts.weekOf}</strong> is now available on the Family Portal.</p>`
    : `<p style="color:#555; margin: 0 0 16px;">A new weekly learning program has been published on the Family Portal.</p>`;

  const errors: string[] = [];
  await Promise.all(
    recipients.map(async (email) => {
      try {
        await transport.sendMail({
          from: `"${fromName(branding)}" <${from}>`,
          to: email,
          subject,
          text: [
            "Hi,",
            "",
            `The weekly learning program "${opts.planTitle}" for ${weekLabel} has been published.`,
            "",
            "View the program here:",
            opts.portalUrl,
            "",
            `— ${fromName(branding)}`,
          ].join("\n"),
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
                ${buildLogoHtml(branding)}
                <h2 style="margin: 0 0 8px;">Calendar published</h2>
                <h3 style="margin: 0 0 12px; color: #1b5e20;">${opts.planTitle.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</h3>
                ${weekHtml}
                <a href="${opts.portalUrl}" style="
                  display: inline-block;
                  margin: 8px 0 16px;
                  padding: 12px 24px;
                  background: #1b5e20;
                  color: #fff;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: 600;
                ">View calendar</a>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="color: #aaa; font-size: 12px;">You received this email because you have a Family Portal account. Log in at <a href="${opts.portalUrl}" style="color: #1b5e20;">${opts.portalUrl}</a>.</p>
              </body>
            </html>
          `,
        });
      } catch (err) {
        errors.push(email);
        logger.error({ email, err }, "Failed to send weekly plan email");
      }
    }),
  );

  const sent = recipients.length - errors.length;
  logger.info({ sent, failed: errors.length }, "Weekly plan published emails dispatched");
}

export async function sendPostNotificationEmail(
  recipients: string[],
  opts: PostNotificationEmailOptions,
  branding?: EmailBranding,
): Promise<void> {
  if (recipients.length === 0) return;

  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ count: recipients.length }, "SMTP not configured — post notification emails were not sent");
    return;
  }

  const intro = branding?.templates?.postNotification?.intro ?? "A new post has been published on the Family Portal.";
  const excerptHtml = opts.excerpt
    ? `<p style="color:#555; margin: 0 0 16px;">${opts.excerpt.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`
    : "";
  const excerptText = opts.excerpt ? `\n\n${opts.excerpt}` : "";

  const errors: string[] = [];
  await Promise.all(
    recipients.map(async (email) => {
      try {
        await transport.sendMail({
          from: `"${fromName(branding)}" <${from}>`,
          to: email,
          subject: `New post: ${opts.postTitle}`,
          text: [
            "Hi,",
            "",
            `${intro} "${opts.postTitle}"${excerptText}`,
            "",
            "Read it here:",
            opts.portalUrl,
            "",
            `— ${fromName(branding)}`,
          ].join("\n"),
          html: `
            <!DOCTYPE html>
            <html>
              <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
                ${buildLogoHtml(branding)}
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

// ── Welcome email ─────────────────────────────────────────────────────────────

export async function sendWelcomeEmail(
  email: string,
  recipientName: string,
  portalUrl: string,
  branding?: EmailBranding,
): Promise<void> {
  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ email }, "SMTP not configured — welcome email was not sent");
    return;
  }

  const senderName = fromName(branding);
  const subject = branding?.templates?.welcomeEmail?.subject ?? "Welcome to EduCare";
  const intro = branding?.templates?.welcomeEmail?.intro ?? "EduCare gives your family real-time access to everything happening in your child's OSHC experience — from weekly learning programs to health updates, learning stories, and service announcements.";
  const pdfPath = path.resolve(process.cwd(), "..", "..", "attached_assets", "EduCare_Features_-_Families_1780904943093.pdf");

  await transport.sendMail({
    from: `"${senderName}" <${from}>`,
    to: email,
    subject,
    text: [
      `Hi ${recipientName},`,
      "",
      "Welcome to EduCare — the family portal for your child's OSHC service.",
      "",
      "Through the app you can:",
      "• View your child's weekly learning program",
      "• Manage approved pick-up contacts",
      "• Read learning stories and updates from educators",
      "• Access medical plans and communication plans",
      "• View medication logs",
      "• Receive service notices and announcements",
      "",
      `Log in at: ${portalUrl}`,
      "",
      "We've attached a quick guide to help you get started.",
      "",
      `— ${senderName}`,
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
        <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 0;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%); padding: 36px 32px 28px; border-radius: 12px 12px 0 0;">
            ${branding?.logoUrl
              ? `<img src="${branding.logoUrl}" alt="${senderName.replace(/"/g, "&quot;")}" style="height:48px;display:block;margin-bottom:20px;max-width:200px;object-fit:contain;" />`
              : `<p style="color:#fff; font-size:22px; font-weight:800; margin:0 0 20px; letter-spacing:-0.5px;">${senderName}</p>`
            }
            <h1 style="color:#fff; margin:0; font-size:28px; font-weight:800; line-height:1.2;">Welcome to EduCare</h1>
            <p style="color:rgba(255,255,255,0.80); margin:8px 0 0; font-size:15px;">Hi ${recipientName.replace(/</g, "&lt;").replace(/>/g, "&gt;")} — we're glad you're here.</p>
          </div>

          <!-- Body -->
          <div style="padding: 28px 32px; background:#fff; border: 1px solid #e8e8e8; border-top: none; border-radius: 0 0 12px 12px;">
            <p style="color:#444; font-size:15px; line-height:1.6; margin:0 0 20px;">
              EduCare gives your family real-time access to everything happening in your child's OSHC experience — from weekly learning programs to health updates, learning stories, and service announcements.
            </p>

            <!-- Feature list -->
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              ${[
                ["📅", "Weekly Learning Program", "See what's planned each day."],
                ["🚗", "Approved Pick-Ups", "Manage who can collect your child."],
                ["📸", "Posts & Updates", "Learning stories and photos from educators."],
                ["💊", "Medical Plans", "Risk assessments and communication plans."],
                ["🔔", "Notices", "Service announcements and reminders."],
              ].map(([icon, title, desc]) => `
              <tr>
                <td style="padding:8px 10px 8px 0; vertical-align:top; font-size:18px; width:28px;">${icon}</td>
                <td style="padding:8px 0;">
                  <p style="margin:0; font-weight:700; color:#1a1a1a; font-size:14px;">${title}</p>
                  <p style="margin:2px 0 0; color:#666; font-size:13px;">${desc}</p>
                </td>
              </tr>`).join("")}
            </table>

            <!-- CTA button -->
            <div style="text-align:center; margin: 8px 0 24px;">
              <a href="${portalUrl}" style="
                display: inline-block;
                padding: 14px 32px;
                background: #1b5e20;
                color: #fff;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 700;
                font-size: 15px;
                letter-spacing: 0.2px;
              ">Open the Family Portal</a>
            </div>

            <p style="color:#888; font-size:13px; margin:0 0 4px;">
              We've attached a quick guide to help you explore everything the app has to offer.
            </p>

            <hr style="border:none; border-top:1px solid #eee; margin:24px 0;" />
            <p style="color:#aaa; font-size:12px; margin:0;">
              ${senderName} — sent by your centre administrator.
              If you have trouble logging in, please contact your service directly.
            </p>
          </div>
        </body>
      </html>
    `,
    attachments: [
      {
        filename: "EduCare_Features_-_Families.pdf",
        path: pdfPath,
        contentType: "application/pdf",
      },
    ],
  });

  logger.info({ email }, "Welcome email sent");
}

export interface MedicationLogEmailOptions {
  childName: string;
  medicationName: string;
  administeredAt: string;
  dosageAdministered: string;
  methodOfAdministration: string;
  administeredByName: string;
  witnessName: string | null;
  portalUrl: string;
}

export async function sendMedicationLogEmail(
  recipients: string[],
  opts: MedicationLogEmailOptions,
  branding?: EmailBranding,
): Promise<void> {
  if (recipients.length === 0) return;

  const from = smtpFrom();
  const transport = createTransport();

  if (!transport) {
    logger.warn({ count: recipients.length }, "SMTP not configured — medication log emails were not sent");
    return;
  }

  const when = new Date(opts.administeredAt).toLocaleString("en-AU", {
    day: "numeric", month: "short", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
    timeZone: "Australia/Melbourne",
  });

  const subject = `Medication given to ${opts.childName} — ${opts.medicationName}`;

  const rows = [
    ["Child", opts.childName],
    ["Medication", opts.medicationName],
    ["Date & Time", when],
    ["Dosage", opts.dosageAdministered],
    ["Method", opts.methodOfAdministration],
    ["Administered by", opts.administeredByName],
    ...(opts.witnessName ? [["Witnessed by", opts.witnessName] as [string, string]] : []),
  ] as [string, string][];

  const tableRows = rows
    .map(([label, val]) => `<tr><td style="padding:6px 12px 6px 0; color:#555; white-space:nowrap; vertical-align:top;">${label}</td><td style="padding:6px 0; font-weight:600; vertical-align:top;">${val}</td></tr>`)
    .join("");

  const textLines = rows.map(([l, v]) => `${l}: ${v}`).join("\n");

  for (const email of recipients) {
    try {
      await transport.sendMail({
        from: `"${fromName(branding)}" <${from}>`,
        to: email,
        subject,
        text: [
          `Hi,`,
          ``,
          `A medication has been administered at the centre. Details below.`,
          ``,
          textLines,
          ``,
          `Log in to view full medication history:`,
          opts.portalUrl,
          ``,
          `— ${fromName(branding)}`,
        ].join("\n"),
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
              ${buildLogoHtml(branding)}
              <h2 style="margin: 0 0 4px;">Medication administered</h2>
              <p style="color:#555; margin: 0 0 20px;">A medication has been given to <strong>${opts.childName}</strong> at the centre.</p>
              <table style="border-collapse: collapse; width: 100%; margin-bottom: 24px;">
                ${tableRows}
              </table>
              <a href="${opts.portalUrl}" style="display:inline-block;padding:12px 24px;background:#1b5e20;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">View medication log</a>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
              <p style="color:#aaa;font-size:12px;">You received this because you have a Family Portal account for ${opts.childName}.</p>
            </body>
          </html>
        `,
      });
    } catch (err) {
      logger.error({ email, err }, "Failed to send medication log email");
    }
  }
}

export async function sendBehaviouralNotificationEmail(
  recipients: string[],
  opts: BehaviouralNotificationEmailOptions,
): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    logger.warn("sendBehaviouralNotificationEmail: SMTP not configured — skipping");
    return;
  }

  const from = smtpFrom();
  const subject = `Behavioural Notification — ${opts.childName}`;

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");

  const txtBody = [
    `Dear Parent/Guardian,`,
    ``,
    `We are writing to inform you that today your child displayed the following behaviour(s):`,
    ``,
    opts.behaviourDescription,
    ``,
    `At Elysium OSHC, we work closely with families to support positive behaviour and wellbeing for all children. We are hoping you can assist us with:`,
    ``,
    opts.supportRequest,
    ``,
    `We appreciate your partnership and support in helping your child make positive choices. If you would like to discuss this matter further, please feel free to contact us.`,
    ``,
    `Regards,`,
    ``,
    `Admin Team`,
    `ELYSIUM OSHC`,
    ``,
    `(03) 8595 3022 | 0466 047 908 | admin@elysiumoshc.com.au`,
  ].join("\n");

  const htmlBody = `<!DOCTYPE html>
<html>
  <body style="font-family: sans-serif; color: #1a1a1a; max-width: 580px; margin: 0 auto; padding: 24px;">
    ${opts.branding ? buildLogoHtml(opts.branding) : ""}
    <p style="margin:0 0 12px;">Dear Parent/Guardian,</p>
    <p style="margin:0 0 8px;">We are writing to inform you that today your child displayed the following behaviour(s):</p>
    <div style="background:#fef2f2; border-left:4px solid #dc2626; padding:14px 18px; margin:16px 0; white-space:pre-wrap; line-height:1.6;">${esc(opts.behaviourDescription)}</div>
    <p style="margin:0 0 8px;">At Elysium OSHC, we work closely with families to support positive behaviour and wellbeing for all children. We are hoping you can assist us with:</p>
    <div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:14px 18px; margin:16px 0; white-space:pre-wrap; line-height:1.6;">${esc(opts.supportRequest)}</div>
    <p style="margin:0 0 20px;">We appreciate your partnership and support in helping your child make positive choices. If you would like to discuss this matter further, please feel free to contact us.</p>
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
    <p style="margin:0;font-weight:600;">Regards,</p>
    <p style="margin:4px 0 0;">Admin Team<br/><strong>ELYSIUM OSHC</strong></p>
    <p style="margin:10px 0 0; color:#555; font-size:13px;">(03) 8595 3022 | 0466 047 908 | <a href="mailto:admin@elysiumoshc.com.au" style="color:#1b5e20;">admin@elysiumoshc.com.au</a></p>
  </body>
</html>`;

  for (const email of recipients) {
    try {
      await transport.sendMail({
        from: `"${opts.branding ? fromName(opts.branding) : "ELYSIUM OSHC"}" <${from}>`,
        to: email,
        subject,
        text: txtBody,
        html: htmlBody,
      });
    } catch (err) {
      logger.error({ email, err }, "Failed to send behavioural notification email");
    }
  }
}
