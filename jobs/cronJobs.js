import cron from "node-cron";
import { syncInstructors, syncStudents } from "../services/syncService.js";

export const initCronJobs = () => {
    // Run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('⏳ Running scheduled sync...');
        await syncInstructors();
        await syncStudents();
        console.log('✅ Scheduled sync complete');
    });

    console.log('⏰ Cron jobs initialized (Every 30 mins)');
};
