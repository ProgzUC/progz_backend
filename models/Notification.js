import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "approval",
  "rejection",
  "pending_approval",
  "batch_assignment",
  "class_reminder",
  "attendance_warning",
  "admin_event",
];

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: "", trim: true },
    link: { type: String, default: "" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    channels: {
      type: [String],
      enum: ["in_app", "email"],
      default: ["in_app"],
    },
    readAt: { type: Date, default: null, index: true },
    emailStatus: {
      type: String,
      enum: ["skipped", "pending", "sent", "failed"],
      default: "skipped",
    },
    emailError: { type: String, default: "" },
    dedupKey: { type: String, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1, createdAt: -1 });
notificationSchema.index(
  { user: 1, dedupKey: 1 },
  { unique: true, partialFilterExpression: { dedupKey: { $type: "string" } } }
);

notificationSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 90 * 24 * 60 * 60 }
);

export default mongoose.model("Notification", notificationSchema);
