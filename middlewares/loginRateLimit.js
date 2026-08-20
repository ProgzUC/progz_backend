const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);
const WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 10 * 60 * 1000);
const LOCK_MS = Number(process.env.LOGIN_LOCK_MS || 15 * 60 * 1000);

const attempts = new Map();

const getClientKey = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"];
  const rawIp =
    (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(",")[0]) ||
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown";
  const email = String(req.body?.email || "").trim().toLowerCase();

  return `${rawIp}:${email}`;
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
    res.set("Retry-After", String(retryAfter));
    return res.status(429).json({
      msg: "Too many login attempts. Try again later.",
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
