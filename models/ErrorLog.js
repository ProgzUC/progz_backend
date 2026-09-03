import mongoose from "mongoose";

const errorLogSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    stack: String,
    method: String,
    url: String,
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    userRole: String,
    ipAddress: String,
    resolved: { type: Boolean, default: false, index: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: Date,
  },
  { timestamps: { createdAt: "timestamp", updatedAt: true } }
);

errorLogSchema.index({ timestamp: -1 });

export default mongoose.model("ErrorLog", errorLogSchema);
