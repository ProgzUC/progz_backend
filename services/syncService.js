import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import Course from "../models/Course.js";
import apiClient from "./apiClient.js";
import bcrypt from "bcryptjs";

export const syncInstructors = async () => {
    try {
        const { data } = await apiClient.get('/api/trainers/progz');
        if (data.success) {
            for (const t of data.trainers) {
                const email = t.trainer_email;

                // Check Main User
                const userExists = await User.findOne({ email });
                if (userExists) continue;

                // Check Pending User
                const pendingExists = await PendingUser.findOne({ email });
                if (pendingExists) {
                    if (!pendingExists.source || pendingExists.source !== 'zen') {
                        pendingExists.source = 'zen';
                        // pendingExists.save(); // Not critical to await, or await it
                        await pendingExists.save();
                        console.log(`Updated Pending Instructor source: ${email}`);
                    }
                    continue;
                }

                // Create Pending User
                const password = await bcrypt.hash('progz1234', 10);
                await PendingUser.create({
                    name: t.trainer_name,
                    email: email,
                    phone: t.trainer_mobile,
                    password,
                    password,
                    role: 'trainer',
                    source: 'zen'
                });
                console.log(`✅ Pending Instructor created: ${email}`);
            }
            console.log('✅ Instructors sync check complete');
        }
    } catch (err) {
        console.error('Error syncing instructors:', err.message);
    }
};

export const fetchZenTrainers = async () => {
    try {
        const { data } = await apiClient.get('/api/trainers/progz');
        if (data.success) {
            return data.trainers;
        }
        return [];
    } catch (err) {
        console.error('Error fetching instructors:', err.message);
        throw err;
    }
};

export const syncStudents = async () => {
    try {
        const { data } = await apiClient.get('/leads/trainingprogress');

        if (Array.isArray(data)) {
            console.log(`API returned ${data.length} students`);
            for (const student of data) {
                // console.log(`Processing student: ${student.email}`);
                const name = student.name || 'Unknown';
                const email = student.email || `${name.toLowerCase().replace(/\s+/g, '')}@progz.tech`;
                const phone = student.mobile_number || '';
                const address = student.location || '';

                // 🔍 Match course by courseId
                let course = null;
                if (student.course_id) {
                    course = await Course.findOne({ courseId: student.course_id });
                    if (!course) {
                        // console.warn(`⚠️ Course not found for: ${student.course_id}`);
                    }
                }

                // Check Main User
                let existingUser = await User.findOne({ $or: [{ email }, { phone }] });

                if (existingUser) {
                    // User exists, update enrollment if needed
                    if (course) {
                        // Update User's enrolledCourses
                        const isEnrolledInUser = existingUser.enrolledCourses.some(e => e.course.toString() === course._id.toString());
                        if (!isEnrolledInUser) {
                            existingUser.enrolledCourses.push({
                                course: course._id,
                                enrolledAt: new Date()
                            });
                            await existingUser.save();
                        }

                        // Update Course's enrolledStudents
                        const isEnrolledInCourse = course.enrolledStudents.some(e => e.student.toString() === existingUser._id.toString());
                        if (!isEnrolledInCourse) {
                            course.enrolledStudents.push({
                                student: existingUser._id,
                                enrolledDate: new Date()
                            });
                            await course.save();
                            console.log(`📚 Existing Student ${email} added to Course ${course.courseName}`);
                        }
                    }
                } else {
                    // Check Pending User
                    const pendingExists = await PendingUser.findOne({ $or: [{ email }, { phone }] });

                    if (pendingExists) {
                        // Update fields if missing
                        let updated = false;
                        if (pendingExists.source !== 'zen') { pendingExists.source = 'zen'; updated = true; }
                        if (!pendingExists.zenCourseName && student.course_name) { pendingExists.zenCourseName = student.course_name; updated = true; }
                        if (!pendingExists.zenCourseType && student.course_type) { pendingExists.zenCourseType = student.course_type; updated = true; }

                        if (updated) {
                            await pendingExists.save();
                            console.log(`Updated Pending Student fields: ${email}`);
                        }
                    } else {
                        const password = await bcrypt.hash('student123', 10);

                        // Prepare enrolledCourses for pending user
                        // Our PendingUser schema mirrors User schema which has enrolledCourses array
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
                        console.log(`✅ Pending Student created: ${email}`);
                    }
                }
            }
            console.log('🎓 Student sync check complete');
        } else {
            console.warn('⚠️ Invalid response from API');
        }
    } catch (error) {
        console.error('❌ Error syncing students:', error.message);
    }
};
