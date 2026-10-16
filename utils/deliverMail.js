import sendWithBrevo from "./sendWithBrevo.js";
import sendEmail from "./sendEmail.js";

/**
 * Send transactional email via Brevo when configured, otherwise Gmail/SMTP.
 * Live currently uses SMTP_*; Brevo is optional.
 */
export async function deliverMail({
  email,
  subject,
  html,
  text,
  senderName = "ProgZ Academy",
}) {
  if (!email) throw new Error("Recipient email is required.");

  const hasBrevo = Boolean(
    process.env.BREVO_API_KEY?.trim() && process.env.FROM_EMAIL?.trim()
  );

  if (hasBrevo) {
    await sendWithBrevo({
      email,
      subject,
      html,
      senderName,
      senderEmail: process.env.FROM_EMAIL,
    });
    return { provider: "brevo" };
  }

  await sendEmail({
    email,
    subject,
    html,
    message: text || subject,
    fromName: senderName,
  });
  return { provider: "smtp" };
}

/**
 * Base URL used in outbound email / magic links.
 * Prefer EMAIL_FRONTEND_URL so local FRONTEND_URL=localhost does not leak into live mail.
 */
export const frontendBaseUrl = () => {
  const explicit = String(
    process.env.EMAIL_FRONTEND_URL || process.env.PUBLIC_FRONTEND_URL || ""
  ).trim();
  if (explicit) return explicit.replace(/\/$/, "");

  const raw = String(process.env.FRONTEND_URL || "https://progz.urbancode.in")
    .trim()
    .replace(/\/$/, "");

  // Shared/live DB + local FRONTEND_URL would otherwise mail localhost CTAs.
  if (/localhost|127\.0\.0\.1/i.test(raw)) {
    return "https://progz.urbancode.in";
  }
  return raw || "https://progz.urbancode.in";
};
