const fs = require('fs').promises;
const path = require('path');

class PlayerManager {
    constructor(serverManager) {
        this.serverManager = serverManager;
    }

    /**
     * Get list of online players for a server
     */
    async getOnlinePlayers(serverId) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            if (server.status !== 'running') {
                return [];
            }

            // Send 'list' command to get online players
            const response = await this.executeCommand(serverId, 'list');
            
            // Parse response: "There are 2 of a max of 20 players online: player1, player2"
            const players = this.parsePlayerList(response);
            
            return players.map(name => ({
                name,
                status: 'online',
                server: server.name
            }));
        } catch (error) {
            console.error('Error getting online players:', error);
            return [];
        }
    }

    /**
     * Get all players (from usercache.json + whitelist + ops + bans)
     */
    async getAllPlayers(serverId) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            const serverPath = server.path;
            const players = new Map();

            // Get online players
            const onlinePlayers = await this.getOnlinePlayers(serverId);
            onlinePlayers.forEach(player => {
                players.set(player.name, { ...player, online: true });
            });

            // Read usercache.json for player history
            try {
                const usercachePath = path.join(serverPath, 'usercache.json');
                const usercache = JSON.parse(await fs.readFile(usercachePath, 'utf8'));
                
                for (const entry of usercache) {
                    if (!players.has(entry.name)) {
                        players.set(entry.name, {
                            name: entry.name,
                            uuid: entry.uuid,
                            status: 'offline',
                            online: false,
                            lastSeen: entry.expiresOn
                        });
                    } else {
                        players.get(entry.name).uuid = entry.uuid;
                    }
                }
            } catch (error) {
                // usercache.json might not exist yet
            }

            // Add whitelist status
            const whitelist = await this.getWhitelist(serverId);
            whitelist.forEach(entry => {
                if (players.has(entry.name)) {
                    players.get(entry.name).whitelisted = true;
                } else {
                    players.set(entry.name, {
                        name: entry.name,
                        uuid: entry.uuid,
                        status: 'offline',
                        online: false,
                        whitelisted: true
                    });
                }
            });

            // Add op status
            const ops = await this.getOps(serverId);
            ops.forEach(entry => {
                if (players.has(entry.name)) {
                    players.get(entry.name).op = true;
                    players.get(entry.name).opLevel = entry.level || 4;
                }
            });

            // Add ban status
            const bans = await this.getBannedPlayers(serverId);
            bans.forEach(entry => {
                if (players.has(entry.name)) {
                    players.get(entry.name).banned = true;
                    players.get(entry.name).banReason = entry.reason;
                } else {
                    players.set(entry.name, {
                        name: entry.name,
                        uuid: entry.uuid,
                        status: 'banned',
                        online: false,
                        banned: true,
                        banReason: entry.reason
                    });
                }
            });

            return Array.from(players.values());
        } catch (error) {
            console.error('Error getting all players:', error);
            throw error;
        }
    }

    /**
     * Get player statistics from stats folder
     */
    async getPlayerStats(serverId, playerName) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            // Find player UUID from usercache
            const players = await this.getAllPlayers(serverId);
            const player = players.find(p => p.name === playerName);
            
            if (!player || !player.uuid) {
                throw new Error('Player not found');
            }

            const statsPath = path.join(server.path, 'world', 'stats', `${player.uuid}.json`);
            
            try {
                const statsData = JSON.parse(await fs.readFile(statsPath, 'utf8'));
                
                // Parse key statistics
                const stats = {
                    playTime: this.formatTime(statsData.stats?.['minecraft:custom']?.['minecraft:play_time'] || 0),
                    deaths: statsData.stats?.['minecraft:custom']?.['minecraft:deaths'] || 0,
                    mobKills: statsData.stats?.['minecraft:custom']?.['minecraft:mob_kills'] || 0,
                    playerKills: statsData.stats?.['minecraft:custom']?.['minecraft:player_kills'] || 0,
                    damageDealt: statsData.stats?.['minecraft:custom']?.['minecraft:damage_dealt'] || 0,
                    damageTaken: statsData.stats?.['minecraft:custom']?.['minecraft:damage_taken'] || 0,
                    jumps: statsData.stats?.['minecraft:custom']?.['minecraft:jump'] || 0,
                    distanceWalked: Math.round((statsData.stats?.['minecraft:custom']?.['minecraft:walk_one_cm'] || 0) / 100),
                    distanceFlown: Math.round((statsData.stats?.['minecraft:custom']?.['minecraft:fly_one_cm'] || 0) / 100),
                    timeSinceLastDeath: this.formatTime(statsData.stats?.['minecraft:custom']?.['minecraft:time_since_death'] || 0)
                };

                return stats;
            } catch (error) {
                // Stats file doesn't exist or can't be read
                return null;
            }
        } catch (error) {
            console.error('Error getting player stats:', error);
            throw error;
        }
    }

    /**
     * Kick a player from the server
     */
    async kickPlayer(serverId, playerName, reason = 'Kicked by an operator') {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `kick ${playerName} ${reason}`);
            return { success: true, message: `Player ${playerName} kicked` };
        } catch (error) {
            console.error('Error kicking player:', error);
            throw error;
        }
    }

    /**
     * Ban a player
     */
    async banPlayer(serverId, playerName, reason = 'Banned by an operator') {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `ban ${playerName} ${reason}`);
            return { success: true, message: `Player ${playerName} banned` };
        } catch (error) {
            console.error('Error banning player:', error);
            throw error;
        }
    }

    /**
     * Pardon (unban) a player
     */
    async pardonPlayer(serverId, playerName) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `pardon ${playerName}`);
            return { success: true, message: `Player ${playerName} pardoned` };
        } catch (error) {
            console.error('Error pardoning player:', error);
            throw error;
        }
    }

    /**
     * Op a player
     */
    async opPlayer(serverId, playerName) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `op ${playerName}`);
            return { success: true, message: `Player ${playerName} is now an operator` };
        } catch (error) {
            console.error('Error opping player:', error);
            throw error;
        }
    }

    /**
     * Deop a player
     */
    async deopPlayer(serverId, playerName) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `deop ${playerName}`);
            return { success: true, message: `Player ${playerName} is no longer an operator` };
        } catch (error) {
            console.error('Error deopping player:', error);
            throw error;
        }
    }

    /**
     * Add player to whitelist
     */
    async whitelistAdd(serverId, playerName) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `whitelist add ${playerName}`);
            return { success: true, message: `Player ${playerName} added to whitelist` };
        } catch (error) {
            console.error('Error adding to whitelist:', error);
            throw error;
        }
    }

    /**
     * Remove player from whitelist
     */
    async whitelistRemove(serverId, playerName) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server || server.status !== 'running') {
                throw new Error('Server is not running');
            }

            await this.executeCommand(serverId, `whitelist remove ${playerName}`);
            return { success: true, message: `Player ${playerName} removed from whitelist` };
        } catch (error) {
            console.error('Error removing from whitelist:', error);
            throw error;
        }
    }

    /**
     * Get whitelist
     */
    async getWhitelist(serverId) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            const whitelistPath = path.join(server.path, 'whitelist.json');
            
            try {
                const whitelist = JSON.parse(await fs.readFile(whitelistPath, 'utf8'));
                return whitelist;
            } catch (error) {
                return [];
            }
        } catch (error) {
            console.error('Error getting whitelist:', error);
            return [];
        }
    }

    /**
     * Get ops list
     */
    async getOps(serverId) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            const opsPath = path.join(server.path, 'ops.json');
            
            try {
                const ops = JSON.parse(await fs.readFile(opsPath, 'utf8'));
                return ops;
            } catch (error) {
                return [];
            }
        } catch (error) {
            console.error('Error getting ops:', error);
            return [];
        }
    }

    /**
     * Get banned players
     */
    async getBannedPlayers(serverId) {
        try {
            const server = this.serverManager.getServer(serverId);
            if (!server) {
                throw new Error('Server not found');
            }

            const banPath = path.join(server.path, 'banned-players.json');
            
            try {
                const bans = JSON.parse(await fs.readFile(banPath, 'utf8'));
                return bans;
            } catch (error) {
                return [];
            }
        } catch (error) {
            console.error('Error getting banned players:', error);
            return [];
        }
    }

    /**
     * Execute command on server
     */
    async executeCommand(serverId, command) {
        return new Promise((resolve, reject) => {
            try {
                const result = this.serverManager.executeCommand(serverId, command);
                if (result.success) {
                    // Give server time to process command
                    setTimeout(() => resolve('Command executed'), 100);
                } else {
                    reject(new Error('Command failed'));
                }
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Parse player list from 'list' command output
     */
    parsePlayerList(response) {
        // Response format: "There are 2 of a max of 20 players online: player1, player2"
        const match = response.match(/online:\s*(.+)$/);
        if (match && match[1].trim()) {
            return match[1].split(',').map(name => name.trim());
        }
        return [];
    }

    /**
     * Format time in ticks to human readable
     */
    formatTime(ticks) {
        const seconds = Math.floor(ticks / 20); // 20 ticks per second
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

module.exports = PlayerManager;
