import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";
import authRoutes from "./routes/authRoutes.js";
import trainerRoutes from "./routes/trainerRoutes.js";
import courseRoutes from "./routes/courseRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import binRoutes from "./routes/binRoutes.js";
import syncRoutes from "./routes/syncRoutes.js";
import batchRoutes from "./routes/batchRoutes.js";
import studentRoutes from "./routes/studentRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import classSessionRoutes from "./routes/classSessionRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import monitoringRoutes from "./routes/monitoringRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import { requestLogger } from "./middlewares/loggingMiddleware.js";
import { monitorMiddleware } from "./middlewares/monitorMiddleware.js";
import { errorHandler } from "./middlewares/errorMiddleware.js";
import { globalApiRateLimit } from "./middlewares/rateLimit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const allowedOrigins = [
    ...(process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    process.env.FRONTEND_URL,
    "https://progz.urbancode.in",
    "https://www.progz.urbancode.in",
  ];

  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:5173");
  }

  const normalizedOrigins = allowedOrigins
    .filter(Boolean)
    .map((origin) => origin.replace(/\/$/, ""));

  const app = express();
  app.set("trust proxy", 1);

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        const normalized = origin.replace(/\/$/, "");
        if (normalizedOrigins.includes(normalized)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(cookieParser());

  const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "512kb";
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(express.urlencoded({ extended: false, limit: jsonBodyLimit }));
  app.use(globalApiRateLimit);
  app.use(monitorMiddleware);
  app.use(requestLogger);
  app.use(express.static(path.join(__dirname, "public")));
  app.use(
    "/api-docs-generated",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, { customSiteTitle: "Progz API — All (Generated)" })
  );

  app.get("/ping", (req, res) => {
    res.status(200).json({ status: "ok", message: "pong", time: new Date() });
  });

  app.use("/api/auth", authRoutes);
  app.use("/auth", authRoutes);
  app.use("/api/trainer", trainerRoutes);
  app.use("/api/courses", courseRoutes);
  app.use("/api/users", userRoutes);
  app.use("/api/bin", binRoutes);
  app.use("/api/sync", syncRoutes);
  app.use("/api/batches", batchRoutes);
  app.use("/api/student", studentRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/admin/reports", reportRoutes);
  app.use("/api/class-session", classSessionRoutes);
  app.use("/api/uploads", uploadRoutes);
  app.use("/api/admin/monitoring", monitoringRoutes);
  app.use("/api/notifications", notificationRoutes);

  app.get("/api/test", (req, res) => {
    res.json({ message: "Server is working", timestamp: new Date() });
  });

  app.use(errorHandler);
  return app;
}
