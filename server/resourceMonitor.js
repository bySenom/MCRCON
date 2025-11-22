const si = require('systeminformation');
const pidusage = require('pidusage');

class ResourceMonitor {
    constructor() {
        this.io = null;
        this.monitoringIntervals = new Map();
        this.tpsData = new Map(); // Store latest TPS for each server
        this.lastCpuUsage = new Map(); // Store last CPU usage for calculations
    }

    setSocketIO(io) {
        this.io = io;
        console.log('✓ WebSocket connected to ResourceMonitor');
    }

    updateTPS(serverId, tps) {
        this.tpsData.set(serverId, tps);
    }

    getTPS(serverId) {
        return this.tpsData.get(serverId) || 20.0;
    }

    async getProcessStats(pid) {
        try {
            // Use pidusage for accurate CPU stats
            const processStats = await pidusage(pid);
            const [memData, cpuInfo] = await Promise.all([
                si.mem(),
                si.cpu()
            ]);

            // pidusage returns memory in bytes, cpu as percentage (can exceed 100% on multi-core)
            const stats = {
                cpu: processStats.cpu || 0,
                cpuCores: cpuInfo.cores || 1,
                memory: {
                    used: processStats.memory, // Already in bytes
                    total: memData.total,
                    percentage: (processStats.memory / memData.total) * 100
                },
                uptime: processStats.elapsed
            };
            
            // Log occasionally for debugging (every 10th call)
            if (Math.random() < 0.1) {
                console.log(`Process stats for PID ${pid}:`, {
                    cpu: processStats.cpu,
                    cpuCores: cpuInfo.cores,
                    memory: processStats.memory,
                    memoryMB: (processStats.memory / 1024 / 1024).toFixed(2)
                });
            }
            
            return stats;
        } catch (error) {
            console.error('Error getting process stats:', error);
            return null;
        }
    }

    async getSystemStats() {
        try {
            const [cpu, mem, disk] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.fsSize()
            ]);

            // currentLoad returns overall CPU load (0-100%)
            // Ensure it's capped at 100%
            const cpuLoad = Math.min(cpu.currentLoad || 0, 100);

            return {
                cpu: {
                    usage: Number(cpuLoad.toFixed(2)),
                    cores: cpu.cpus.length
                },
                memory: {
                    total: mem.total,
                    used: mem.used,
                    free: mem.free,
                    percentage: Number(((mem.used / mem.total) * 100).toFixed(2))
                },
                disk: disk.map(d => ({
                    mount: d.mount,
                    total: d.size,
                    used: d.used,
                    available: d.available,
                    percentage: Number(d.use.toFixed(2))
                }))
            };
        } catch (error) {
            console.error('Error getting system stats:', error);
            return null;
        }
    }

    startMonitoring(serverId, pid, serverProcess) {
        // Stop existing monitoring if any
        this.stopMonitoring(serverId);

        // Request TPS every 10 seconds by sending 'tps' command
        const tpsInterval = setInterval(() => {
            if (serverProcess && serverProcess.stdin && !serverProcess.killed) {
                try {
                    serverProcess.stdin.write('tps\n');
                } catch (error) {
                    console.error(`Error sending TPS command to ${serverId}:`, error);
                }
            }
        }, 10000);

        // Monitor every 2 seconds
        const interval = setInterval(async () => {
            const stats = await this.getProcessStats(pid);
            
            if (stats && this.io) {
                this.io.to(`server-${serverId}`).emit('resource-update', {
                    serverId,
                    process: stats,
                    tps: this.getTPS(serverId),
                    timestamp: new Date().toISOString()
                });
            }
        }, 2000);

        this.monitoringIntervals.set(serverId, { interval, tpsInterval });
        console.log(`✓ Started resource monitoring for server: ${serverId}`);
    }

    stopMonitoring(serverId) {
        const intervals = this.monitoringIntervals.get(serverId);
        if (intervals) {
            clearInterval(intervals.interval);
            if (intervals.tpsInterval) {
                clearInterval(intervals.tpsInterval);
            }
            this.monitoringIntervals.delete(serverId);
            this.tpsData.delete(serverId);
            console.log(`✓ Stopped resource monitoring for server: ${serverId}`);
        }
    }

    stopAllMonitoring() {
        this.monitoringIntervals.forEach((intervals, serverId) => {
            clearInterval(intervals.interval);
            if (intervals.tpsInterval) {
                clearInterval(intervals.tpsInterval);
            }
            console.log(`✓ Stopped resource monitoring for server: ${serverId}`);
        });
        this.monitoringIntervals.clear();
    }
}

module.exports = new ResourceMonitor();
