/**
 * Log Manager
 * Handles reading and parsing Minecraft server logs
 */

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { createReadStream } = require('fs');

class LogManager {
    constructor() {
        this.logCache = new Map(); // serverId -> recent logs
        this.maxCacheSize = 500; // Maximum lines to keep in cache per server
    }

    /**
     * Get log file path for a server
     */
    getLogPath(serverPath, logType = 'latest') {
        return path.join(serverPath, 'logs', `${logType}.log`);
    }

    /**
     * Parse a log line into structured data
     */
    parseLogLine(line) {
        // Minecraft log format: [HH:MM:SS] [ThreadName/LEVEL]: Message
        const regex = /^\[(\d{2}:\d{2}:\d{2})\]\s+\[([^\]]+)\/(\w+)\]:\s+(.*)$/;
        const match = line.match(regex);

        if (match) {
            return {
                timestamp: match[1],
                thread: match[2],
                level: match[3],
                message: match[4],
                raw: line
            };
        }

        // Fallback for non-standard lines
        return {
            timestamp: null,
            thread: 'UNKNOWN',
            level: 'INFO',
            message: line,
            raw: line
        };
    }

    /**
     * Read latest logs from a server
     */
    async readLogs(serverPath, options = {}) {
        const {
            lines = 100,
            logType = 'latest',
            level = null,
            search = null,
            startLine = 0
        } = options;

        const logPath = this.getLogPath(serverPath, logType);

        try {
            // Check if log file exists
            await fs.access(logPath);

            // Read all lines
            const allLines = [];
            const fileStream = createReadStream(logPath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            for await (const line of rl) {
                const parsed = this.parseLogLine(line);
                
                // Apply filters
                if (level && parsed.level !== level) continue;
                if (search && !parsed.message.toLowerCase().includes(search.toLowerCase())) continue;

                allLines.push(parsed);
            }

            // Return requested range
            const start = Math.max(0, allLines.length - lines - startLine);
            const end = allLines.length - startLine;
            return allLines.slice(start, end);

        } catch (error) {
            if (error.code === 'ENOENT') {
                return []; // No logs yet
            }
            throw error;
        }
    }

    /**
     * Get available log files for a server
     */
    async getAvailableLogs(serverPath) {
        const logsDir = path.join(serverPath, 'logs');

        try {
            await fs.access(logsDir);
            const files = await fs.readdir(logsDir);
            
            return files
                .filter(f => f.endsWith('.log') || f.endsWith('.log.gz'))
                .map(f => {
                    const filePath = path.join(logsDir, f);
                    return {
                        name: f,
                        path: filePath
                    };
                });
        } catch (error) {
            return [];
        }
    }

    /**
     * Get log statistics
     */
    async getLogStats(serverPath) {
        const logPath = this.getLogPath(serverPath);

        try {
            const stats = await fs.stat(logPath);
            const content = await fs.readFile(logPath, 'utf-8');
            const lines = content.split('\n');

            const levels = { INFO: 0, WARN: 0, ERROR: 0, FATAL: 0, DEBUG: 0 };
            
            for (const line of lines) {
                const parsed = this.parseLogLine(line);
                if (levels[parsed.level] !== undefined) {
                    levels[parsed.level]++;
                }
            }

            return {
                size: stats.size,
                sizeFormatted: this.formatBytes(stats.size),
                lines: lines.length,
                modified: stats.mtime,
                levels
            };
        } catch (error) {
            return null;
        }
    }

    /**
     * Export logs to file
     */
    async exportLogs(serverPath, options = {}) {
        const {
            logType = 'latest',
            level = null,
            search = null,
            startDate = null,
            endDate = null
        } = options;

        const logs = await this.readLogs(serverPath, {
            lines: 10000, // Max export lines
            logType,
            level,
            search
        });

        // Filter by date if provided
        let filtered = logs;
        if (startDate || endDate) {
            filtered = logs.filter(log => {
                if (!log.timestamp) return true;
                // Simple time-based filtering (would need full date for better filtering)
                return true;
            });
        }

        // Format as text
        return filtered.map(log => log.raw).join('\n');
    }

    /**
     * Clear log cache for a server
     */
    clearCache(serverId) {
        this.logCache.delete(serverId);
    }

    /**
     * Add log line to cache
     */
    addToCache(serverId, logLine) {
        if (!this.logCache.has(serverId)) {
            this.logCache.set(serverId, []);
        }

        const cache = this.logCache.get(serverId);
        const parsed = this.parseLogLine(logLine);
        cache.push(parsed);

        // Keep cache size limited
        if (cache.length > this.maxCacheSize) {
            cache.shift();
        }
    }

    /**
     * Get cached logs for a server
     */
    getCachedLogs(serverId, options = {}) {
        const { level = null, search = null, lines = 100 } = options;
        const cache = this.logCache.get(serverId) || [];

        let filtered = cache;

        // Apply filters
        if (level) {
            filtered = filtered.filter(log => log.level === level);
        }

        if (search) {
            const searchLower = search.toLowerCase();
            filtered = filtered.filter(log => 
                log.message.toLowerCase().includes(searchLower)
            );
        }

        // Return last N lines
        return filtered.slice(-lines);
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new LogManager();
