import winston from "winston";

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "progz-backend" },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// If in production, log JSON directly to Console for log aggregators
if (process.env.NODE_ENV === "production") {
  logger.transports[0].format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  );
}

export default logger;
