import { uploadToCloudinaryBuffer } from "../utils/cloudinaryClient.js";

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ msg: "No file provided" });
    }

    const folder = String(req.body.folder || "uploads").replace(/\.\./g, "");
    const result = await uploadToCloudinaryBuffer(
      req.file.buffer,
      folder,
      req.file.originalname
    );

    res.json({
      url: result.secure_url,
      publicId: result.public_id,
      fileType: result.resource_type,
      originalName: req.file.originalname,
    });
  } catch (error) {
    console.error("Cloudinary upload error:", error.message);
    res.status(500).json({ msg: "Upload failed", error: error.message });
  }
};
