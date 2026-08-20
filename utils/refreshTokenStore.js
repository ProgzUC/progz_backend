import crypto from "crypto";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const hashRefreshToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const saveRefreshToken = async (userId, refreshToken) => {
  const decoded = jwt.decode(refreshToken);
  const expires =
    decoded?.exp != null ? new Date(decoded.exp * 1000) : undefined;

  await User.findByIdAndUpdate(userId, {
    refreshTokenHash: hashRefreshToken(refreshToken),
    refreshTokenExpires: expires,
  });
};

export const verifyStoredRefreshToken = async (userId, refreshToken) => {
  const user = await User.findById(userId).select(
    "refreshTokenHash refreshTokenExpires"
  );

  if (!user?.refreshTokenHash) return false;
  if (user.refreshTokenExpires && user.refreshTokenExpires <= new Date()) {
    return false;
  }

  return user.refreshTokenHash === hashRefreshToken(refreshToken);
};

export const revokeRefreshToken = async (userId) => {
  await User.findByIdAndUpdate(userId, {
    $unset: { refreshTokenHash: 1, refreshTokenExpires: 1 },
  });
};
