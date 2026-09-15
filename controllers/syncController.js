import { runCompleteSync, fetchZenTrainers } from "../services/syncService.js";
import SyncLog from "../models/SyncLog.js";
import { isZenConfigured } from "../services/apiClient.js";

const STALE_SYNC_MS = 15 * 60 * 1000;

const markStaleInProgressSyncs = async () => {
  const cutoff = new Date(Date.now() - STALE_SYNC_MS);
  await SyncLog.updateMany(
    { status: "in_progress", startTime: { $lt: cutoff } },
    {
      $set: {
        status: "failure",
        endTime: new Date(),
      },
      $push: {
        errorsList: "Marked stale: sync exceeded 15 minutes without completion",
      },
    }
  );
};

// @desc    Trigger manual sync with Zen system (runs in background)
// @route   POST /api/sync/manual
// @access  Private (Admin)
export const triggerSync = async (req, res) => {
  try {
    console.log("🔄 Manual sync triggered by admin:", req.user.email);

    if (!isZenConfigured()) {
      return res.status(500).json({
        message: "Sync failed",
        error: "ZEN_API_BASE_URL is required for Zen sync operations.",
      });
    }

    await markStaleInProgressSyncs();

    const inProgress = await SyncLog.findOne({ status: "in_progress" }).sort({
      startTime: -1,
    });
    if (inProgress) {
      return res.status(409).json({
        message: "A sync is already in progress",
        status: "in_progress",
        log: inProgress,
      });
    }

    const userId = req.user.id;
    const syncLog = await SyncLog.create({
      startTime: new Date(),
      triggerType: "manual",
      triggeredBy: userId,
      status: "in_progress",
    });

    // Return immediately so Vercel/browser proxies do not time out
    res.status(202).json({
      message: "Sync started",
      status: "in_progress",
      logId: syncLog._id,
    });

    runCompleteSync("manual", userId, null, syncLog).catch((error) => {
      console.error("Background sync failed:", error);
    });
  } catch (error) {
    console.error("Sync trigger failed:", error);
    if (!res.headersSent) {
      res.status(500).json({ message: "Sync failed", error: error.message });
    }
  }
};

// @desc    Get trainers raw from Zen
// @route   GET /api/sync/trainers
// @access  Private (Admin)
export const getZenTrainers = async (req, res) => {
  try {
    const trainers = await fetchZenTrainers();
    res.json(trainers);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch Zen trainers",
      error: error.message,
    });
  }
};

// @desc    Get synchronization logs history
// @route   GET /api/sync/logs
// @access  Private (Admin)
export const getSyncLogs = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const total = await SyncLog.countDocuments();
    const logs = await SyncLog.find()
      .populate("triggeredBy", "name email")
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      logs,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      totalLogs: total,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sync logs",
      error: error.message,
    });
  }
};

// @desc    Get latest synchronization status
// @route   GET /api/sync/status
// @access  Private (Admin)
export const getSyncStatus = async (req, res) => {
  try {
    const latestLog = await SyncLog.findOne()
      .populate("triggeredBy", "name email")
      .sort({ startTime: -1 });

    res.json(latestLog || { message: "No sync history available" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sync status",
      error: error.message,
    });
  }
};
