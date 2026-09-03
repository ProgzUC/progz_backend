import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./config/swagger.js";
import connectDB from "./config/db.js";
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
import { initCronJobs } from "./jobs/cronJobs.js";
import monitoringRoutes from "./routes/monitoringRoutes.js";
import { requestLogger } from "./middlewares/loggingMiddleware.js";
import { monitorMiddleware } from "./middlewares/monitorMiddleware.js";
import { errorHandler, registerProcessErrorHandlers } from "./middlewares/errorMiddleware.js";

dotenv.config();
registerProcessErrorHandlers();

const requiredEnvVars = ["JWT_SECRET", "REFRESH_TOKEN_SECRET"];
const missingEnvVars = requiredEnvVars.filter((key) => !process.env[key]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(", ")}`);
  process.exit(1);
}

connectDB();
console.log("Environment: MONGO_URI", process.env.MONGO_URI ? "set" : "missing");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const allowedOrigins = [
  ...(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  process.env.FRONTEND_URL,
  "https://progz.urbancode.in",
  "https://www.progz.urbancode.in",
  "http://localhost:5173",
]
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""));

const app = express();
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin / server-to-server / proxied requests may omit Origin
      if (!origin) {
        return callback(null, true);
      }

      const normalized = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalized)) {
        return callback(null, true);
      }

      // Do not throw — throwing becomes a 500 without CORS headers
      console.warn(`CORS rejected origin: ${origin}`);
      return callback(null, false);
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(monitorMiddleware);
app.use(requestLogger);

// Role-based docs (student / trainer / admin) from public/api-docs
app.use(express.static(path.join(__dirname, "public")));

// Auto-generated swagger from route annotations
app.use(
  "/api-docs-generated",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, { customSiteTitle: "Progz API — All (Generated)" })
);

app.get("/ping", (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "pong",
    time: new Date()
  });
});

// createOrUpdateAdmin();
app.use("/api/auth", authRoutes);
app.use("/auth", authRoutes); // compatibility alias for clients using /auth/login directly
app.use("/api/trainer", trainerRoutes)
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

// Debug: Log that class session routes are loaded
console.log("✅ Class session routes registered at /api/class-session");

// Test route to verify server is working
app.get("/api/test", (req, res) => {
    res.json({ message: "Server is working", timestamp: new Date() });
});

app.use(errorHandler);

initCronJobs();

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

