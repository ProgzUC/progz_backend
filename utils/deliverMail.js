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

export const frontendBaseUrl = () =>
  (process.env.FRONTEND_URL || "https://progz.urbancode.in").replace(/\/$/, "");
