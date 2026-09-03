import AuditLog from "../models/AuditLog.js";
import logger from "./logger.js";

/**
 * Log an administrative action to MongoDB and structured console logs.
 * @param {Object} options
 * @param {Object} [options.req] - Express request object to extract actor/IP/useragent details
 * @param {String} options.action - The action name (e.g. "approve_user", "delete_course")
 * @param {String} options.targetType - The type of target entity ("User", "Course", "Batch", "Sync")
 * @param {String} [options.targetId] - The ID of the affected resource
 * @param {Object} [options.details] - Arbitrary change details
 * @param {Object} [options.actorOverride] - Custom actor details if req is not available (e.g. background job)
 */
export const logAuditAction = async ({
  req,
  action,
  targetType,
  targetId,
  details = {},
  actorOverride
}) => {
  try {
    let userId = null;
    let userName = "System";
    let userEmail = "system@progz.tech";
    let userRole = "system";
    let ipAddress = "127.0.0.1";
    let userAgent = "Progz System";

    if (req) {
      ipAddress = req.ip || req.headers["x-forwarded-for"] || ipAddress;
      userAgent = req.headers["user-agent"] || userAgent;

      if (req.user) {
        userId = req.user.id || req.user._id;
        userName = req.user.name || userName;
        userEmail = req.user.email || userEmail;
        userRole = req.user.role || userRole;
      }
    }

    if (actorOverride) {
      if (actorOverride.id) userId = actorOverride.id;
      if (actorOverride.name) userName = actorOverride.name;
      if (actorOverride.email) userEmail = actorOverride.email;
      if (actorOverride.role) userRole = actorOverride.role;
    }

    // Save to Database
    const auditEntry = await AuditLog.create({
      userId,
      userName,
      userEmail,
      userRole,
      action,
      targetType,
      targetId: targetId ? String(targetId) : undefined,
      details,
      ipAddress,
      userAgent
    });

    // Log using Winston
    logger.info(`Audit action recorded: ${action} on ${targetType} (${targetId || 'N/A'}) by ${userEmail}`, {
      auditLogId: auditEntry._id,
      userId,
      userEmail,
      action,
      targetType,
      targetId,
      details
    });

    return auditEntry;
  } catch (error) {
    logger.error("Failed to write audit log:", error);
  }
};
