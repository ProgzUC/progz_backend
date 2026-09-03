import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import RecycleBin from "../models/RecycleBin.js";
import bcrypt from "bcryptjs";
import { validatePassword } from "../utils/passwordValidation.js";
import { logAuditAction } from "../utils/auditLogger.js";

const SELF_REGISTER_ROLES = ["student", "trainer"];
const ALL_ROLES = ["admin", "trainer", "student"];

const PROFILE_FIELDS = [
  "name",
  "phone",
  "altPhone",
  "address",
  "dob",
  "gender",
  "education",
  "university",
  "profession",
  "employmentStatus",
  "experience",
  "skills",
  "source",
  "zenCourseName",
  "zenCourseType",
];

const pickProfileFields = (body = {}) => {
  const picked = {};
  for (const field of PROFILE_FIELDS) {
    if (body[field] !== undefined) picked[field] = body[field];
  }
  return picked;
};

const redactSensitiveUserData = (data = {}) => {
  const clone = { ...data };
  delete clone.password;
  delete clone.refreshTokenHash;
  delete clone.refreshTokenExpires;
  delete clone.resetPasswordToken;
  delete clone.resetPasswordExpires;
  return clone;
};

const normalizeRegistrationRole = (role) => {
    const normalized = String(role || "student").toLowerCase();
    return SELF_REGISTER_ROLES.includes(normalized) ? normalized : null;
};

// Register a new user (Add to PendingUser)
export const registerUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;
        const safeRole = normalizeRegistrationRole(role);

        if (!safeRole) {
            return res.status(400).json({
                msg: "Invalid role. Self-registration is allowed for student or trainer only.",
            });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.ok) {
            return res.status(400).json({ msg: passwordCheck.message });
        }

        const normalizedEmail = String(email || "").trim().toLowerCase();

        // Check if user exists in main User collection
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ msg: "Email already exists in active users" });
        }

        // Check if user exists in PendingUser collection
        const existingPending = await PendingUser.findOne({ email: normalizedEmail });
        if (existingPending) {
            return res.status(400).json({ msg: "Registration request already pending for this email" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create PendingUser with allowlisted fields only (no mass assignment)
        const newPendingUser = await PendingUser.create({
            ...pickProfileFields(req.body),
            email: normalizedEmail,
            password: hashedPassword,
            role: safeRole,
            enrolledCourses: [],
            status: "pending",
        });

        res.status(201).json({
            msg: "Registration successful. Please wait for admin approval.",
            user: {
                id: newPendingUser._id,
                email: newPendingUser.email,
                role: newPendingUser.role,
                status: newPendingUser.status,
            },
        });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Admin: Directly create an active user without pending request
export const adminCreateUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        const normalizedRole = String(role || "").toLowerCase();
        if (!role || !ALL_ROLES.includes(normalizedRole)) {
            return res.status(400).json({ msg: "A valid role (admin, trainer, student) is required." });
        }

        const normalizedEmail = String(email || "").trim().toLowerCase();

        // Check if user exists in main User collection
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ msg: "Email already exists in active users" });
        }

        // Check if user exists in PendingUser collection
        const existingPending = await PendingUser.findOne({ email: normalizedEmail });
        if (existingPending) {
            // Remove the pending request since admin is creating them directly now
            await PendingUser.findByIdAndDelete(existingPending._id);
        }

        if (!password) {
            return res.status(400).json({ msg: "Password is required when creating a user." });
        }

        const passwordCheck = validatePassword(password);
        if (!passwordCheck.ok) {
            return res.status(400).json({ msg: passwordCheck.message });
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        // Allowlisted fields only — never spread req.body
        const userData = {
            ...pickProfileFields(req.body),
            email: normalizedEmail,
            role: normalizedRole,
            password: hashedPassword,
            enrolledCourses: [],
        };

        // Save directly to User
        const newUser = await User.create(userData);

        res.status(201).json({
            msg: "User created successfully",
            user: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role,
            },
        });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Admin: Approve a pending user
