import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import Course from "../models/Course.js";
import apiClient from "./apiClient.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import SyncLog from "../models/SyncLog.js";
import sendEmail from "../utils/sendEmail.js";
import { logAuditAction } from "../utils/auditLogger.js";

const randomUnusablePassword = async () => {
    const raw = crypto.randomBytes(32).toString("hex");
    return bcrypt.hash(raw, 10);
};

// Sync Instructors from Zen API
export const syncInstructors = async () => {
    let syncedCount = 0;
    let duplicateCount = 0;
    const errors = [];
    const seenEmails = new Set();

    try {
        const { data } = await apiClient.get('/api/trainers/progz');
        if (!data || !data.success || !Array.isArray(data.trainers)) {
            throw new Error("Invalid response schema from trainers API");
        }

        for (const t of data.trainers) {
            const email = t.trainer_email?.trim().toLowerCase();
            if (!email) continue;

            // 1. Detect duplicates in payload
            if (seenEmails.has(email)) {
                duplicateCount++;
                continue;
            }
            seenEmails.add(email);

            try {
                // 2. Detect duplicates in database (Active User)
                const userExists = await User.findOne({ email });
                if (userExists) {
                    duplicateCount++;
                    continue;
                }

                // 3. Detect duplicates in Pending User
                const pendingExists = await PendingUser.findOne({ email });
                if (pendingExists) {
                    if (pendingExists.source !== 'zen') {
                        pendingExists.source = 'zen';
                        await pendingExists.save();
                        syncedCount++; // Count source upgrade as synced
                    } else {
                        duplicateCount++;
                    }
                    continue;
                }

                // Create Pending User with unusable random password (admin must set password on approval)
                const password = await randomUnusablePassword();
                await PendingUser.create({
                    name: t.trainer_name,
                    email: email,
                    phone: t.trainer_mobile,
                    password,
                    role: 'trainer',
                    source: 'zen'
                });
                syncedCount++;
            } catch (itemErr) {
                errors.push(`Trainer (${email}): ${itemErr.message}`);
            }
        }
    } catch (err) {
        errors.push(`Instructors Sync: ${err.message}`);
        throw err; // Re-throw to fail master sync
    }

    return { syncedCount, duplicateCount, errors };
};

// Fetch Zen trainers (Raw data retrieval)
export const fetchZenTrainers = async () => {
    try {
        const { data } = await apiClient.get('/api/trainers/progz');
        if (data && data.success) {
            return data.trainers;
        }
        return [];
    } catch (err) {
        throw new Error(`Failed to fetch Zen trainers: ${err.message}`);
    }
};

// Sync Students (leads) from Zen API
export const syncStudents = async () => {
    let syncedCount = 0;
    let duplicateCount = 0;
    const errors = [];
    const seenEmails = new Set();
    const seenPhones = new Set();

    try {
        const { data } = await apiClient.get('/leads/trainingprogress');
        if (!Array.isArray(data)) {
            throw new Error("Students API response is not an array");
        }

        for (const student of data) {
            const name = student.name || 'Unknown';
            const email = student.email?.trim().toLowerCase() || `${name.toLowerCase().replace(/\s+/g, '')}@progz.tech`;
            const phone = student.mobile_number || '';
            const address = student.location || '';

            // 1. Detect duplicates in payload
            if (seenEmails.has(email) || (phone && seenPhones.has(phone))) {
                duplicateCount++;
                continue;
            }
            seenEmails.add(email);
            if (phone) seenPhones.add(phone);

            try {
                // Match course by courseId
                let course = null;
                if (student.course_id) {
                    course = await Course.findOne({ courseId: student.course_id });
                }

                // 2. Detect duplicates / update Active Users
                let existingUser = await User.findOne({ $or: [{ email }, { phone }] });
                if (existingUser) {
                    if (course) {
                        const isEnrolledInUser = existingUser.enrolledCourses.some(e => e.course.toString() === course._id.toString());
                        if (!isEnrolledInUser) {
                            existingUser.enrolledCourses.push({
                                course: course._id,
                                enrolledAt: new Date()
                            });
                            await existingUser.save();
                            syncedCount++;
                        } else {
                            duplicateCount++;
                        }

                        // Sync course enrolledStudents
                        const isEnrolledInCourse = course.enrolledStudents.some(e => e.student.toString() === existingUser._id.toString());
                        if (!isEnrolledInCourse) {
                            course.enrolledStudents.push({
                                student: existingUser._id,
                                enrolledDate: new Date()
                            });
                            await course.save();
                        }
                    } else {
                        duplicateCount++;
                    }
                    continue;
                }

                // 3. Detect duplicates / update Pending Users
                const pendingExists = await PendingUser.findOne({ $or: [{ email }, { phone }] });
                if (pendingExists) {
                    let updated = false;
                    if (pendingExists.source !== 'zen') { pendingExists.source = 'zen'; updated = true; }
                    if (!pendingExists.zenCourseName && student.course_name) { pendingExists.zenCourseName = student.course_name; updated = true; }
                    if (!pendingExists.zenCourseType && student.course_type) { pendingExists.zenCourseType = student.course_type; updated = true; }

                    if (updated) {
                        await pendingExists.save();
                        syncedCount++;
                    } else {
                        duplicateCount++;
                    }
                    continue;
                }

                // Create new Pending User with unusable random password
                const password = await randomUnusablePassword();
                const enrolledCourses = [];
                if (course) {
                    enrolledCourses.push({
                        course: course._id,
                        enrolledAt: new Date()
                    });
                }

                await PendingUser.create({
                    name,
                    email,
                    phone,
                    password,
                    address,
                    role: 'student',
                    enrolledCourses,
                    source: 'zen',
                    zenCourseName: student.course_name,
                    zenCourseType: student.course_type
                });
                syncedCount++;
            } catch (itemErr) {
                errors.push(`Student (${email}): ${itemErr.message}`);
            }
        }
    } catch (err) {
        errors.push(`Students Sync: ${err.message}`);
        throw err; // Re-throw to fail master sync
    }

    return { syncedCount, duplicateCount, errors };
};

