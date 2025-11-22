/**
 * World Manager
 * Handles Minecraft world management operations
 */

const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const extract = require('extract-zip');
const { createReadStream, createWriteStream, existsSync } = require('fs');

class WorldManager {
    constructor() {
        this.worldFolders = ['world', 'world_nether', 'world_the_end'];
    }

    /**
     * Get world information from level.dat
     * Note: Full NBT parsing would require a library, this is a simplified version
     */
    async getWorldInfo(serverPath) {
        const levelDatPath = path.join(serverPath, 'world', 'level.dat');
        
        try {
            // Check if level.dat exists
            await fs.access(levelDatPath);
            
            const stats = await fs.stat(levelDatPath);
            
            // Read basic world folder information
            const worldPath = path.join(serverPath, 'world');
            const worldStats = await this.getDirectorySize(worldPath);
            
            return {
                exists: true,
                size: worldStats.size,
                sizeFormatted: this.formatBytes(worldStats.size),
                files: worldStats.files,
                modified: stats.mtime,
                path: worldPath
            };
        } catch (error) {
            return {
                exists: false,
                message: 'Welt nicht gefunden'
            };
        }
    }

    /**
     * Download world as ZIP
     */
    async downloadWorld(serverPath, worldName = 'world') {
        const worldPath = path.join(serverPath, worldName);
        
        try {
            await fs.access(worldPath);
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const zipName = `${worldName}-${timestamp}.zip`;
            
            return {
                success: true,
                worldPath,
                zipName
            };
        } catch (error) {
            throw new Error(`Welt ${worldName} nicht gefunden`);
        }
    }

    /**
     * Create world ZIP stream
     */
    createWorldZipStream(worldPath) {
        const archive = archiver('zip', {
            zlib: { level: 6 }
        });

        archive.directory(worldPath, false);
        
        return archive;
    }

    /**
     * Upload and extract world
     */
    async uploadWorld(serverPath, zipPath, worldName = 'world') {
        const worldPath = path.join(serverPath, worldName);
        const backupPath = path.join(serverPath, `${worldName}_backup_${Date.now()}`);
        
        try {
            // Backup existing world if it exists
            if (existsSync(worldPath)) {
                await fs.rename(worldPath, backupPath);
            }
            
            // Extract uploaded world
            await extract(zipPath, { dir: worldPath });
            
            // Clean up backup if extraction successful
            if (existsSync(backupPath)) {
                await this.deleteDirectory(backupPath);
            }
            
            // Clean up uploaded zip
            await fs.unlink(zipPath);
            
            return {
                success: true,
                message: `Welt ${worldName} erfolgreich hochgeladen`
            };
        } catch (error) {
            // Restore backup if upload failed
            if (existsSync(backupPath)) {
                if (existsSync(worldPath)) {
                    await this.deleteDirectory(worldPath);
                }
                await fs.rename(backupPath, worldPath);
            }
            
            throw error;
        }
    }

    /**
     * Reset world (delete and regenerate on next start)
     */
    async resetWorld(serverPath, worldName = 'world') {
        const worldPath = path.join(serverPath, worldName);
        const backupPath = path.join(serverPath, 'backups', `${worldName}_reset_${Date.now()}`);
        
        try {
            // Create backup before reset
            await fs.mkdir(path.dirname(backupPath), { recursive: true });
            await this.copyDirectory(worldPath, backupPath);
            
            // Delete world
            await this.deleteDirectory(worldPath);
            
            return {
                success: true,
                message: `Welt ${worldName} zurückgesetzt. Backup erstellt.`,
                backupPath
            };
        } catch (error) {
            throw new Error(`Fehler beim Zurücksetzen der Welt: ${error.message}`);
        }
    }

