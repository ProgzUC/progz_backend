import express from "express";
import { protect, authorizeRoles } from "../middlewares/authMiddleware.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { uploadFile } from "../controllers/uploadController.js";

const router = express.Router();

router.post(
  "/",
  protect,
  authorizeRoles("admin", "trainer", "student"),
  upload.single("file"),
  uploadFile
);

export default router;
