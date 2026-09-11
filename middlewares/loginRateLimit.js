import { sendError } from "../utils/apiError.js";
import { getClientIp } from "./rateLimit.js";

const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 10 * 60 * 1000);
const LOCK_MS = Number(process.env.LOGIN_LOCK_MS || 15 * 60 * 1000);

const attempts = new Map();

const getClientKey = (req) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return `${getClientIp(req)}:${email}`;
};

const getRetryAfterSeconds = (until) => {
  const msRemaining = Math.max(0, until - Date.now());
  return Math.max(1, Math.ceil(msRemaining / 1000));
};

export const loginRateLimit = (req, res, next) => {
  const key = getClientKey(req);
  const now = Date.now();
  const record = attempts.get(key);

  if (!record) {
    res.locals.loginRateLimitKey = key;
    return next();
  }

  if (record.lockedUntil && record.lockedUntil > now) {
    const retryAfter = getRetryAfterSeconds(record.lockedUntil);
    return sendError(res, 429, "Too many login attempts. Try again later.", {
      code: "LOGIN_RATE_LIMITED",
      retryAfter,
    });
  }

  if (now - record.firstAttemptAt > WINDOW_MS) {
    attempts.delete(key);
  }

  res.locals.loginRateLimitKey = key;
  next();
};

export const recordLoginFailure = (key) => {
  if (!key) return;

  const now = Date.now();
  const current = attempts.get(key);

  if (!current || now - current.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, {
      count: 1,
      firstAttemptAt: now,
      lockedUntil: null,
    });
    return;
  }

  current.count += 1;
  if (current.count >= MAX_ATTEMPTS) {
    current.lockedUntil = now + LOCK_MS;
  }
  attempts.set(key, current);
};

export const clearLoginFailures = (key) => {
  if (!key) return;
  attempts.delete(key);
};
