import axios from "axios";

/**
 * sendWithBrevo({ email, subject, html, senderName, senderEmail })
 * Uses Brevo REST API directly via axios (ESM-compatible)
 */
export default async function sendWithBrevo({ email, subject, html, senderName, senderEmail }) {
  const response = await axios.post(
    "https://api.brevo.com/v3/smtp/email",
    {
      sender: {
        name: senderName || "Progz Support",
        email: senderEmail || process.env.FROM_EMAIL,
      },
      to: [{ email }],
      subject,
      htmlContent: html,
    },
    {
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
    }
  );

  return response.data;
}