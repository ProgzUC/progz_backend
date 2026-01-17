import { syncInstructors, syncStudents, fetchZenTrainers } from "../services/syncService.js";

export const triggerSync = async (req, res) => {
    try {
        console.log('🔄 Manual sync triggered by admin');

        await syncInstructors();
        await syncStudents();

        res.json({ message: "Sync completed successfully" });
    } catch (error) {
        console.error("Sync failed:", error);
        res.status(500).json({ message: "Sync failed", error: error.message });
    }
};

export const getZenTrainers = async (req, res) => {
    try {
        const trainers = await fetchZenTrainers();
        res.json(trainers);
    } catch (error) {
        res.status(500).json({ message: "Failed to fetch Zen trainers", error: error.message });
    }
};
