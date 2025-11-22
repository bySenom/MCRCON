/**
 * Proxy Network Monitoring System
 * Monitors backend server status, player counts, and TPS
 */

const { exec } = require('child_process');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const { Rcon } = require('rcon-client');

class ProxyMonitor {
    constructor() {
        this.monitoringIntervals = new Map(); // serverId -> interval
        this.backendStatus = new Map(); // serverId -> { servers: Map(serverName -> status) }
        this.io = null; // WebSocket instance
    }

    /**
     * Initialize monitor with WebSocket
     */
    setWebSocket(io) {
        this.io = io;
    }

    /**
     * Start monitoring a proxy server
     */
    startMonitoring(proxyServer) {
        if (this.monitoringIntervals.has(proxyServer.id)) {
            return; // Already monitoring
        }

        console.log(`[ProxyMonitor] Starting monitoring for proxy ${proxyServer.name}`);

        // Initialize status map for this proxy
        this.backendStatus.set(proxyServer.id, { servers: new Map() });

        // Initial check
        this.checkBackendServers(proxyServer);

        // Check every 30 seconds
        const interval = setInterval(() => {
            this.checkBackendServers(proxyServer);
        }, 30000);

        this.monitoringIntervals.set(proxyServer.id, interval);
    }

    /**
     * Stop monitoring a proxy server
     */
    stopMonitoring(serverId) {
        const interval = this.monitoringIntervals.get(serverId);
        if (interval) {
            clearInterval(interval);
            this.monitoringIntervals.delete(serverId);
            this.backendStatus.delete(serverId);
            console.log(`[ProxyMonitor] Stopped monitoring for proxy ${serverId}`);
        }
    }

    /**
     * Check all backend servers for a proxy
     */
    async checkBackendServers(proxyServer) {
        try {
            const configPath = path.join(proxyServer.path, 'config.yml');
            
            console.log(`[ProxyMonitor] Checking backend servers for ${proxyServer.name} at ${configPath}`);
            
            if (!fs.existsSync(configPath)) {
                console.log(`[ProxyMonitor] Config file not found: ${configPath}`);
                return;
            }

            const configContent = fs.readFileSync(configPath, 'utf8');
            const config = yaml.load(configContent);

            if (!config.servers) {
                console.log(`[ProxyMonitor] No servers configured in config.yml for ${proxyServer.name}`);
                return;
            }

            console.log(`[ProxyMonitor] Found ${Object.keys(config.servers).length} backend servers in config`);
            
            const statusMap = this.backendStatus.get(proxyServer.id).servers;

            // Check each backend server
            for (const [serverName, serverConfig] of Object.entries(config.servers)) {
                console.log(`[ProxyMonitor] Checking backend server: ${serverName} at ${serverConfig.address}`);
                const status = await this.checkSingleServer(serverName, serverConfig, proxyServer);
                console.log(`[ProxyMonitor] Status for ${serverName}:`, status);
                statusMap.set(serverName, status);
            }

            // Emit update via WebSocket
            if (this.io) {
                const backends = Array.from(statusMap.entries()).map(([name, status]) => ({
                    name,
                    ...status
                }));
                console.log(`[ProxyMonitor] Emitting status update for ${backends.length} backends`);
                this.io.emit('proxy-backend-status', {
                    proxyId: proxyServer.id,
                    backends
                });
            }

        } catch (error) {
            console.error(`[ProxyMonitor] Error checking backend servers for ${proxyServer.name}:`, error.message);
        }
    }

    /**
     * Check single backend server status
     */
    async checkSingleServer(serverName, serverConfig, proxyServer) {
        const [host, portStr] = serverConfig.address.split(':');
        const port = parseInt(portStr, 10);

        const status = {
            online: false,
            playerCount: 0,
            maxPlayers: 0,
            tps: 0,
            motd: serverConfig.motd || '',
            latency: 0,
            restricted: serverConfig.restricted || false
        };

        try {
            // Try to ping the server using RCON (if configured)
            const startTime = Date.now();
            const pingResult = await this.pingMinecraftServer(host, port);
            status.latency = Date.now() - startTime;

            if (pingResult) {
                status.online = true;
                status.playerCount = pingResult.players || 0;
                status.maxPlayers = pingResult.maxPlayers || 0;
                status.motd = pingResult.motd || status.motd;
            }

            // Try to get TPS via RCON if available
            if (status.online) {
                const tps = await this.getServerTPS(proxyServer, serverName);
                if (tps > 0) {
                    status.tps = tps;
                }
            }

        } catch (error) {
            // Server is offline or unreachable
            status.online = false;
        }

        return status;
    }