// Master execution wrapper that coordinates, logs, and alerts on fails
export const runCompleteSync = async (triggerType = "scheduled", userId = null, req = null) => {
    const startTime = new Date();
    
    // 1. Initialize Sync Log
    const syncLog = await SyncLog.create({
        startTime,
        triggerType,
        triggeredBy: userId,
        status: "in_progress"
    });

    let totalInstructors = 0;
    let totalStudents = 0;
    let totalDuplicates = 0;
    const allErrors = [];

    try {
        // Run Instructor sync
        const instructorResult = await syncInstructors();
        totalInstructors = instructorResult.syncedCount;
        totalDuplicates += instructorResult.duplicateCount;
        if (instructorResult.errors.length > 0) {
            allErrors.push(...instructorResult.errors);
        }

        // Run Student sync
        const studentResult = await syncStudents();
        totalStudents = studentResult.syncedCount;
        totalDuplicates += studentResult.duplicateCount;
        if (studentResult.errors.length > 0) {
            allErrors.push(...studentResult.errors);
        }

        const endTime = new Date();
        const duration = endTime - startTime;

        // 2. Save success log
        syncLog.endTime = endTime;
        syncLog.status = allErrors.length > 0 && totalInstructors === 0 && totalStudents === 0 ? "failure" : "success";
        syncLog.instructorsSynced = totalInstructors;
        syncLog.studentsSynced = totalStudents;
        syncLog.duplicatesDetected = totalDuplicates;
        syncLog.errorsList = allErrors;
        syncLog.executionTimeMs = duration;
        await syncLog.save();

        // Write Audit Action
        await logAuditAction({
            req,
            action: "sync_zen",
            targetType: "Sync",
            targetId: syncLog._id,
            details: {
                triggerType,
                instructorsSynced: totalInstructors,
                studentsSynced: totalStudents,
                duplicatesDetected: totalDuplicates,
                errorsCount: allErrors.length
            },
            actorOverride: userId ? { id: userId } : undefined
        });

        // Trigger failure email alert if sync logged critical errors or did not import any items despite errors
        if (allErrors.length > 0 && (totalInstructors === 0 && totalStudents === 0)) {
            await sendSyncFailureEmail(syncLog);
        }

        return syncLog;
    } catch (err) {
        const endTime = new Date();
        const duration = endTime - startTime;
        allErrors.push(`Master execution error: ${err.message}`);

        syncLog.endTime = endTime;
        syncLog.status = "failure";
        syncLog.errorsList = allErrors;
        syncLog.executionTimeMs = duration;
        await syncLog.save();

        // Write Audit Action
        await logAuditAction({
            req,
            action: "sync_zen",
            targetType: "Sync",
            targetId: syncLog._id,
            details: {
                triggerType,
                status: "failed",
                error: err.message
            },
            actorOverride: userId ? { id: userId } : undefined
        });

        // Trigger email failure alert
        await sendSyncFailureEmail(syncLog);

        throw err;
    }
};

// Send SMTP email alert on sync failures
const sendSyncFailureEmail = async (syncLog) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
        console.error("ADMIN_EMAIL is not set; skipping sync failure email");
        return;
    }
    const subject = `⚠️ Progz Alert: Zen CRM Sync Failed`;
    const html = `
        <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #e1e1e1; border-radius: 8px;">
            <h2 style="color: #ef4444; margin-top: 0;">Zen CRM Synchronization Failure</h2>
            <p>Hello Administrator,</p>
            <p>The scheduled or manual synchronization with Zen CRM failed to run successfully or encountered critical errors.</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                <tr>
                    <td style="padding: 6px 0; font-weight: bold; width: 150px;">Log ID:</td>
                    <td style="padding: 6px 0; font-family: monospace;">${syncLog._id}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Start Time:</td>
                    <td style="padding: 6px 0;">${syncLog.startTime.toLocaleString()}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Trigger Type:</td>
                    <td style="padding: 6px 0; text-transform: uppercase;">${syncLog.triggerType}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 0; font-weight: bold;">Execution Time:</td>
                    <td style="padding: 6px 0;">${syncLog.executionTimeMs || 0}ms</td>
                </tr>
            </table>
            
            <h4 style="color: #ef4444; margin-bottom: 8px;">Errors Encountered:</h4>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 4px; padding: 12px; font-family: monospace; font-size: 13px; color: #991b1b; max-height: 200px; overflow-y: auto;">
                ${syncLog.errorsList.map(err => `<div style="margin-bottom: 6px;">• ${err}</div>`).join("")}
            </div>
            <p style="margin-top: 20px; font-size: 13px; color: #666;">Please check the Diagnostics & Monitoring dashboard in the Progz admin portal for full details.</p>
        </div>
    `;

    try {
        await sendEmail({
            email: adminEmail,
            subject,
            html,
            message: `Zen CRM Sync Failed. Errors:\n${syncLog.errorsList.join("\n")}`
        });
        console.log(`📩 Sync failure email notification sent to ${adminEmail}`);
    } catch (emailErr) {
        console.error("❌ Failed to dispatch sync failure alert email:", emailErr.message);
    }
};
