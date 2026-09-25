import mongoose from "mongoose";
import User from "../models/User.js";
import Batch from "../models/Batch.js";
import Announcement from "../models/Announcement.js";
import sendEmail from "../utils/sendEmail.js";
import { notifyAnnouncementInApp } from "../services/notificationService.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SYNC_SEND_LIMIT = 25;

const parseEmails = (raw) => {
  const values = Array.isArray(raw) ? raw : String(raw || "").split(/[,;]+/);
  return [
    ...new Set(
      values
        .map((v) => String(v || "").trim().toLowerCase())
        .filter((email) => EMAIL_RE.test(email))
    ),
  ];
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const toIdList = (raw) => {
  const values = Array.isArray(raw) ? raw : raw != null ? [raw] : [];
  return [
    ...new Set(
      values
        .map((v) => String(v?._id || v || "").trim())
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    ),
  ];
};

const serializeAnnouncement = (doc) => {
  const item = typeof doc.toObject === "function" ? doc.toObject() : doc;
  const recipientIds = (item.recipientIds || []).map((id) => String(id));
  return {
    id: String(item._id),
    title: item.title,
    body: item.body || "",
    audience: item.audience,
    scope: item.scope || "portal",
    batchId: item.batch ? String(item.batch) : null,
    recipientIds,
    recipientCount: recipientIds.length,
    recipients: Array.isArray(item.recipients)
      ? item.recipients.map((u) => ({
          id: String(u._id || u.id),
          name: u.name || "",
          email: u.email || "",
        }))
      : undefined,
    extraEmails: item.extraEmails || [],
    active: item.active !== false,
    emailStatus: item.emailStatus,
    emailStats: item.emailStats || { total: 0, sent: 0, failed: 0 },
    academyName: item.academyName,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
};

const assertTrainerOwnsBatch = async (batchId, trainerId) => {
  if (!mongoose.Types.ObjectId.isValid(batchId)) return null;
  return Batch.findOne({
    _id: batchId,
    "trainers.trainer": trainerId,
  })
    .select("students name")
    .lean();
};

const rolesForAudience = (audience) => {
  if (audience === "all") return ["student", "trainer"];
  if (audience === "students") return ["student"];
  if (audience === "trainers") return ["trainer"];
  return [];
};

const emailsForAudience = async (audience) => {
  const roles = rolesForAudience(audience);
  if (roles.length === 0) return [];

  const users = await User.find({
    role: { $in: roles },
    email: { $exists: true, $nin: [null, ""] },
  })
    .select("email")
    .lean();

  return [
    ...new Set(
      users
        .map((user) => String(user.email || "").trim().toLowerCase())
        .filter((email) => EMAIL_RE.test(email))
    ),
  ];
};

const buildAnnouncementMail = ({ title, body, academy }) => {
  const safeTitle = escapeHtml(title);
  const safeAcademy = escapeHtml(academy);
  const safeBody = escapeHtml(body || "Please check the portal for details.").replace(
    /\n/g,
    "<br/>"
  );

  return {
    subject: `${title} — ${academy}`,
    message: `Hi,\n\nThis is a note from ${academy}.\n\n${title}\n\n${body || "Please check the portal for details."}\n\nThanks,\nThe ${academy} team\n`,
    html: `
<!DOCTYPE html>
<html>
  <body style="margin:0;padding:24px;background:#ffffff;color:#111827;font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.6;">
    <p style="margin:0 0 16px;">Hi,</p>
    <p style="margin:0 0 16px;">This is a note from ${safeAcademy}.</p>
    <p style="margin:0 0 8px;"><strong>${safeTitle}</strong></p>
    <p style="margin:0 0 24px;">${safeBody}</p>
    <p style="margin:0 0 24px;">Thanks,<br/>The ${safeAcademy} team</p>
    <p style="margin:0;font-size:12px;color:#6b7280;font-family:Arial,sans-serif;">
      You received this email because a notice was sent to you from the ${safeAcademy} portal.
    </p>
  </body>
</html>`,
  };
};

const deliverAnnouncementEmails = async ({ emails, title, body, academy }) => {
  const mail = buildAnnouncementMail({ title, body, academy });
  let sent = 0;
  let failed = 0;

  for (const email of emails) {
    try {
      await sendEmail({
        email,
        subject: mail.subject,
        message: mail.message,
        html: mail.html,
        fromName: academy,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      console.error("Announcement email failed", email, err.message);
    }
  }

  return { total: emails.length, sent, failed };
};

const audienceQueryForRole = (role) => {
  if (role === "trainer") {
    return { $in: ["all", "trainers"] };
  }
  if (role === "student") {
    return { $in: ["all", "students"] };
  }
  return { $in: ["all"] };
};

export const getAnnouncementRecipients = async (req, res) => {
  try {
    const audience = String(req.query.audience || "all").trim();
    const extraEmails = parseEmails(req.query.email || req.query.emails);
    const audienceEmails = await emailsForAudience(audience);
    const emails = [...new Set([...audienceEmails, ...extraEmails])];
    return res.json({
      audience,
      count: emails.length,
      audienceCount: audienceEmails.length,
      extraCount: extraEmails.length,
    });
  } catch (err) {
    console.error("getAnnouncementRecipients error", err);
    return res.status(500).json({ message: "Failed to count recipients" });
  }
};

export const listAdminAnnouncements = async (req, res) => {
  try {
    const items = await Announcement.find().sort({ createdAt: -1 }).limit(100).lean();
    return res.json({ items: items.map(serializeAnnouncement) });
  } catch (err) {
    console.error("listAdminAnnouncements error", err);
    return res.status(500).json({ message: "Failed to load announcements" });
  }
};

export const createAnnouncement = async (req, res) => {
  try {
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const audience = String(req.body?.audience || "all").trim();
    const academy = String(req.body?.academyName || "ProgZ").trim() || "ProgZ";
    const extraEmails = parseEmails(req.body?.email || req.body?.emails || req.body?.extraEmails);

    if (!title) {
      return res.status(400).json({ message: "Announcement title is required" });
    }
    if (!["all", "students", "trainers", "custom"].includes(audience)) {
      return res.status(400).json({ message: "Choose a valid audience" });
    }
    if (audience === "custom" && extraEmails.length === 0) {
      return res.status(400).json({ message: "Add at least one email for a specific send" });
    }

    const audienceEmails = await emailsForAudience(audience);
    const emails = [...new Set([...audienceEmails, ...extraEmails])];

    if (emails.length === 0) {
      return res.status(400).json({
        message: "No recipients found. Add an email or pick an audience that has users.",
      });
    }

    const announcement = await Announcement.create({
      title,
      body,
      audience,
      scope: "portal",
      extraEmails,
      active: true,
      createdBy: req.user?.id,
      academyName: academy,
      emailStatus: "sending",
      emailStats: { total: emails.length, sent: 0, failed: 0 },
    });

    const inAppQuery =
      audience === "custom"
        ? { email: { $in: extraEmails } }
        : { role: { $in: rolesForAudience(audience) } };
    const inAppUsers = await User.find(inAppQuery).select("_id").lean();
    notifyAnnouncementInApp({
      userIds: inAppUsers.map((u) => u._id),
      title,
      body,
      announcementId: announcement._id,
    });

    const finishSend = async () => {
      const stats = await deliverAnnouncementEmails({
        emails,
        title,
        body,
        academy,
      });
      announcement.emailStats = stats;
      announcement.emailStatus = stats.failed === stats.total ? "failed" : "sent";
      announcement.markModified("emailStats");
      await announcement.save();
      return stats;
    };

    if (emails.length <= SYNC_SEND_LIMIT) {
      const stats = await finishSend();
      return res.status(201).json({
        message:
          stats.failed === 0
            ? `Announcement published and emailed to ${stats.sent} recipient${stats.sent === 1 ? "" : "s"}`
            : `Announcement published. Sent ${stats.sent}, failed ${stats.failed}`,
        announcement: serializeAnnouncement(announcement),
        queued: false,
      });
    }

    finishSend().catch((err) => {
      console.error("Background announcement send failed", err);
    });

    return res.status(201).json({
      message: `Announcement published. Emails are sending to ${emails.length} recipients.`,
      announcement: serializeAnnouncement(announcement),
      queued: true,
    });
  } catch (err) {
    console.error("createAnnouncement error", err);
    return res.status(500).json({
      message: err.message || "Failed to publish announcement",
    });
  }
};

export const updateAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    if (typeof req.body?.active === "boolean") {
      announcement.active = req.body.active;
    }
    if (typeof req.body?.title === "string" && req.body.title.trim()) {
      announcement.title = req.body.title.trim();
    }
    if (typeof req.body?.body === "string") {
      announcement.body = req.body.body.trim();
    }

    await announcement.save();
    return res.json({
      message: announcement.active ? "Announcement is visible on the portal" : "Announcement paused",
      announcement: serializeAnnouncement(announcement),
    });
  } catch (err) {
    console.error("updateAnnouncement error", err);
    return res.status(500).json({ message: "Failed to update announcement" });
  }
};

export const deleteAnnouncement = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Announcement.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Announcement not found" });
    }
    return res.json({ message: "Announcement deleted" });
  } catch (err) {
    console.error("deleteAnnouncement error", err);
    return res.status(500).json({ message: "Failed to delete announcement" });
  }
};

