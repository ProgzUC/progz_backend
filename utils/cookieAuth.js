import { expiresInToMs } from "./expiresInToMs.js";
import { getTokenExpiryConfig } from "./generateTokens.js";

const isProduction = process.env.NODE_ENV === "production";
const useSecureCookies =
  isProduction || process.env.COOKIE_SECURE === "true";

const baseCookieOptions = () => ({
  httpOnly: true,
  secure: useSecureCookies,
  sameSite: useSecureCookies ? "none" : "lax",
  ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
});

export const ACCESS_TOKEN_COOKIE = "accessToken";
export const REFRESH_TOKEN_COOKIE = "refreshToken";

export const setAuthCookies = (res, accessToken, refreshToken) => {
  const { accessTokenExpiresIn, refreshTokenExpiresIn } = getTokenExpiryConfig();

  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions(),
    maxAge: expiresInToMs(accessTokenExpiresIn),
    path: "/",
  });

  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions(),
    maxAge: expiresInToMs(refreshTokenExpiresIn),
    path: "/",
  });
};

export const clearAuthCookies = (res) => {
  const options = {
    ...baseCookieOptions(),
    maxAge: 0,
  };

  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...options, path: "/" });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...options, path: "/" });
};
