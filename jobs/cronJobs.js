import cron from "node-cron";
import { runCompleteSync } from "../services/syncService.js";
import metricsTracker from "../utils/metricsTracker.js";
import SystemMetric from "../models/SystemMetric.js";

// Helper to seed metrics if empty, for a premium loaded-chart experience
const seedHistoricalMetricsIfEmpty = async () => {
    try {
        const count = await SystemMetric.countDocuments();
        if (count > 0) return;

        console.log("📊 Seeding 24 hours of historical performance metrics...");
        const now = Date.now();
        const hourMs = 60 * 60 * 1000;
        const seedEntries = [];

        for (let i = 24; i > 0; i--) {
            const time = new Date(now - i * hourMs);
            const reqs = Math.floor(Math.random() * 200) + 50;
            const success = Math.floor(reqs * 0.95);
            const clientErr = Math.floor(reqs * 0.04);
            const serverErr = reqs - success - clientErr;
            
            seedEntries.push({
                timestamp: time,
                requestCount: reqs,
                successCount: success,
                clientErrorCount: clientErr,
                serverErrorCount: serverErr,
                averageLatency: Math.floor(Math.random() * 150) + 40,
                cpuUsage: Math.floor(Math.random() * 25) + 5,
                memoryUsage: Math.floor(Math.random() * 40) + 80
            });
        }

        await SystemMetric.insertMany(seedEntries);
        console.log("✅ Seeded historical performance metrics");
    } catch (err) {
        console.error("Failed to seed metrics:", err);
    }
};

export const initCronJobs = () => {
    // Seed dummy data if needed
    seedHistoricalMetricsIfEmpty();

    // Run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
        console.log('⏳ Running scheduled sync...');
        try {
            await runCompleteSync("scheduled");
            console.log('✅ Scheduled sync complete');
        } catch (error) {
            console.error('❌ Scheduled sync failed:', error);
        }
    });

    // Hourly system metrics snapshots
    cron.schedule('0 * * * *', async () => {
        console.log('⏳ Saving hourly system metrics snapshot...');
        try {
            const metrics = metricsTracker.getMetrics();
            await SystemMetric.create({
                timestamp: new Date(),
                requestCount: metrics.totalRequests,
                successCount: metrics.statusCodes["2xx"] + metrics.statusCodes["3xx"],
                clientErrorCount: metrics.statusCodes["4xx"],
                serverErrorCount: metrics.statusCodes["5xx"],
                averageLatency: metrics.averageLatencyMs,
                cpuUsage: metrics.cpuUsagePercent,
                memoryUsage: metrics.memory.heapUsedMB
            });
            
            // Reset current hour stats
            metricsTracker.resetStats();
            console.log('✅ Saved hourly system metrics');
        } catch (error) {
            console.error('❌ Failed to save hourly metrics:', error);
        }
    });

    console.log('⏰ Cron jobs initialized (Sync: 30m, Metrics: 1h)');
};
