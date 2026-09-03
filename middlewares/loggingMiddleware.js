import logger from "../utils/logger.js";

export const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Listen to response finish event
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { method, originalUrl, ip } = req;
    const { statusCode } = res;
    
    const logData = {
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      ip,
      userAgent: req.headers["user-agent"],
    };

    if (req.user) {
      logData.userId = req.user.id;
      logData.userRole = req.user.role;
      logData.userEmail = req.user.email;
    }

    if (statusCode >= 500) {
      logger.error(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logData);
    } else {
      logger.info(`HTTP ${method} ${originalUrl} ${statusCode} - ${duration}ms`, logData);
    }
  });

  next();
};