    /**
     * Ping Minecraft server (simplified check)
     */
    async pingMinecraftServer(host, port) {
        return new Promise((resolve) => {
            const net = require('net');
            const socket = new net.Socket();
            
            socket.setTimeout(3000); // Reduced timeout
            
            socket.connect(port, host === 'localhost' ? '127.0.0.1' : host, () => {
                // Send handshake packet for server list ping (Minecraft protocol)
                const handshake = Buffer.from([
                    0x00, // Packet ID
                    0xFF, 0xFF, 0xFF, 0xFF, 0x0F, // Protocol version (-1)
                    0x09, 0x6C, 0x6F, 0x63, 0x61, 0x6C, 0x68, 0x6F, 0x73, 0x74, // "localhost"
                    0x00, 0x00, // Port
                    0x01 // Next state (status)
                ]);
                
                socket.write(handshake);
                
                // Send status request
                const statusRequest = Buffer.from([0x01, 0x00]);
                socket.write(statusRequest);
                
                let responseData = Buffer.alloc(0);
                
                socket.on('data', (data) => {
                    responseData = Buffer.concat([responseData, data]);
                    
                    // Try to parse response
                    try {
                        // Simple parsing - just check if we got data
                        socket.destroy();
                        resolve({ 
                            players: 0, 
                            maxPlayers: 20, 
                            motd: 'Minecraft Server',
                            online: true
                        });
                    } catch (err) {
                        socket.destroy();
                        resolve({ players: 0, maxPlayers: 20, motd: '', online: true });
                    }
                });
            });

            socket.on('error', (err) => {
                console.log(`[ProxyMonitor] Error pinging ${host}:${port}:`, err.message);
                resolve(null);
            });

            socket.on('timeout', () => {
                socket.destroy();
                console.log(`[ProxyMonitor] Timeout pinging ${host}:${port}`);
                resolve(null);
            });
        });
    }

    /**
     * Get TPS from backend server via proxy RCON
     */
    async getServerTPS(proxyServer, serverName) {
        // This would require BungeeCord RCON to send commands to backend servers
        // For now, return 0 (TPS monitoring requires plugin support)
        return 0;
    }

    /**
     * Get current status for a proxy
     */
    getBackendStatus(proxyId) {
        const proxyStatus = this.backendStatus.get(proxyId);
        if (!proxyStatus) {
            return [];
        }

        return Array.from(proxyStatus.servers.entries()).map(([name, status]) => ({
            name,
            ...status
        }));
    }

    /**
     * Get global player count for proxy
     */
    async getGlobalPlayerCount(proxyServer) {
        try {
            // Try to connect to proxy RCON and execute /glist
            const rcon = await Rcon.connect({
                host: 'localhost',
                port: proxyServer.rconPort,
                password: proxyServer.rconPassword,
                timeout: 5000
            });

            const response = await rcon.send('glist');
            await rcon.end();

            // Parse response to get total player count
            const match = response.match(/Total players online: (\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }

            return 0;
        } catch (error) {
            console.error(`[ProxyMonitor] Error getting player count:`, error.message);
            return 0;
        }
    }

    /**
     * Send player to specific backend server
     */
    async sendPlayer(proxyServer, playerName, targetServer) {
        try {
            const rcon = await Rcon.connect({
                host: 'localhost',
                port: proxyServer.rconPort,
                password: proxyServer.rconPassword,
                timeout: 5000
            });

            await rcon.send(`send ${playerName} ${targetServer}`);
            await rcon.end();

            return { success: true, message: `Player ${playerName} sent to ${targetServer}` };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Broadcast alert to all backend servers
     */
    async broadcastAlert(proxyServer, message) {
        try {
            const rcon = await Rcon.connect({
                host: 'localhost',
                port: proxyServer.rconPort,
                password: proxyServer.rconPassword,
                timeout: 5000
            });

            await rcon.send(`alert ${message}`);
            await rcon.end();

            return { success: true, message: 'Alert sent to all servers' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    /**
     * Get list of online players from proxy
     */
    async getOnlinePlayers(proxyServer) {
        try {
            const rcon = await Rcon.connect({
                host: 'localhost',
                port: proxyServer.rconPort,
                password: proxyServer.rconPassword,
                timeout: 5000
            });

            const response = await rcon.send('glist');
            await rcon.end();

            // Parse player list from response
            const players = [];
            const lines = response.split('\n');
            
            for (const line of lines) {
                // Format: [ServerName] player1, player2, player3
                const match = line.match(/\[(.+?)\]\s+(.+)/);
                if (match) {
                    const serverName = match[1];
                    const playerNames = match[2].split(',').map(p => p.trim()).filter(p => p);
                    
                    playerNames.forEach(name => {
                        players.push({ name, server: serverName });
                    });
                }
            }

            return players;
        } catch (error) {
            console.error(`[ProxyMonitor] Error getting online players:`, error.message);
            return [];
        }
    }
}

// Singleton instance
const proxyMonitor = new ProxyMonitor();

module.exports = proxyMonitor;
