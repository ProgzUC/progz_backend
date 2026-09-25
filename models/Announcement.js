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
    /** portal = academy-wide (admin); batch = trainer → selected students */
    scope: {
      type: String,
      enum: ["portal", "batch"],
      default: "portal",
      index: true,
    },
    batch: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Batch",
      default: null,
      index: true,
    },
    /** Selected student user ids (batch-scoped announcements) */
    recipientIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    extraEmails: [{ type: String, trim: true, lowercase: true }],
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    academyName: { type: String, default: "ProgZ" },
    emailStatus: {
      type: String,
      enum: ["pending", "sending", "sent", "failed", "skipped"],
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
announcementSchema.index({ scope: 1, batch: 1, createdAt: -1 });
announcementSchema.index({ recipientIds: 1, active: 1, createdAt: -1 });

export default mongoose.model("Announcement", announcementSchema);
