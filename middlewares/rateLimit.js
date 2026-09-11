import { sendError } from "../utils/apiError.js";

/**
 * In-memory sliding-window rate limiter.
 * Suitable for single-instance deploys; keys reset on process restart.
 */

const stores = new Map();

const parsePositiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

export const getClientIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const raw =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";
  return String(raw).trim();
};

/**
 * @param {{
 *   windowMs?: number,
 *   max?: number,
 *   message?: string,
 *   code?: string,
 *   keyPrefix?: string,
 *   keyGenerator?: (req: import('express').Request) => string,
 *   skip?: (req: import('express').Request) => boolean,
 * }} options
 */
export const createRateLimiter = (options = {}) => {
  const windowMs = parsePositiveInt(options.windowMs, 15 * 60 * 1000);
  const max = parsePositiveInt(options.max, 100);
  const message = options.message || "Too many requests. Try again later.";
  const code = options.code || "RATE_LIMITED";
  const keyPrefix = options.keyPrefix || "rl";
  const keyGenerator = options.keyGenerator || ((req) => getClientIp(req));
  const skip = options.skip;

  if (!stores.has(keyPrefix)) {
    stores.set(keyPrefix, new Map());
  }
  const store = stores.get(keyPrefix);

  // Periodic cleanup so the Map does not grow unbounded
  const cleanupMs = Math.min(windowMs, 60_000);
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now - entry.windowStart >= windowMs) {
        store.delete(key);
      }
    }
  }, cleanupMs);
  timer.unref?.();

  return (req, res, next) => {
    if (typeof skip === "function" && skip(req)) {
      return next();
    }

    const key = `${keyPrefix}:${keyGenerator(req)}`;
    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      entry = { count: 0, windowStart: now };
    }

    entry.count += 1;
    store.set(key, entry);

    const remaining = Math.max(0, max - entry.count);
    const resetMs = Math.max(0, windowMs - (now - entry.windowStart));
    const retryAfter = Math.max(1, Math.ceil(resetMs / 1000));

    res.set("X-RateLimit-Limit", String(max));
    res.set("X-RateLimit-Remaining", String(remaining));
    res.set("X-RateLimit-Reset", String(Math.ceil((entry.windowStart + windowMs) / 1000)));

    if (entry.count > max) {
      return sendError(res, 429, message, { code, retryAfter });
    }

    return next();
  };
};

/** Broad IP limit for all API traffic */
export const globalApiRateLimit = createRateLimiter({
  keyPrefix: "global",
  windowMs: parsePositiveInt(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInt(process.env.RATE_LIMIT_MAX, 300),
  message: "Too many requests from this IP. Try again later.",
  skip: (req) => {
    const path = req.path || "";
    return path === "/ping" || path === "/api/test" || path === "/api/class-session/health";
  },
});

/** Public registration / signup */
export const registrationRateLimit = createRateLimiter({
  keyPrefix: "register",
  windowMs: parsePositiveInt(process.env.REGISTER_RATE_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInt(process.env.REGISTER_RATE_MAX, 5),
  message: "Too many registration attempts. Try again later.",
  code: "REGISTER_RATE_LIMITED",
});

/** Password-reset email / other email-triggering endpoints */
export const emailRateLimit = createRateLimiter({
  keyPrefix: "email",
  windowMs: parsePositiveInt(process.env.EMAIL_RATE_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInt(process.env.EMAIL_RATE_MAX, 5),
  message: "Too many email requests. Try again later.",
  code: "EMAIL_RATE_LIMITED",
  keyGenerator: (req) => {
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `${getClientIp(req)}:${email || "none"}`;
  },
});

/** Refresh token rotation */
export const refreshRateLimit = createRateLimiter({
  keyPrefix: "refresh",
  windowMs: parsePositiveInt(process.env.REFRESH_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInt(process.env.REFRESH_RATE_MAX, 30),
  message: "Too many token refresh attempts. Try again later.",
  code: "REFRESH_RATE_LIMITED",
});

/** Password reset submissions */
export const passwordResetRateLimit = createRateLimiter({
  keyPrefix: "reset",
  windowMs: parsePositiveInt(process.env.RESET_RATE_WINDOW_MS, 60 * 60 * 1000),
  max: parsePositiveInt(process.env.RESET_RATE_MAX, 10),
  message: "Too many password reset attempts. Try again later.",
  code: "RESET_RATE_LIMITED",
});

/** Authenticated write / upload / bulk submission endpoints */
export const submissionRateLimit = createRateLimiter({
  keyPrefix: "submit",
  windowMs: parsePositiveInt(process.env.SUBMIT_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: parsePositiveInt(process.env.SUBMIT_RATE_MAX, 60),
  message: "Too many submissions. Try again later.",
  code: "SUBMIT_RATE_LIMITED",
  keyGenerator: (req) => {
    const userId = req.user?.id || "anon";
    return `${getClientIp(req)}:${userId}`;
  },
});
