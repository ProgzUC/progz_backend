import mongoose from "mongoose";

const systemMetricSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true, index: true },
    requestCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    clientErrorCount: { type: Number, default: 0 },
    serverErrorCount: { type: Number, default: 0 },
    averageLatency: { type: Number, default: 0 },
    cpuUsage: { type: Number, default: 0 },
    memoryUsage: { type: Number, default: 0 },
  }
);

systemMetricSchema.index({ timestamp: -1 });

export default mongoose.model("SystemMetric", systemMetricSchema);
