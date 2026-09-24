import crypto from "crypto";
import bcrypt from "bcryptjs";
import { deliverMail, frontendBaseUrl } from "./deliverMail.js";

const FRONTEND_URL = () => frontendBaseUrl();

export const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

export const createRawLoginToken = () => crypto.randomBytes(32).toString("hex");

/** Unusable random hash so password login cannot succeed without a real password. */
export const randomUnusablePassword = async () => {
  const raw = crypto.randomBytes(32).toString("hex");
  return bcrypt.hash(raw, 10);
};

/**
 * Mint a one-time login token on the user document (does not save).
 * @param {import("mongoose").Document} user
 * @param {number} ttlMs
 * @returns {string} raw token for the email link
 */
export const attachLoginToken = (user, ttlMs = 7 * 24 * 60 * 60 * 1000) => {
  const rawToken = createRawLoginToken();
  user.loginToken = hashToken(rawToken);
  user.loginTokenExpires = new Date(Date.now() + ttlMs);
  return rawToken;
};

export const buildMagicLoginLink = (rawToken) =>
  `${FRONTEND_URL()}/magic-login/${rawToken}`;

const welcomeHtml = ({ name, loginLink, batchName }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>Welcome to ProgZ</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 10px rgba(0,0,0,0.05);">
        <tr>
          <td style="background:#4f46e5;padding:22px;text-align:center;color:#ffffff;">
            <h2 style="margin:0;">Welcome to ProgZ</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#333;">
            <p style="margin-top:0;">Hi ${name || "there"},</p>
            <p>Your ProgZ student account has been created${
              batchName ? ` and you have been assigned to <b>${batchName}</b>` : ""
            }.</p>
            <p>You can access your Student Dashboard with a secure login link — no password needed.</p>
            <p style="text-align:center;margin:28px 0;">
              <a href="${loginLink}" clicktracking="off"
                style="background:#4f46e5;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
                Open Student Dashboard
              </a>
            </p>
            <p style="font-size:14px;color:#666;">This link is valid for <b>7 days</b> and can be used once. You can request a new link anytime from the login page.</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
            <p style="font-size:12px;color:#999;">If the button doesn’t work, copy and paste this link:</p>
            <p style="font-size:12px;word-break:break-all;color:#4f46e5;">${loginLink}</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:14px;text-align:center;font-size:12px;color:#999;">
            © ${new Date().getFullYear()} ProgZ Academy
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

const magicLoginHtml = ({ name, loginLink }) => `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><title>ProgZ Login Link</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:20px;">
    <tr><td align="center">
      <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">
        <tr>
          <td style="background:#4f46e5;padding:20px;text-align:center;color:#ffffff;">
            <h2 style="margin:0;">Your ProgZ Login Link</h2>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;color:#333;">
            <p style="margin-top:0;">Hi ${name || "there"},</p>
            <p>Click below to sign in securely to your Student Dashboard. No password required.</p>
            <p style="text-align:center;margin:28px 0;">
              <a href="${loginLink}" clicktracking="off"
                style="background:#4f46e5;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">
                Sign in to ProgZ
              </a>
            </p>
            <p style="font-size:14px;color:#666;">This link expires in <b>15 minutes</b> and can be used once.</p>
            <p style="font-size:12px;word-break:break-all;color:#4f46e5;">${loginLink}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

async function deliverEmail({ email, subject, html }) {
  await deliverMail({ email, subject, html, senderName: "ProgZ Academy" });
}

export async function sendWelcomeInviteEmail({ user, batchName, rawToken }) {
  const loginLink = buildMagicLoginLink(rawToken);
  await deliverEmail({
    email: user.email,
    subject: "Welcome to ProgZ — Access your Student Dashboard",
    html: welcomeHtml({ name: user.name, loginLink, batchName }),
  });
}

export async function sendMagicLoginEmail({ user, rawToken }) {
  const loginLink = buildMagicLoginLink(rawToken);
  await deliverEmail({
    email: user.email,
    subject: "Your ProgZ login link",
    html: magicLoginHtml({ name: user.name, loginLink }),
  });
}