export const listPortalAnnouncements = async (req, res) => {
  try {
    const role = String(req.user?.role || "").toLowerCase();
    const userId = req.user?.id;
    const portalMatch = {
      $and: [
        {
          $or: [
            { scope: "portal" },
            { scope: { $exists: false } },
            { scope: null },
          ],
        },
        { audience: audienceQueryForRole(role) },
      ],
    };

    const orClauses = [portalMatch];
    if (role === "student" && userId) {
      orClauses.push({
        scope: "batch",
        recipientIds: userId,
      });
    }

    const items = await Announcement.find({
      active: true,
      $or: orClauses,
    })
      .sort({ createdAt: -1 })
      .limit(12)
      .select("title body audience scope batch createdAt academyName")
      .lean();

    return res.json({
      items: items.map((item) => ({
        id: String(item._id),
        title: item.title,
        body: item.body || "",
        audience: item.audience,
        scope: item.scope || "portal",
        createdAt: item.createdAt,
        academyName: item.academyName,
      })),
    });
  } catch (err) {
    console.error("listPortalAnnouncements error", err);
    return res.status(500).json({ message: "Failed to load announcements" });
  }
};

/**
 * Trainer: announce to selected students in a batch they own.
 * Body: { title, body, studentIds: string[], sendEmail?: boolean, academyName?: string }
 */
