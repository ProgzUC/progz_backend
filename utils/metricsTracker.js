import mongoose from "mongoose";

class MetricsTracker {
  constructor() {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.statusCodes = {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0
    };
    this.totalLatency = 0;
    this.maxLatency = 0;
    this.recentRequests = [];
    this.maxRecentSize = 50;
    this.lastCpuUsage = process.cpuUsage();
    this.lastCpuTime = Date.now();
  }

  recordRequest(method, url, statusCode, latencyMs) {
    this.totalRequests++;
    
    // Increment status code bucket
    const category = Math.floor(statusCode / 100);
    if (category === 2) this.statusCodes["2xx"]++;
    else if (category === 3) this.statusCodes["3xx"]++;
    else if (category === 4) this.statusCodes["4xx"]++;
    else if (category === 5) this.statusCodes["5xx"]++;

    this.totalLatency += latencyMs;
    if (latencyMs > this.maxLatency) {
      this.maxLatency = latencyMs;
    }

    // Add to recent list
    this.recentRequests.unshift({
      timestamp: new Date(),
      method,
      url,
      statusCode,
      latencyMs
    });

    if (this.recentRequests.length > this.maxRecentSize) {
      this.recentRequests.pop();
    }
  }

  getAverageLatency() {
    return this.totalRequests > 0 ? Math.round(this.totalLatency / this.totalRequests) : 0;
  }

  getCpuPercentage() {
    const elapsedMs = Date.now() - this.lastCpuTime;
    const elapsedCpu = process.cpuUsage(this.lastCpuUsage);
    
    this.lastCpuTime = Date.now();
    this.lastCpuUsage = process.cpuUsage();
    
    // total CPU time in microseconds
    const totalCpuTime = elapsedCpu.user + elapsedCpu.system;
    
    // convert elapsedMs to microseconds
    const elapsedMicro = elapsedMs * 1000;
    
    // CPU usage percentage
    const cpuPercent = elapsedMicro > 0 ? (totalCpuTime / elapsedMicro) * 100 : 0;
    return Math.round(cpuPercent * 100) / 100;
  }

  getMetrics() {
    const memory = process.memoryUsage();
    const readyState = mongoose.connection.readyState;
    const dbStatusMap = {
      0: "Disconnected",
      1: "Connected",
      2: "Connecting",
      3: "Disconnecting",
      99: "Uninitialized"
    };

    return {
      uptimeSeconds: Math.round((Date.now() - this.startTime) / 1000),
      totalRequests: this.totalRequests,
      statusCodes: this.statusCodes,
      averageLatencyMs: this.getAverageLatency(),
      maxLatencyMs: this.maxLatency,
      dbStatus: dbStatusMap[readyState] || "Unknown",
      dbReadyState: readyState,
      cpuUsagePercent: this.getCpuPercentage(),
      memory: {
        rssMB: Math.round(memory.rss / 1024 / 1024 * 100) / 100,
        heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024 * 100) / 100,
        heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024 * 100) / 100,
        externalMB: Math.round(memory.external / 1024 / 1024 * 100) / 100,
      },
      recentRequests: this.recentRequests
    };
  }

  resetStats() {
    this.totalRequests = 0;
    this.totalLatency = 0;
    this.maxLatency = 0;
    this.statusCodes = {
      "2xx": 0,
      "3xx": 0,
      "4xx": 0,
      "5xx": 0
    };
  }
}

const metricsTracker = new MetricsTracker();
export default metricsTracker;
