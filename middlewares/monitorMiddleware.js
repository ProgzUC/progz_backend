import metricsTracker from "../utils/metricsTracker.js";

export const monitorMiddleware = (req, res, next) => {
  // Do not log the metrics endpoint itself to avoid polluting stats
  if (req.originalUrl.includes("/monitoring")) {
    return next();
  }

  const start = Date.now();

  res.on("finish", () => {
    const latency = Date.now() - start;
    metricsTracker.recordRequest(
      req.method,
      req.originalUrl,
      res.statusCode,
      latency
    );
  });

  next();
};
