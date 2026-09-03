import ErrorLog from "../models/ErrorLog.js";
import logger from "../utils/logger.js";

// Global error handling middleware for Express
export const errorHandler = async (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const message = err.message || "An unexpected server error occurred";
  
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

  // Log error using Winston (structured)
  logger.error(`Error handling ${method} ${url}: ${message}`, {
    stack: err.stack,
    userId,
    userRole,
    ipAddress,
    method,
    url,
  });

  // Save error trace to MongoDB
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

  // Send JSON response to client
  res.status(statusCode).json({
    msg: message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
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
