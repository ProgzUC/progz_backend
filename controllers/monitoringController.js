import AuditLog from "../models/AuditLog.js";
import ErrorLog from "../models/ErrorLog.js";
import SystemMetric from "../models/SystemMetric.js";
import metricsTracker from "../utils/metricsTracker.js";
import { logAuditAction } from "../utils/auditLogger.js";

// @desc    Get live system metrics
// @route   GET /api/admin/monitoring/metrics
// @access  Private (Admin)
export const getSystemMetrics = async (req, res) => {
  try {
    const liveStats = metricsTracker.getMetrics();
    res.json(liveStats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch metrics", error: error.message });
  }
};

// @desc    Get filterable audit logs
// @route   GET /api/admin/monitoring/audit-logs
// @access  Private (Admin)
export const getAuditLogs = async (req, res) => {
  try {
    const { action, email, role, search, startDate, endDate, page = 1, limit = 20 } = req.query;

    const query = {};

    if (action) query.action = action;
    if (email) query.userEmail = { $regex: email, $options: "i" };
    if (role) query.userRole = role;
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: "i" } },
        { userEmail: { $regex: search, $options: "i" } },
        { action: { $regex: search, $options: "i" } },
        { targetType: { $regex: search, $options: "i" } },
        { targetId: { $regex: search, $options: "i" } }
      ];
    }

    const skipIndex = (page - 1) * limit;
    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    res.json({
      logs,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalLogs: total
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch audit logs", error: error.message });
  }
};

// @desc    Get error logs
// @route   GET /api/admin/monitoring/error-logs
// @access  Private (Admin)
export const getErrorLogs = async (req, res) => {
  try {
    const { resolved, search, page = 1, limit = 20 } = req.query;

    const query = {};
    if (resolved !== undefined) {
      query.resolved = resolved === "true";
    }
    if (search) {
      query.$or = [
        { message: { $regex: search, $options: "i" } },
        { url: { $regex: search, $options: "i" } },
        { method: { $regex: search, $options: "i" } },
        { userRole: { $regex: search, $options: "i" } }
      ];
    }

    const skipIndex = (page - 1) * limit;
    const total = await ErrorLog.countDocuments(query);
    const logs = await ErrorLog.find(query)
      .populate("userId", "name email")
      .populate("resolvedBy", "name email")
      .sort({ timestamp: -1 })
      .skip(skipIndex)
      .limit(Number(limit));

    res.json({
      logs,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
      totalErrors: total
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch error logs", error: error.message });
  }
};

// @desc    Toggle resolution of an error log
// @route   PUT /api/admin/monitoring/error-logs/:id/resolve
// @access  Private (Admin)
export const resolveErrorLog = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolved } = req.body;

    const errorLog = await ErrorLog.findById(id);
    if (!errorLog) {
      return res.status(404).json({ message: "Error log not found" });
    }

    errorLog.resolved = resolved;
    if (resolved) {
      errorLog.resolvedBy = req.user.id;
      errorLog.resolvedAt = new Date();
    } else {
      errorLog.resolvedBy = undefined;
      errorLog.resolvedAt = undefined;
    }

    await errorLog.save();

    await logAuditAction({
      req,
      action: resolved ? "resolve_error" : "unresolve_error",
      targetType: "ErrorLog",
      targetId: id,
      details: { errorMessage: errorLog.message }
    });

    res.json({ message: `Error log marked as ${resolved ? 'resolved' : 'unresolved'}`, errorLog });
  } catch (error) {
    res.status(500).json({ message: "Failed to update error log", error: error.message });
  }
};

// @desc    Delete an error log entry
// @route   DELETE /api/admin/monitoring/error-logs/:id
// @access  Private (Admin)
export const deleteErrorLog = async (req, res) => {
  try {
    const { id } = req.params;
    const errorLog = await ErrorLog.findByIdAndDelete(id);

    if (!errorLog) {
      return res.status(404).json({ message: "Error log not found" });
    }

    await logAuditAction({
      req,
      action: "delete_error_log",
      targetType: "ErrorLog",
      targetId: id,
      details: { errorMessage: errorLog.message }
    });

    res.json({ message: "Error log entry deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to delete error log", error: error.message });
  }
};

// @desc    Get historical system metrics for graphs
// @route   GET /api/admin/monitoring/historical
// @access  Private (Admin)
export const getHistoricalMetrics = async (req, res) => {
  try {
    const hours = Number(req.query.hours || 24);
    const dateLimit = new Date(Date.now() - hours * 60 * 60 * 1000);

    const metrics = await SystemMetric.find({ timestamp: { $gte: dateLimit } })
      .sort({ timestamp: 1 });

    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch historical metrics", error: error.message });
  }
};