export const createTrainerAnnouncement = async (req, res) => {
  try {
    const trainerId = req.user?.id;
    const { batchId } = req.params;
    const title = String(req.body?.title || "").trim();
    const body = String(req.body?.body || "").trim();
    const academy = String(req.body?.academyName || "ProgZ").trim() || "ProgZ";
    const sendEmailFlag = req.body?.sendEmail !== false;
    const selectedIds = toIdList(req.body?.studentIds);

    if (!title) {
      return res.status(400).json({ message: "Announcement title is required" });
    }
    if (!selectedIds.length) {
      return res.status(400).json({ message: "Select at least one student" });
    }

    const batch = await assertTrainerOwnsBatch(batchId, trainerId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found or you are not assigned to it" });
    }

    const batchStudentSet = new Set((batch.students || []).map((id) => String(id)));
    const allowedIds = selectedIds.filter((id) => batchStudentSet.has(id));
    if (!allowedIds.length) {
      return res.status(400).json({
        message: "Selected students must belong to this batch",
      });
    }

    const recipients = await User.find({
      _id: { $in: allowedIds },
      role: "student",
    })
      .select("name email")
      .lean();

    if (!recipients.length) {
      return res.status(400).json({ message: "No valid students found for the selection" });
    }

    const recipientIds = recipients.map((u) => u._id);
    const emails = [
      ...new Set(
        recipients
          .map((u) => String(u.email || "").trim().toLowerCase())
          .filter((email) => EMAIL_RE.test(email))
      ),
    ];

    const announcement = await Announcement.create({
      title,
      body,
      audience: "custom",
      scope: "batch",
      batch: batchId,
      recipientIds,
      extraEmails: [],
      active: true,
      createdBy: trainerId,
      academyName: academy,
      emailStatus: sendEmailFlag && emails.length ? "sending" : "skipped",
      emailStats: {
        total: sendEmailFlag ? emails.length : 0,
        sent: 0,
        failed: 0,
      },
    });

    notifyAnnouncementInApp({
      userIds: recipientIds,
      title,
      body,
      announcementId: announcement._id,
    });

    if (!sendEmailFlag || emails.length === 0) {
      return res.status(201).json({
        message: `Announcement sent to ${recipientIds.length} student${recipientIds.length === 1 ? "" : "s"}`,
        announcement: serializeAnnouncement({
          ...announcement.toObject(),
          recipients,
        }),
        queued: false,
      });
    }

    const finishSend = async () => {
      const stats = await deliverAnnouncementEmails({
        emails,
        title,
        body,
        academy,
      });
      announcement.emailStats = stats;
      announcement.emailStatus = stats.failed === stats.total ? "failed" : "sent";
      announcement.markModified("emailStats");
      await announcement.save();
      return stats;
    };

    if (emails.length <= SYNC_SEND_LIMIT) {
      const stats = await finishSend();
      return res.status(201).json({
        message:
          stats.failed === 0
            ? `Announcement sent to ${recipientIds.length} student${recipientIds.length === 1 ? "" : "s"} (${stats.sent} emailed)`
            : `Announcement published. Emailed ${stats.sent}, failed ${stats.failed}`,
        announcement: serializeAnnouncement({
          ...announcement.toObject(),
          recipients,
        }),
        queued: false,
      });
    }

    finishSend().catch((err) => {
      console.error("Background trainer announcement send failed", err);
    });

    return res.status(201).json({
      message: `Announcement published. Emails are sending to ${emails.length} students.`,
      announcement: serializeAnnouncement({
        ...announcement.toObject(),
        recipients,
      }),
      queued: true,
    });
  } catch (err) {
    console.error("createTrainerAnnouncement error", err);
    return res.status(500).json({
      message: err.message || "Failed to publish announcement",
    });
  }
};

