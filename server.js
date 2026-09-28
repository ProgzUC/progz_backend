import dotenv from "dotenv";
import connectDB from "./config/db.js";
import { createApp } from "./app.js";
import { initCronJobs } from "./jobs/cronJobs.js";
import { registerProcessErrorHandlers } from "./middlewares/errorMiddleware.js";
import createOrUpdateAdmin from "./utils/createOrUpdateAdmin.js";

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

const app = createApp();
createOrUpdateAdmin();

console.log("✅ Class session routes registered at /api/class-session");

initCronJobs();

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
