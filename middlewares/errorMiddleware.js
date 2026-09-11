import ErrorLog from "../models/ErrorLog.js";
import logger from "../utils/logger.js";
import { buildErrorBody, normalizeError } from "../utils/apiError.js";

// Global error handling middleware for Express
export const errorHandler = async (err, req, res, next) => {
  const normalized = normalizeError(err);
  const statusCode = normalized.statusCode || 500;
  const message = normalized.message || "An unexpected server error occurred";

  // Extract user details if logged in
  let userId = null;
  let userRole = null;
  if (req.user) {
    userId = req.user.id || req.user._id;
    userRole = req.user.role;
  }

  const method = req.method;
  const url = req.originalUrl;
  const ipAddress = req.ip || req.headers["x-forwarded-for"];

  // Log server errors (and unexpected failures) with Winston
  if (statusCode >= 500) {
    logger.error(`Error handling ${method} ${url}: ${message}`, {
      stack: err.stack,
      userId,
      userRole,
      ipAddress,
      method,
      url,
      code: normalized.code,
    });

    try {
      await ErrorLog.create({
        message,
        stack: err.stack,
        method,
        url,
        userId,
        userRole,
        ipAddress,
      });
    } catch (dbErr) {
      logger.error("Failed to save error to database:", dbErr);
    }
  } else {
    logger.warn(`Client error ${method} ${url}: ${message}`, {
      statusCode,
      code: normalized.code,
      userId,
      ipAddress,
    });
  }

  if (normalized.retryAfter != null) {
    res.set("Retry-After", String(normalized.retryAfter));
  }

  const body = buildErrorBody(message, {
    code: normalized.code,
    errors: normalized.errors,
    retryAfter: normalized.retryAfter,
  });

  if (process.env.NODE_ENV !== "production" && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

// Catch-all for uncaught exceptions and unhandled rejections
export const registerProcessErrorHandlers = () => {
  process.on("uncaughtException", async (error) => {
    logger.error("Uncaught Exception thrown:", error);
    try {
      await ErrorLog.create({
        message: `Uncaught Exception: ${error.message}`,
        stack: error.stack,
        method: "PROCESS",
        url: "UNCAUGHT_EXCEPTION",
      });
    } catch (e) {
      logger.error("Failed logging uncaughtException to DB", e);
    }
    // We should safely exit process in uncaught exception, PM2 or Nodemon will restart it.
    process.exit(1);
  });

  process.on("unhandledRejection", async (reason, promise) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    const stack = reason instanceof Error ? reason.stack : undefined;
    logger.error("Unhandled Rejection at Promise:", { promise, reason });
    try {
      await ErrorLog.create({
        message: `Unhandled Rejection: ${message}`,
        stack,
        method: "PROCESS",
        url: "UNHANDLED_REJECTION",
      });
    } catch (e) {
      logger.error("Failed logging unhandledRejection to DB", e);
    }
  });
};
