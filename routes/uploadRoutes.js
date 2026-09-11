import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { uploadFile } from "../controllers/uploadController.js";
import { submissionRateLimit } from "../middlewares/rateLimit.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("admin", "trainer", "student"),
  submissionRateLimit,
  upload.single("file"),
  uploadFile
);

export default router;
