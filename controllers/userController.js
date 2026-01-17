import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import RecycleBin from "../models/RecycleBin.js";
import bcrypt from "bcryptjs";

// Register a new user (Add to PendingUser)
export const registerUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Check if user exists in main User collection
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ msg: "Email already exists in active users" });
        }

        // Check if user exists in PendingUser collection
        const existingPending = await PendingUser.findOne({ email });
        if (existingPending) {
            return res.status(400).json({ msg: "Registration request already pending for this email" });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create PendingUser
        const newPendingUser = await PendingUser.create({
            ...req.body,
            password: hashedPassword,
            role, // Ensure role is passed
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

// Admin: Approve a pending user
export const approveUser = async (req, res) => {
    try {
        const { id } = req.params;

        const pendingUser = await PendingUser.findById(id);
        if (!pendingUser) {
            return res.status(404).json({ msg: "Pending user request not found" });
        }

        // Check availability again
        const existingUser = await User.findOne({ email: pendingUser.email });
        if (existingUser) {
            // If they managed to register meanwhile?
            await PendingUser.findByIdAndDelete(id);
            return res.status(400).json({ msg: "User already exists in active users. Pending request removed." });
        }

        // Move to User collection
        // We explicitly map fields to avoid any extra junk from PendingUser if schema differs slightly, 
        // though here they are nearly identical.
        const newUser = await User.create({
            name: pendingUser.name,
            email: pendingUser.email,
            password: pendingUser.password, // Already hashed
            phone: pendingUser.phone,
            altPhone: pendingUser.altPhone,
            address: pendingUser.address,
            dob: pendingUser.dob,
            education: pendingUser.education,
            university: pendingUser.university,
            profession: pendingUser.profession,
            employmentStatus: pendingUser.employmentStatus,
            experience: pendingUser.experience,
            role: pendingUser.role,
        });

        // Remove from PendingUser
        await PendingUser.findByIdAndDelete(id);

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

// Admin: Get all pending users
export const getAllPendingUsers = async (req, res) => {
    try {
        const pendingUsers = await PendingUser.find().sort({ createdAt: -1 });
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
            data: user.toObject(),
            deletedBy: req.user.id,
            itemRefName: user.name || user.email
        });

        await User.findByIdAndDelete(id);

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

        // Apply updates
        const allowedFields = [
            "name", "phone",
            "altPhone", "address", "dob", "education", "university",
            "profession", "employmentStatus", "experience", "email"
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
