import User from "../models/User.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import {
  generateAccessToken,
  generateRefreshToken,
  getTokenExpiryConfig,
} from "../utils/generateTokens.js";
import {
  setAuthCookies,
  clearAuthCookies,
  REFRESH_TOKEN_COOKIE,
} from "../utils/cookieAuth.js";
import {
  saveRefreshToken,
  verifyStoredRefreshToken,
  revokeRefreshToken,
} from "../utils/refreshTokenStore.js";
import sendWithBrevo from "../utils/sendWithBrevo.js";
import { validatePassword } from "../utils/passwordValidation.js";
import {
  clearLoginFailures,
  recordLoginFailure,
} from "../middlewares/loginRateLimit.js";

const buildAuthUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const issueAuthSession = async (res, user) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  const expiry = getTokenExpiryConfig();

  await saveRefreshToken(user._id, refreshToken);
  setAuthCookies(res, accessToken, refreshToken);

  return {
    msg: "Login successful",
    role: user.role,
    expiresIn: expiry.accessTokenExpiresIn,
    refreshExpiresIn: expiry.refreshTokenExpiresIn,
    user: buildAuthUser(user),
  };
};

export const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.ok) {
      return res.status(400).json({ msg: passwordCheck.message });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ msg: "Email already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      ...req.body,
      password: hashed,
      role,
    });

    res.status(201).json({
      msg: "User registered successfully",
      user: { id: user._id, email: user.email, role: user.role },
    });

  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const rateLimitKey = res.locals.loginRateLimitKey;

    const user = await User.findOne({ email });
    if (!user) {
      recordLoginFailure(rateLimitKey);
      return res.status(401).json({ msg: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      recordLoginFailure(rateLimitKey);
      return res.status(401).json({ msg: "Invalid email or password" });
    }

    const sessionData = await issueAuthSession(res, user);
    clearLoginFailures(rateLimitKey);
    res.json(sessionData);

  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }
    res.json({
      user: buildAuthUser(user),
      role: user.role,
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const refreshAccessToken = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const headerToken = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken || headerToken;

    if (!refreshToken) {
      clearAuthCookies(res);
      return res.status(401).json({ msg: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
      clearAuthCookies(res);
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ msg: "Refresh token expired" });
      }
      return res.status(401).json({ msg: "Invalid refresh token" });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      clearAuthCookies(res);
      return res.status(401).json({ msg: "User not found" });
    }

    const isValid = await verifyStoredRefreshToken(user._id, refreshToken);
    if (!isValid) {
      await revokeRefreshToken(user._id);
      clearAuthCookies(res);
      return res.status(401).json({ msg: "Invalid or revoked refresh token" });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);
    const expiry = getTokenExpiryConfig();

    await saveRefreshToken(user._id, newRefreshToken);
    setAuthCookies(res, newAccessToken, newRefreshToken);

    res.json({
      msg: "Token refreshed",
      role: user.role,
      expiresIn: expiry.accessTokenExpiresIn,
      refreshExpiresIn: expiry.refreshTokenExpiresIn,
      user: buildAuthUser(user),
    });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken =
      req.cookies?.[REFRESH_TOKEN_COOKIE] || req.body?.refreshToken;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        await revokeRefreshToken(decoded.id);
      } catch {
        // Ignore invalid/expired tokens during logout.
      }
    }

    clearAuthCookies(res);
    res.json({ msg: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ msg: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user || user.role === "admin") {
    // security: don't reveal if email exists
    return res.json({ msg: "If user exists, reset link sent" });
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

  const message = `
    <!DOCTYPE html>

<html>
<head>
  <meta charset="UTF-8" />
  <title>Password Reset</title>
</head>
<body style="margin:0; padding:0; background:#f4f6f8; font-family:Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8; padding:20px;">
    <tr>
      <td align="center">
    <table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 10px rgba(0,0,0,0.05);">

      <!-- Header -->
      <tr>
        <td style="background:#4f46e5; padding:20px; text-align:center; color:#ffffff;">
          <h2 style="margin:0;">🔐 Password Reset</h2>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:30px; color:#333;">
          <h3 style="margin-top:0;">Reset your password</h3>
          <p>You requested to reset your password. Click the button below to continue.</p>

          <p style="text-align:center; margin:30px 0;">
            <a href="${resetLink}" clicktracking="off"
              style="background:#4f46e5; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-weight:bold; display:inline-block;">
              Reset Password
            </a>
          </p>

          <p style="font-size:14px; color:#666;">
            ⏳ This link is valid for <b>15 minutes</b>.
          </p>

          <p style="font-size:14px; color:#666;">
            If you didn’t request this, you can safely ignore this email.
          </p>

          <hr style="border:none; border-top:1px solid #eee; margin:20px 0;" />

          <p style="font-size:12px; color:#999;">
            If the button doesn’t work, copy and paste this link into your browser:
          </p>
          <p style="font-size:12px; word-break:break-all; color:#4f46e5;">
            ${resetLink}
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9fafb; padding:15px; text-align:center; font-size:12px; color:#999;">
          © ${new Date().getFullYear()} Your App. All rights reserved.
        </td>
      </tr>

    </table>

  </td>
</tr>
  </table>

</body>
</html>

  `;

  try {
    await sendWithBrevo({
      email: user.email,
      subject: "Password Reset Request",
      html: message,
      senderName: "Progz Support",
      senderEmail: process.env.FROM_EMAIL,
    });

    res.json({ msg: "Password reset link sent" });
  } catch (error) {
    console.error("Email send error:", error);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(500).json({ msg: "Email could not be sent" });
  }

};


export const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  const passwordCheck = validatePassword(password);
  if (!passwordCheck.ok) {
    return res.status(400).json({ msg: passwordCheck.message });
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user)
    return res.status(400).json({ msg: "Invalid or expired token" });

  user.password = await bcrypt.hash(password, 10);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  user.refreshTokenHash = undefined;
  user.refreshTokenExpires = undefined;

  await user.save();

  res.json({ msg: "Password reset successful" });
};
