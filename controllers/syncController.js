import { runCompleteSync, fetchZenTrainers } from "../services/syncService.js";
import SyncLog from "../models/SyncLog.js";

// @desc    Trigger manual sync with Zen system
// @route   POST /api/sync/manual
// @access  Private (Admin)
export const triggerSync = async (req, res) => {
    try {
        console.log('🔄 Manual sync triggered by admin:', req.user.email);

        const syncLog = await runCompleteSync("manual", req.user.id, req);

        res.json({ 
            message: "Sync completed successfully", 
            status: syncLog.status,
            log: syncLog
        });
    } catch (error) {
        console.error("Sync failed:", error);
        res.status(500).json({ message: "Sync failed", error: error.message });
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
        res.status(500).json({ message: "Failed to fetch Zen trainers", error: error.message });
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
            totalLogs: total
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch sync logs", error: error.message });
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
        res.status(500).json({ message: "Failed to fetch sync status", error: error.message });
    }
};
