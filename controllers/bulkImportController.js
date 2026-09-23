import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import Batch from "../models/Batch.js";
import { canManageBatch, denyAccess } from "../utils/authorizationHelpers.js";
import { getBatchCourseIds } from "../utils/batchCourses.js";
import { logAuditAction } from "../utils/auditLogger.js";
import { notifyBatchAssigned } from "../services/notificationService.js";
import { enrollStudentIntoCourses } from "../utils/batchEnrollment.js";
import {
  randomUnusablePassword,
  attachLoginToken,
  sendWelcomeInviteEmail,
} from "../utils/magicLogin.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_IMPORT = 500;

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
const normalizeName = (value) => String(value || "").trim().slice(0, 120);

/**
 * Admin bulk import: create passwordless student accounts, assign to batch, send welcome magic links.
 * Body: { batchId, students: [{ name?, email }], sendWelcomeEmails?: boolean }
 */
export const bulkImportStudents = async (req, res) => {
  try {
    const { batchId, students = [], sendWelcomeEmails = true } = req.body || {};

    if (!batchId || !/^[a-fA-F0-9]{24}$/.test(String(batchId))) {
      return res.status(400).json({ msg: "A valid batchId is required." });
    }

    if (!Array.isArray(students) || students.length === 0) {
      return res.status(400).json({ msg: "Provide at least one student with an email." });
    }

    if (students.length > MAX_IMPORT) {
      return res.status(400).json({
        msg: `Too many students in one import. Maximum is ${MAX_IMPORT}.`,
      });
    }

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ msg: "Batch not found" });

    if (!canManageBatch(req, batch)) {
      return denyAccess(res, "You do not have permission to import students into this batch");
    }

    const summary = {
      total: students.length,
      created: 0,
      alreadyExisting: 0,
      assigned: 0,
      alreadyAssigned: 0,
      emailsSent: 0,
      failed: 0,
    };
    const errors = [];
    const newlyAssignedUsers = [];
    const seenInFile = new Set();
    const courseIds = getBatchCourseIds(batch);

    for (let i = 0; i < students.length; i++) {
      const row = students[i] || {};
      const rowNum = i + 1;
      const email = normalizeEmail(row.email);
      const name = normalizeName(row.name) || email.split("@")[0] || "Student";

      if (!email) {
        summary.failed += 1;
        errors.push({ row: rowNum, email: row.email || "", reason: "Email is required" });
        continue;
      }

      if (!EMAIL_RE.test(email)) {
        summary.failed += 1;
        errors.push({ row: rowNum, email, reason: "Invalid email address" });
        continue;
      }

      if (seenInFile.has(email)) {
        summary.failed += 1;
        errors.push({ row: rowNum, email, reason: "Duplicate email in this import file" });
        continue;
      }
      seenInFile.add(email);

      try {
        let user = await User.findOne({ email });
        let wasCreated = false;

        if (!user) {
          const pending = await PendingUser.findOne({ email });
          if (pending) {
            const userData = pending.toObject();
            delete userData._id;
            delete userData.createdAt;
            delete userData.updatedAt;
            delete userData.__v;
            delete userData.status;
            userData.email = email;
            userData.role = "student";
            if (!userData.name && name) userData.name = name;
            if (!userData.password) {
              userData.password = await randomUnusablePassword();
            }
            user = await User.create(userData);
            await PendingUser.findByIdAndDelete(pending._id);
            wasCreated = true;
            summary.created += 1;
          } else {
            user = await User.create({
              name,
              email,
              role: "student",
              password: await randomUnusablePassword(),
              enrolledCourses: [],
              source: "bulk_import",
            });
            wasCreated = true;
            summary.created += 1;
          }
        } else {
          summary.alreadyExisting += 1;
          if (String(user.role).toLowerCase() !== "student") {
            summary.failed += 1;
            errors.push({
              row: rowNum,
              email,
              reason: `Email belongs to a ${user.role} account, not a student`,
            });
            continue;
          }
          if (name && (!user.name || user.name === email.split("@")[0])) {
            user.name = name;
            await user.save();
          }
        }

        const alreadyInBatch = (batch.students || []).some(
          (id) => String(id) === String(user._id)
        );

        if (!alreadyInBatch) {
          batch.students.push(user._id);
          newlyAssignedUsers.push(user);
          summary.assigned += 1;
        } else {
          summary.alreadyAssigned += 1;
        }

        await enrollStudentIntoCourses(user, batch._id, courseIds);

        let welcomeSent = false;
        if (sendWelcomeEmails) {
          try {
            const rawToken = attachLoginToken(user);
            await user.save();
            await sendWelcomeInviteEmail({
              user,
              batchName: batch.name,
              rawToken,
            });
            summary.emailsSent += 1;
            welcomeSent = true;
          } catch (mailErr) {
            errors.push({
              row: rowNum,
              email,
              reason: `Account ready but welcome email failed: ${mailErr.message}`,
            });
          }
        }

        await logAuditAction({
          req,
          action: "bulk_import_student",
          targetType: "Batch",
          targetId: batch._id,
          details: {
            batchName: batch.name,
            studentId: user._id,
            studentEmail: email,
            wasCreated,
            welcomeSent,
          },
        });
      } catch (err) {
        summary.failed += 1;
        errors.push({
          row: rowNum,
          email,
          reason: err.message || "Failed to import student",
        });
      }
    }

    if (newlyAssignedUsers.length > 0) {
      await batch.save();
      notifyBatchAssigned({
        users: newlyAssignedUsers,
        batch,
        assignedAs: "student",
      });
    }

    res.json({
      msg: "Bulk student import completed",
      summary: {
        totalStudents: summary.total,
        successfullyCreated: summary.created,
        alreadyExisting: summary.alreadyExisting,
        successfullyAssigned: summary.assigned,
        alreadyAssigned: summary.alreadyAssigned,
        welcomeEmailsSent: summary.emailsSent,
        failedRecords: summary.failed,
      },
      errors,
    });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
};
