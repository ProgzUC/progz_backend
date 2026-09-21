import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    audience: {
      type: String,
      enum: ["all", "students", "trainers", "custom"],
      default: "all",
    },
    extraEmails: [{ type: String, trim: true, lowercase: true }],
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    academyName: { type: String, default: "ProgZ" },
    emailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    emailStats: {
      total: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

announcementSchema.index({ active: 1, audience: 1, createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
