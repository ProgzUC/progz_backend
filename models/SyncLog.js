import mongoose from "mongoose";

const syncLogSchema = new mongoose.Schema(
  {
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date },
    status: { type: String, enum: ["success", "failure", "in_progress"], default: "in_progress", index: true },
    triggerType: { type: String, enum: ["manual", "scheduled"], required: true, index: true },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    instructorsSynced: { type: Number, default: 0 },
    studentsSynced: { type: Number, default: 0 },
    duplicatesDetected: { type: Number, default: 0 },
    executionTimeMs: { type: Number },
    errorsList: [{ type: String }]
  },
  { timestamps: true }
);

syncLogSchema.index({ createdAt: -1 });

export default mongoose.model("SyncLog", syncLogSchema);
