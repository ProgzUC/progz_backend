import User from "../models/User.js";
import Notification from "../models/Notification.js";
import sendEmail from "../utils/sendEmail.js";
import logger from "../utils/logger.js";

export const NOTIFICATION_TYPES = {
  APPROVAL: "approval",
  REJECTION: "rejection",
  PENDING_APPROVAL: "pending_approval",
  BATCH_ASSIGNMENT: "batch_assignment",
  CLASS_REMINDER: "class_reminder",
  ATTENDANCE_WARNING: "attendance_warning",
  ADMIN_EVENT: "admin_event",
};

export const DEFAULT_PREFS = {
  inAppEnabled: true,
  emailEnabled: true,
  approvalAlerts: true,
  batchAssignment: true,
  classReminders: true,
  attendanceWarnings: true,
  adminEvents: true,
  emailDigest: true,
};

const TYPE_PREF_KEY = {
  [NOTIFICATION_TYPES.APPROVAL]: "approvalAlerts",
  [NOTIFICATION_TYPES.REJECTION]: "approvalAlerts",
  [NOTIFICATION_TYPES.PENDING_APPROVAL]: "approvalAlerts",
  [NOTIFICATION_TYPES.BATCH_ASSIGNMENT]: "batchAssignment",
  [NOTIFICATION_TYPES.CLASS_REMINDER]: "classReminders",
  [NOTIFICATION_TYPES.ATTENDANCE_WARNING]: "attendanceWarnings",
  [NOTIFICATION_TYPES.ADMIN_EVENT]: "adminEvents",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TYPE_LABELS = {
  approval: "Account approved",
  rejection: "Registration update",
  pending_approval: "Approval needed",
  batch_assignment: "Batch assignment",
  class_reminder: "Class reminder",
  attendance_warning: "Attendance warning",
  admin_event: "Academy notice",
};

export const mergePrefs = (raw = {}) => {
  const src = raw && typeof raw.toObject === "function" ? raw.toObject() : raw || {};
  return {
    inAppEnabled: src.inAppEnabled !== false,
    emailEnabled: src.emailEnabled !== false,
    approvalAlerts: src.approvalAlerts !== false,
    batchAssignment: src.batchAssignment !== false,
    classReminders: src.classReminders !== false,
    attendanceWarnings: src.attendanceWarnings !== false,
    adminEvents: src.adminEvents !== false,
    emailDigest: src.emailDigest !== false,
  };
};

export const sanitizePrefsPatch = (body = {}) => {
  const next = {};
  for (const key of Object.keys(DEFAULT_PREFS)) {
    if (typeof body[key] === "boolean") next[key] = body[key];
  }
  return next;
};

const portalBase = () =>
  String(process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

const academyName = () =>
  String(process.env.SMTP_FROM_NAME || "ProgZ Academy").trim() || "ProgZ Academy";

export const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const channelAllowed = (prefs, type, channel) => {
  const typeKey = TYPE_PREF_KEY[type];
  if (typeKey && prefs[typeKey] === false) return false;
  if (channel === "in_app") return prefs.inAppEnabled !== false;
  if (channel === "email") return prefs.emailEnabled !== false;
  return true;
};

const absoluteLink = (link) => {
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `${portalBase()}${link.startsWith("/") ? link : `/${link}`}`;
};

const buildMail = ({ name, title, body, link, type }) => {
  const academy = academyName();
  const greeting = name ? `Hi ${name},` : "Hi,";
  const cta = link
    ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(absoluteLink(link))}" style="display:inline-block;padding:10px 16px;background:#064E3B;color:#ffffff;text-decoration:none;border-radius:8px;font-family:Arial,sans-serif;font-size:14px;">Open portal</a></p>`
    : "";
  const textCta = link ? `\n\nOpen: ${absoluteLink(link)}` : "";

  return {
    subject: `${title} — ${academy}`,
    message: `${greeting}\n\n${title}\n\n${body || ""}${textCta}\n\nThanks,\nThe ${academy} team\n`,
    html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#ffffff;color:#111827;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;">
    <p style="margin:0 0 16px;">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 4px;font-size:12px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;font-family:Arial,sans-serif;">${escapeHtml(TYPE_LABELS[type] || "Notice")}</p>
    <p style="margin:0 0 8px;"><strong>${escapeHtml(title)}</strong></p>
    <p style="margin:0 0 8px;">${escapeHtml(body || "Please check the portal for details.").replace(/\n/g, "<br/>")}</p>
    ${cta}
    <p style="margin:24px 0 0;">Thanks,<br/>The ${escapeHtml(academy)} team</p>
    <p style="margin:16px 0 0;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">
      You received this email because of your ${escapeHtml(academy)} notification settings.
    </p>
  </body>
</html>`,
  };
};

const loadUsers = async (userIds = []) => {
  const ids = [...new Set(userIds.map(String).filter(Boolean))];
  if (!ids.length) return [];
  return User.find({ _id: { $in: ids } })
    .select("_id name email role notificationPrefs")
    .lean();
};

const sendOneEmail = async ({ email, name, title, body, link, type }) => {
  if (!EMAIL_RE.test(String(email || "").trim().toLowerCase())) {
    throw new Error("Invalid recipient email");
  }
  if (!process.env.SMTP_HOST?.trim() || !process.env.SMTP_USER?.trim() || !process.env.SMTP_PASS?.trim()) {
    throw new Error("SMTP is not configured");
  }
  const mail = buildMail({ name, title, body, link, type });
  await sendEmail({
    email: String(email).trim().toLowerCase(),
    subject: mail.subject,
    message: mail.message,
    html: mail.html,
  });
};

/**
 * Central dispatcher. Creates in-app rows and/or sends email per recipient prefs.
 * recipients: [{ userId }] or User-like objects, or a mix.
 */
export async function dispatch({
  recipients = [],
  userIds,
  type,
  title,
  body = "",
  link = "",
  metadata = {},
  channels = ["in_app", "email"],
  dedupKey = null,
  ignorePrefs = false,
  emailPrefKey = null,
} = {}) {
  if (!type || !title) {
    throw new Error("Notification type and title are required");
  }

  const wanted = new Set(channels);
  const ids = userIds || recipients.map((r) => r.userId || r._id || r.id).filter(Boolean);
  const users = await loadUsers(ids);
  const created = [];

  for (const user of users) {
    const prefs = mergePrefs(user.notificationPrefs);
    const inApp = wanted.has("in_app") && (ignorePrefs || channelAllowed(prefs, type, "in_app"));
    const email =
      wanted.has("email") &&
      (ignorePrefs ||
        (channelAllowed(prefs, type, "email") &&
          (emailPrefKey ? prefs[emailPrefKey] !== false : true)));

    if (!inApp && !email) continue;

    const key = dedupKey ? `${String(user._id)}:${dedupKey}` : null;
    if (key) {
      const existing = await Notification.findOne({ user: user._id, dedupKey: key }).select("_id").lean();
      if (existing) continue;
    }

    let emailStatus = email ? "pending" : "skipped";
    let emailError = "";

    if (email) {
      try {
        await sendOneEmail({
          email: user.email,
          name: user.name,
          title,
          body,
          link,
          type,
        });
        emailStatus = "sent";
      } catch (err) {
        emailStatus = "failed";
        emailError = err.message || "Email failed";
        logger.warn("Notification email failed", {
          type,
          email: user.email,
          error: emailError,
        });
      }
    }

    if (inApp || email) {
      try {
        const doc = await Notification.create({
          user: user._id,
          type,
          title,
          body,
          link,
          metadata,
          channels: [
            ...(inApp ? ["in_app"] : []),
            ...(email ? ["email"] : []),
          ],
          emailStatus,
          emailError,
          ...(key ? { dedupKey: key } : {}),
        });
        created.push(doc);
      } catch (err) {
        if (err?.code === 11000) continue;
        logger.error("Failed to persist in-app notification", {
          type,
          userId: String(user._id),
          error: err.message,
        });
      }
    }
  }

  return { created: created.length, recipients: users.length };
}

export async function dispatchEmailOnly({ email, name, type, title, body = "", link = "" }) {
  try {
    await sendOneEmail({ email, name, title, body, link, type });
    return { sent: true };
  } catch (err) {
    logger.warn("Standalone notification email failed", {
      type,
      email,
      error: err.message,
    });
    return { sent: false, error: err.message };
  }
}

export function notifyQuiet(payload) {
  setImmediate(() => {
    dispatch(payload).catch((err) => {
      logger.error("Notification dispatch failed", {
        type: payload?.type,
        error: err.message,
      });
    });
  });
}

export async function findAdminIds() {
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  return admins.map((u) => u._id);
}

export function notifyAdminsQuiet(payload) {
  setImmediate(() => {
    findAdminIds()
      .then((userIds) => dispatch({ ...payload, userIds }))
      .catch((err) => {
        logger.error("Admin notification dispatch failed", {
          type: payload?.type,
          error: err.message,
        });
      });
  });
}

export function roleHomeLink(role) {
  const normalized = String(role || "").toLowerCase();
  if (normalized === "admin") return "/admin/overview";
  if (normalized === "trainer" || normalized === "instructor") return "/trainer-dashboard";
  return "/student-dashboard/";
}

export function notifyUserApproved(user) {
  if (!user?._id) return;
  notifyQuiet({
    userIds: [user._id],
    type: NOTIFICATION_TYPES.APPROVAL,
    title: "Your account has been approved",
    body: `Hi ${user.name || "there"}, your ${user.role || "academy"} account is ready. You can sign in and get started.`,
    link: roleHomeLink(user.role),
    metadata: { role: user.role },
  });
}

export function notifyUserRejected({ email, name, role }) {
  dispatchEmailOnly({
    email,
    name,
    type: NOTIFICATION_TYPES.REJECTION,
    title: "Registration was not approved",
    body: `Hi ${name || "there"}, your ${role || "academy"} registration was not approved. If you think this is a mistake, reply to this email or contact the academy.`,
    link: "/login",
  }).catch(() => {});
}

export function notifyRegistrationPending(pendingUser) {
  if (!pendingUser) return;
  notifyAdminsQuiet({
    type: NOTIFICATION_TYPES.PENDING_APPROVAL,
    title: "New registration needs review",
    body: `${pendingUser.name || pendingUser.email} requested a ${pendingUser.role || "user"} account.`,
    link: "/admin/approve-users",
    metadata: {
      pendingUserId: String(pendingUser._id),
      email: pendingUser.email,
      role: pendingUser.role,
    },
    dedupKey: `pending_approval:${pendingUser._id}`,
  });
}

export function notifyBatchAssigned({ users = [], batch, assignedAs = "student" }) {
  const list = (users || []).filter(Boolean);
  if (!list.length || !batch) return;

  const timing = batch.classTiming
    ? `${batch.classTiming.startTime || ""}–${batch.classTiming.endTime || ""}`.replace(/^–|–$/g, "")
    : "";
  const days = Array.isArray(batch.daysOfWeek) && batch.daysOfWeek.length
    ? batch.daysOfWeek.join(", ")
    : "";
  const schedule = [days, timing].filter(Boolean).join(" · ");
  const meet = batch.meetLink ? ` Class link: ${batch.meetLink}` : "";
  const roleLabel = assignedAs === "trainer" ? "trainer" : "student";

  notifyQuiet({
    userIds: list.map((u) => u._id || u),
    type: NOTIFICATION_TYPES.BATCH_ASSIGNMENT,
    title: `You were added to ${batch.name}`,
    body: `You are assigned as a ${roleLabel} in batch "${batch.name}".${schedule ? ` Schedule: ${schedule}.` : ""}${meet}`,
    link: assignedAs === "trainer" ? "/trainer-dashboard" : "/student-dashboard/my-courses",
    metadata: {
      batchId: String(batch._id),
      batchName: batch.name,
      assignedAs,
    },
  });
}

export function notifyBatchRemoved({ users = [], batch }) {
  const list = (users || []).filter(Boolean);
  if (!list.length || !batch) return;
  notifyQuiet({
    userIds: list.map((u) => u._id || u),
    type: NOTIFICATION_TYPES.ADMIN_EVENT,
    title: `Removed from ${batch.name}`,
    body: `You are no longer in batch "${batch.name}". Contact your academy admin if this looks wrong.`,
    link: roleHomeLink("student"),
    metadata: { batchId: String(batch._id), batchName: batch.name },
  });
}

export function notifyBatchStatusChanged({ batch, previousStatus, userIds = [] }) {
  if (!batch || !userIds.length || previousStatus === batch.status) return;
  const status = batch.status;
  notifyQuiet({
    userIds,
    type: NOTIFICATION_TYPES.ADMIN_EVENT,
    title: `${batch.name} is now ${status}`,
    body: `Batch "${batch.name}" changed from ${previousStatus || "previous status"} to ${status}.`,
    link: "/student-dashboard/",
    metadata: {
      batchId: String(batch._id),
      previousStatus,
      status,
    },
  });
}

export function notifyAnnouncementInApp({ userIds = [], title, body, announcementId }) {
  if (!userIds.length) return;
  notifyQuiet({
    userIds,
    type: NOTIFICATION_TYPES.ADMIN_EVENT,
    title,
    body: body || "A new academy notice was published.",
    link: "",
    channels: ["in_app"],
    metadata: { announcementId },
  });
}

export function notifySyncFailed(syncLog) {
  notifyAdminsQuiet({
    type: NOTIFICATION_TYPES.ADMIN_EVENT,
    title: "Zen sync failed",
    body: `A ${syncLog?.triggerType || "scheduled"} Zen CRM sync did not finish cleanly. Check Monitoring for details.`,
    link: "/admin/monitoring",
    metadata: { syncLogId: String(syncLog?._id || "") },
    channels: ["in_app"],
  });
}

export const serializeNotification = (doc) => {
  const item = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(item._id),
    type: item.type,
    title: item.title,
    body: item.body || "",
    link: item.link || "",
    metadata: item.metadata || {},
    channels: item.channels || [],
    read: Boolean(item.readAt),
    readAt: item.readAt || null,
    createdAt: item.createdAt,
  };
};