export const listTrainerBatchAnnouncements = async (req, res) => {
  try {
    const trainerId = req.user?.id;
    const { batchId } = req.params;
    const batch = await assertTrainerOwnsBatch(batchId, trainerId);
    if (!batch) {
      return res.status(404).json({ message: "Batch not found or you are not assigned to it" });
    }

    const items = await Announcement.find({
      scope: "batch",
      batch: batchId,
      createdBy: trainerId,
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("recipientIds", "name email")
      .lean();

    return res.json({
      items: items.map((item) =>
        serializeAnnouncement({
          ...item,
          recipients: item.recipientIds || [],
          recipientIds: (item.recipientIds || []).map((u) => u._id || u),
        })
      ),
    });
  } catch (err) {
    console.error("listTrainerBatchAnnouncements error", err);
    return res.status(500).json({ message: "Failed to load announcements" });
  }
};

export const updateTrainerAnnouncement = async (req, res) => {
  try {
    const trainerId = req.user?.id;
    const { id } = req.params;
    const announcement = await Announcement.findOne({
      _id: id,
      scope: "batch",
      createdBy: trainerId,
    });
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }

    if (typeof req.body?.active === "boolean") {
      announcement.active = req.body.active;
    }
    if (typeof req.body?.title === "string" && req.body.title.trim()) {
      announcement.title = req.body.title.trim();
    }
    if (typeof req.body?.body === "string") {
      announcement.body = req.body.body.trim();
    }

    await announcement.save();
    return res.json({
      message: announcement.active ? "Announcement is visible to students" : "Announcement paused",
      announcement: serializeAnnouncement(announcement),
    });
  } catch (err) {
    console.error("updateTrainerAnnouncement error", err);
    return res.status(500).json({ message: "Failed to update announcement" });
  }
};

export const deleteTrainerAnnouncement = async (req, res) => {
  try {
    const trainerId = req.user?.id;
    const { id } = req.params;
    const deleted = await Announcement.findOneAndDelete({
      _id: id,
      scope: "batch",
      createdBy: trainerId,
    });
    if (!deleted) {
      return res.status(404).json({ message: "Announcement not found" });
    }
    return res.json({ message: "Announcement deleted" });
  } catch (err) {
    console.error("deleteTrainerAnnouncement error", err);
    return res.status(500).json({ message: "Failed to delete announcement" });
  }
};
