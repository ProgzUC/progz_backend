import Notification from "../models/Notification.js";
import User from "../models/User.js";
import { sendError } from "../utils/apiError.js";
import {
  mergePrefs,
  sanitizePrefsPatch,
  serializeNotification,
} from "../services/notificationService.js";

export const listMyNotifications = async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    const unreadOnly = String(req.query.unread || "") === "true";
    const query = { user: req.user.id };
    if (unreadOnly) query.readAt = null;

    const [items, unreadCount] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      Notification.countDocuments({ user: req.user.id, readAt: null }),
    ]);

    return res.json({
      items: items.map(serializeNotification),
      unreadCount,
    });
  } catch (err) {
    console.error("listMyNotifications error", err);
    return sendError(res, 500, "Failed to load notifications");
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({
      user: req.user.id,
      readAt: null,
    });
    return res.json({ unreadCount });
  } catch (err) {
    console.error("getUnreadCount error", err);
    return sendError(res, 500, "Failed to load unread count");
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Notification.findOneAndUpdate(
      { _id: id, user: req.user.id, readAt: null },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!item) {
      const existing = await Notification.findOne({ _id: id, user: req.user.id });
      if (!existing) return sendError(res, 404, "Notification not found");
      return res.json({ notification: serializeNotification(existing) });
    }
    return res.json({ notification: serializeNotification(item) });
  } catch (err) {
    console.error("markNotificationRead error", err);
    return sendError(res, 500, "Failed to mark notification as read");
  }
};

export const markAllNotificationsRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    return res.json({
      msg: "All notifications marked as read",
      updated: result.modifiedCount || 0,
    });
  } catch (err) {
    console.error("markAllNotificationsRead error", err);
    return sendError(res, 500, "Failed to mark notifications as read");
  }
};

export const getMyPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("notificationPrefs").lean();
    if (!user) return sendError(res, 404, "User not found");
    return res.json({ prefs: mergePrefs(user.notificationPrefs) });
  } catch (err) {
    console.error("getMyPreferences error", err);
    return sendError(res, 500, "Failed to load notification preferences");
  }
};

export const updateMyPreferences = async (req, res) => {
  try {
    const patch = sanitizePrefsPatch(req.body);
    if (Object.keys(patch).length === 0) {
      return sendError(res, 400, "No valid preference fields provided");
    }

    const $set = {};
    for (const [key, value] of Object.entries(patch)) {
      $set[`notificationPrefs.${key}`] = value;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set },
      { new: true, select: "notificationPrefs" }
    ).lean();

    if (!user) return sendError(res, 404, "User not found");
    return res.json({
      msg: "Notification preferences saved",
      prefs: mergePrefs(user.notificationPrefs),
    });
  } catch (err) {
    console.error("updateMyPreferences error", err);
    return sendError(res, 500, "Failed to save notification preferences");
  }
};
