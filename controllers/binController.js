import RecycleBin from "../models/RecycleBin.js";
import Course from "../models/Course.js";
import User from "../models/User.js";

// @desc    Get all items in recycle bin
// @route   GET /api/bin
// @access  Private (Admin)
export const getBinItems = async (req, res) => {
    try {
        const items = await RecycleBin.find().sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: "Error fetching bin items", error: error.message });
    }
};

// @desc    Restore item from bin
// @route   POST /api/bin/:id/restore
// @access  Private (Admin)
export const restoreItem = async (req, res) => {
    try {
        const { id } = req.params;
        const binItem = await RecycleBin.findById(id);

        if (!binItem) {
            return res.status(404).json({ message: "Item not found in bin" });
        }

        const { itemType, data } = binItem;

        if (itemType === "Course") {
            // Check if ID conflict exists?
            // Since original is deleted, ID should be free, but let's just create it with original ID.
            // We might need to handle 'unique' constraints if any (like courseId code).
            const existing = await Course.findById(data._id);
            if (existing) {
                return res.status(400).json({ message: "ID conflict: Item with this ID already exists in active courses." });
            }

            await Course.create(data); // Mongoose create accepts object including _id
        } else if (itemType === "User") {
            const existing = await User.findById(data._id);
            if (existing) {
                return res.status(400).json({ message: "ID conflict: Item with this ID already exists in active users." });
            }
            await User.create(data);
        } else {
            return res.status(400).json({ message: "Unknown item type" });
        }

        await RecycleBin.findByIdAndDelete(id);

        res.json({ message: `${itemType} restored successfully` });
    } catch (error) {
        console.error("Restore error:", error);
        res.status(500).json({ message: "Error restoring item", error: error.message });
    }
};

// @desc    Permanently delete item
// @route   DELETE /api/bin/:id
// @access  Private (Admin)
export const permanentlyDeleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await RecycleBin.findByIdAndDelete(id);

        if (!result) {
            return res.status(404).json({ message: "Item not found" });
        }

        res.json({ message: "Item permanently deleted" });
    } catch (error) {
        res.status(500).json({ message: "Error deleting item", error: error.message });
    }
};