    /**
     * Get gamerules from world
     */
    async getGamerules(serverPath) {
        // Common Minecraft gamerules
        const defaultGamerules = {
            announceAdvancements: true,
            commandBlockOutput: true,
            disableElytraMovementCheck: false,
            doDaylightCycle: true,
            doEntityDrops: true,
            doFireTick: true,
            doInsomnia: true,
            doImmediateRespawn: false,
            doLimitedCrafting: false,
            doMobLoot: true,
            doMobSpawning: true,
            doPatrolSpawning: true,
            doTileDrops: true,
            doTraderSpawning: true,
            doWeatherCycle: true,
            drowningDamage: true,
            fallDamage: true,
            fireDamage: true,
            forgiveDeadPlayers: true,
            keepInventory: false,
            logAdminCommands: true,
            maxCommandChainLength: 65536,
            maxEntityCramming: 24,
            mobGriefing: true,
            naturalRegeneration: true,
            playersSleepingPercentage: 100,
            randomTickSpeed: 3,
            reducedDebugInfo: false,
            sendCommandFeedback: true,
            showDeathMessages: true,
            spawnRadius: 10,
            spectatorsGenerateChunks: true,
            universalAnger: false
        };
        
        // In a real implementation, this would parse level.dat
        // For now, return default values
        return defaultGamerules;
    }

    /**
     * Set gamerule via command (requires running server)
     */
    async setGamerule(serverProcess, rule, value) {
        if (!serverProcess) {
            throw new Error('Server muss laufen um Gamerules zu setzen');
        }
        
        const command = `gamerule ${rule} ${value}\n`;
        serverProcess.stdin.write(command);
        
        return {
            success: true,
            message: `Gamerule ${rule} auf ${value} gesetzt`
        };
    }

    /**
     * Get world border info
     */
    async getWorldBorder(serverPath) {
        // Default world border values
        return {
            size: 29999984,
            center: { x: 0, z: 0 },
            damageAmount: 0.2,
            damageBuffer: 5,
            warningDistance: 5,
            warningTime: 15
        };
    }

    /**
     * Set world border via command (requires running server)
     */
    async setWorldBorder(serverProcess, size, centerX = 0, centerZ = 0) {
        if (!serverProcess) {
            throw new Error('Server muss laufen um Weltgrenze zu setzen');
        }
        
        serverProcess.stdin.write(`worldborder center ${centerX} ${centerZ}\n`);
        serverProcess.stdin.write(`worldborder set ${size}\n`);
        
        return {
            success: true,
            message: `Weltgrenze auf ${size} Blöcke gesetzt`
        };
    }

    /**
     * Get all worlds in server
     */
    async getWorlds(serverPath) {
        const worlds = [];
        
        for (const worldName of this.worldFolders) {
            const worldPath = path.join(serverPath, worldName);
            
            try {
                await fs.access(worldPath);
                const stats = await this.getDirectorySize(worldPath);
                
                worlds.push({
                    name: worldName,
                    size: stats.size,
                    sizeFormatted: this.formatBytes(stats.size),
                    files: stats.files,
                    exists: true
                });
            } catch (error) {
                worlds.push({
                    name: worldName,
                    exists: false
                });
            }
        }
        
        return worlds;
    }

    /**
     * Get directory size recursively
     */
    async getDirectorySize(dirPath) {
        let totalSize = 0;
        let fileCount = 0;
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    const subStats = await this.getDirectorySize(fullPath);
                    totalSize += subStats.size;
                    fileCount += subStats.files;
                } else {
                    const stats = await fs.stat(fullPath);
                    totalSize += stats.size;
                    fileCount++;
                }
            }
        } catch (error) {
            // Ignore errors for individual files
        }
        
        return { size: totalSize, files: fileCount };
    }

    /**
     * Delete directory recursively
     */
    async deleteDirectory(dirPath) {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
        } catch (error) {
            throw new Error(`Fehler beim Löschen: ${error.message}`);
        }
    }

    /**
     * Copy directory recursively
     */
    async copyDirectory(src, dest) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src, { withFileTypes: true });
        
        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(srcPath, destPath);
            } else {
                await fs.copyFile(srcPath, destPath);
            }
        }
    }

    /**
     * Format bytes to human readable
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

module.exports = new WorldManager();