export const approveUser = async (req, res) => {
    try {
        const { id } = req.params;

        const pendingUser = await PendingUser.findById(id);
        if (!pendingUser) {
            return res.status(404).json({ msg: "Pending user request not found" });
        }

        if (String(pendingUser.role).toLowerCase() === "admin") {
            return res.status(403).json({
                msg: "Admin accounts cannot be approved from pending registrations. Use admin user creation instead.",
            });
        }

        const normalizedEmail = String(pendingUser.email || "").trim().toLowerCase();

        // Check availability again
        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            // If they managed to register meanwhile?
            await PendingUser.findByIdAndDelete(id);
            return res.status(400).json({ msg: "User already exists in active users. Pending request removed." });
        }

        // Move to User collection
        // Map all fields from PendingUser to User
        const userData = pendingUser.toObject();
        delete userData._id;
        delete userData.createdAt;
        delete userData.updatedAt;
        delete userData.__v;
        delete userData.status; // PendingUser specific
        userData.email = normalizedEmail;

        const newUser = await User.create(userData);

        // Remove from PendingUser
        await PendingUser.findByIdAndDelete(id);

        await logAuditAction({
            req,
            action: "approve_user",
            targetType: "User",
            targetId: newUser._id,
            details: {
                email: newUser.email,
                role: newUser.role,
                name: newUser.name
            }
        });

        res.status(200).json({
            msg: "User approved and created successfully",
            user: {
                id: newUser._id,
                email: newUser.email,
                role: newUser.role,
            },
        });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

//Admin: Get all active users
export const getAllUsers = async (req, res) => {
    try {
        // Fetch all users excluding passwords and excluding admin users if needed
        const users = await User.find({ role: { $ne: "admin" } }).sort({ createdAt: -1 }).select("-password");
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Admin: Get all pending users
export const getAllPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await PendingUser.find()
            .sort({ createdAt: -1 })
            .select("-password");
        res.status(200).json(pendingUsers);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Admin: Reject a pending user
export const rejectUser = async (req, res) => {
    try {
        const { id } = req.params;

        const pendingUser = await PendingUser.findById(id);
        if (!pendingUser) {
            return res.status(404).json({ msg: "Pending user request not found" });
        }

        await PendingUser.findByIdAndDelete(id);

        await logAuditAction({
            req,
            action: "reject_user",
            targetType: "User",
            targetId: pendingUser._id,
            details: {
                email: pendingUser.email,
                role: pendingUser.role,
                name: pendingUser.name
            }
        });

        res.status(200).json({ msg: "User registration request rejected" });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Admin: Soft delete user (Move to Recycle Bin)
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        if (user.role === "admin") {
            return res.status(403).json({ msg: "Cannot delete admin user" });
        }

        await RecycleBin.create({
            itemType: "User",
            originalId: user._id,
            data: redactSensitiveUserData(user.toObject()),
            deletedBy: req.user.id,
            itemRefName: user.name || user.email
        });

        await User.findByIdAndDelete(id);

        await logAuditAction({
            req,
            action: "delete_user",
            targetType: "User",
            targetId: user._id,
            details: {
                email: user.email,
                role: user.role,
                name: user.name,
                type: "soft_delete"
            }
        });

        res.json({ msg: "User moved to recycle bin" });
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Update user details
export const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Allow user to update their own profile OR Admin to update anyone
        if (userId !== id && userRole !== "admin") {
            return res.status(403).json({ msg: "Access denied" });
        }

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        const updates = req.body;

        // Restricted fields
        if (updates.role !== undefined) {
            if (userRole !== "admin") {
                return res.status(403).json({ msg: "Only admins can update user roles" });
            }
            const nextRole = String(updates.role).toLowerCase();
            if (!ALL_ROLES.includes(nextRole)) {
                return res.status(400).json({ msg: "Invalid role" });
            }
            user.role = nextRole;
        }

        // If NOT admin, prevent updating Name and Phone
        if (userRole !== "admin") {
            if (updates.name && updates.name !== user.name) {
                return res.status(403).json({ msg: "Only admins can update Name" });
            }
            if (updates.phone && updates.phone !== user.phone) {
                return res.status(403).json({ msg: "Only admins can update Phone Number" });
            }

            // Cleanup payload
            delete updates.name;
            delete updates.phone;
            delete updates.role;
        }

        const nextPassword = updates.newPassword ?? updates.password;
        delete updates.newPassword;
        delete updates.password;
        delete updates.currentPassword;
        delete updates.confirmPassword;

        if (nextPassword != null && String(nextPassword).trim() !== "") {
            if (userRole !== "admin") {
                return res.status(403).json({
                    msg: "Only admins can update passwords from user edit",
                });
            }

            const passwordCheck = validatePassword(nextPassword);
            if (!passwordCheck.ok) {
                return res.status(400).json({ msg: passwordCheck.message });
            }

            user.password = await bcrypt.hash(nextPassword, 10);
        }

        // Apply updates
        if (updates.email !== undefined) {
            const nextEmail = String(updates.email).trim().toLowerCase();
            const emailDuplicate = await User.findOne({ email: nextEmail, _id: { $ne: id } });
            if (emailDuplicate) {
                return res.status(400).json({ msg: "Email already in use by another user" });
            }
            updates.email = nextEmail;
        }

        const allowedFields = [
            "name", "phone",
            "altPhone", "address", "dob", "education", "university",
            "profession", "employmentStatus", "experience", "email",
            "gender", "skills", "zenCourseName", "zenCourseType", "source"
        ];

        allowedFields.forEach((field) => {
            if (updates[field] !== undefined) {
                user[field] = updates[field];
            }
        });

        await user.save();

        res.json({
            msg: "User updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                role: user.role,
                ...updates
            }
        });

    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};

// Get single user details
export const getUser = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const userRole = req.user.role;

        // Access Control: Self or Admin
        if (userId !== id && userRole !== "admin") {
            return res.status(403).json({ msg: "Access denied" });
        }

        const user = await User.findById(id).select("-password"); // Exclude password
        if (!user) {
            return res.status(404).json({ msg: "User not found" });
        }

        res.json(user);
    } catch (error) {
        res.status(500).json({ msg: error.message });
    }
};
