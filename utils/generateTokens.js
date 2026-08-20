import jwt from "jsonwebtoken";
import crypto from "crypto";

// Access token: short-lived (default 15 minutes)
// Refresh token: longer-lived (default 7 days)
const ACCESS_TOKEN_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES || "15m";
const REFRESH_TOKEN_EXPIRES = process.env.REFRESH_TOKEN_EXPIRES || "7d";

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRES }
  );
};

export const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id.toString(), jti: crypto.randomUUID() },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRES }
  );
};

export const getTokenExpiryConfig = () => ({
  accessTokenExpiresIn: ACCESS_TOKEN_EXPIRES,
  refreshTokenExpiresIn: REFRESH_TOKEN_EXPIRES,
});
