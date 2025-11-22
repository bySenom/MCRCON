const fs = require('fs').promises;
const path = require('path');

const SERVERS_DIR = path.join(__dirname, '../minecraft_servers');
const DB_FILE = path.join(__dirname, '../data/servers.json');

class ServerManager {
    constructor() {
        this.servers = new Map();
        this.processes = new Map();
        this.io = null; // WebSocket instance
        this.notificationManager = null; // Notification manager
    }
    
    setSocketIO(io) {
        this.io = io;
        console.log('✓ WebSocket connected to ServerManager');
    }

    setNotificationManager(notificationManager) {
        this.notificationManager = notificationManager;
        console.log('✓ Notification manager connected to ServerManager');
    }

    async clearSessionLocks(serverPath) {
        console.log(`🔓 Clearing session locks for server at ${serverPath}`);
        const lockPaths = [
            path.join(serverPath, 'world', 'session.lock'),
            path.join(serverPath, 'world_nether', 'session.lock'),
            path.join(serverPath, 'world_the_end', 'session.lock')
        ];

        for (const lockPath of lockPaths) {
            try {
                await fs.unlink(lockPath);
                console.log(`  ✓ Removed lock: ${path.basename(path.dirname(lockPath))}/session.lock`);
            } catch (error) {
                // File doesn't exist or can't be deleted - that's fine
                if (error.code !== 'ENOENT') {
                    console.warn(`  ⚠ Could not remove lock ${lockPath}: ${error.message}`);
                }
            }
        }
    }

    async initialize() {
        // Create directories if they don't exist
        await fs.mkdir(SERVERS_DIR, { recursive: true });
        await fs.mkdir(path.join(__dirname, '../data'), { recursive: true });

        // Load existing servers from database
        try {
            const data = await fs.readFile(DB_FILE, 'utf8');
            const servers = JSON.parse(data);
            let migrated = false;
            
            servers.forEach(server => {
                // Mark all servers as stopped on startup (clean slate)
                server.status = 'stopped';
                
                // Migration: Add host field if missing (v3.16.0)
                if (!server.host) {
                    server.host = '0.0.0.0';
                    migrated = true;
                    console.log(`  ✓ Migrated server ${server.name} with host field`);
                }
                
                this.servers.set(server.id, server);
            });
            console.log(`✓ Loaded ${servers.length} servers from database`);
            
            // Save updated status and migrations
            if (migrated) {
                await this.saveDatabase();
                console.log('✓ Database migration completed (added host field)');
            } else {
                await this.saveDatabase();
            }
        } catch (error) {
            // Database doesn't exist yet, create empty one
            await this.saveDatabase();
            console.log('✓ Created new server database');
        }
    }

    async saveDatabase() {
        const servers = Array.from(this.servers.values());
        await fs.writeFile(DB_FILE, JSON.stringify(servers, null, 2));
    }

    async createServer(config, userId = null) {
        const { v4: uuidv4 } = require('uuid');
        const serverId = uuidv4();
        
        const server = {
            id: serverId,
            name: config.name,
            type: config.type, // vanilla, spigot, paper, forge, fabric
            version: config.version,
            port: config.port || 25565,
            host: config.host || '0.0.0.0', // Bind address (0.0.0.0 = all interfaces)
            rconPort: config.rconPort || 25575,
            rconPassword: config.rconPassword,
            memory: config.memory || '2G',
            status: 'stopped',
            createdAt: new Date().toISOString(),
            path: path.join(SERVERS_DIR, serverId),
            userId: userId // Owner of the server
        };

        // Create server directory
        await fs.mkdir(server.path, { recursive: true });

        // Create server.properties with configured ports
        await this.createServerProperties(server);

        // Save to database
        this.servers.set(serverId, server);
        await this.saveDatabase();

        console.log(`✓ Server created: ${server.name} (${server.id})`);
        return server;
    }

    async createServerProperties(server) {
        // For proxy servers (BungeeCord/Waterfall/Velocity), create config files instead of server.properties
        if (server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity') {
            await this.createProxyConfig(server);
            return;
        }

        // Regular Minecraft server properties
        const propertiesPath = path.join(server.path, 'server.properties');
        const properties = `#Minecraft server properties
server-ip=${server.host}
server-port=${server.port}
rcon.port=${server.rconPort}
rcon.password=${server.rconPassword}
enable-rcon=true
online-mode=true
max-players=20
motd=${server.name}
difficulty=normal
gamemode=survival
pvp=true
spawn-protection=16
view-distance=10
`;
        await fs.writeFile(propertiesPath, properties, 'utf8');
        console.log(`✓ Created server.properties with port ${server.port}`);
    }

    async createProxyConfig(server) {
        // Velocity uses velocity.toml instead of config.yml
        if (server.type === 'velocity') {
            await this.createVelocityConfig(server);
            return;
        }

        // BungeeCord/Waterfall use config.yml
        const configPath = path.join(server.path, 'config.yml');
        const config = `# ${server.type.toUpperCase()} Configuration
# Generated by Minecraft Server Manager

# Listeners define the ports and addresses the proxy will listen on
listeners:
- query_port: ${server.port}
  motd: '&1${server.name}'
  priorities:
  - lobby
  bind_local_address: true
  tab_list: GLOBAL_PING
  query_enabled: false
  proxy_protocol: false
  forced_hosts:
    pvp.md-5.net: pvp
  ping_passthrough: false
  max_players: 100
  tab_size: 60
  force_default_server: false
  host: ${server.host}:${server.port}

# Remote servers that can be accessed via the proxy
servers:
  lobby:
    motd: '&1Lobby Server'
    address: localhost:25565
    restricted: false

# Player information forwarding
player_limit: -1
permissions:
  default:
  - bungeecord.command.server
  - bungeecord.command.list
  admin:
  - bungeecord.command.alert
  - bungeecord.command.end
  - bungeecord.command.ip
  - bungeecord.command.reload
timeout: 30000
log_commands: false
log_pings: true
online_mode: true
disabled_commands:
- disabledcommandhere
network_compression_threshold: 256
groups:
  md_5:
  - admin
connection_throttle: 4000
connection_throttle_limit: 3
stats: b15bb4d8-9c4f-4b4e-9e3f-4b4e9e3f4b4e
`;
        await fs.writeFile(configPath, config, 'utf8');
        console.log(`✓ Created ${server.type} config.yml with port ${server.port}`);
    }

    async createVelocityConfig(server) {
        const configPath = path.join(server.path, 'velocity.toml');
        const config = `# Velocity Configuration
# Generated by Minecraft Server Manager

# Config version. Do not change.
config-version = "2.7"

# Bind address. Use 0.0.0.0 for all interfaces
bind = "${server.host}:${server.port}"

# MOTD displayed to players
motd = "<aqua>${server.name}</aqua>"

# Player info forwarding mode. Options: "none", "legacy", "bungeeguard", "modern"
player-info-forwarding-mode = "modern"

# Maximum number of players
show-max-players = 100

# Online mode - verify players with Mojang
online-mode = true

# Prevent proxy connections
prevent-proxy-connections = false

# Announce Forge support
announce-forge = false

# Force key authentication
force-key-authentication = true

# Try order for servers (which server to connect to first)
# Note: Velocity requires a fallback server. Add your first backend server here.
try = []

# Servers accessible through this proxy
[servers]
  # Placeholder fallback server - replace with your first backend server
  # This prevents Velocity from crashing on startup
  lobby = "localhost:25565"

[forced-hosts]
  # Example: "lobby.example.com" = ["lobby"]

[advanced]
  # Compression threshold
  compression-threshold = 256
  
  # Compression level (0-9)
  compression-level = -1
  
  # Login ratelimit
  login-ratelimit = 3000
  
  # Connection timeout
  connection-timeout = 5000
  
  # Read timeout
  read-timeout = 30000
  
  # Proxy protocol
  proxy-protocol = false
  
  # TCP fast open
  tcp-fast-open = false
  
  # BungeeGuard token forwarding
  bungee-plugin-message-channel = true
  
  # Show ping requests
  show-ping-requests = false
  
  # Failover on unexpected server disconnect
  failover-on-unexpected-server-disconnect = true
  
  # Announce proxy commands
  announce-proxy-commands = true
  
  # Log command executions
  log-command-executions = false

[query]
  # Enable query protocol
  enabled = false
  
  # Query port (usually same as bind port)
  port = ${server.port}
  
  # Map name shown in server list
  map = "Velocity"
  
  # Show installed plugins
  show-plugins = false
`;
        await fs.writeFile(configPath, config, 'utf8');
        console.log(`✓ Created velocity.toml with port ${server.port}`);
    }

    async ensureVelocityConfig(server) {
        const toml = require('@iarna/toml');
        const configPath = path.join(server.path, 'velocity.toml');
        const secretPath = path.join(server.path, 'forwarding.secret');
        
        try {
            // Read existing config
            const configContent = await fs.readFile(configPath, 'utf8');
            const config = toml.parse(configContent);
            
            // Check if forwarding.secret file exists and read it
            try {
                const forwardingSecret = await fs.readFile(secretPath, 'utf8');
                if (forwardingSecret && forwardingSecret.trim()) {
                    config['forwarding-secret'] = forwardingSecret.trim();
                }
            } catch (err) {
                // forwarding.secret doesn't exist yet, will be created on first start
                console.log('forwarding.secret will be generated on first start');
            }
            
            // Ensure try list exists and doesn't reference non-existent servers
            if (!config.try) {
                config.try = [];
            }
            
            // Remove any servers from try list that don't exist in [servers]
            if (config.servers && config.try.length > 0) {
                config.try = config.try.filter(serverName => config.servers[serverName]);
            }
            
            // If no servers exist, ensure try list is empty
            // Velocity will show a warning but won't crash
            if (!config.servers || Object.keys(config.servers).length === 0) {
                config.try = [];
            }
            
            // Remove any forced-hosts that reference non-existent servers
            if (config['forced-hosts']) {
                const validHosts = {};
                for (const [host, servers] of Object.entries(config['forced-hosts'])) {
                    const validServers = servers.filter(s => config.servers && config.servers[s]);
                    if (validServers.length > 0) {
                        validHosts[host] = validServers;
                    }
                }
                config['forced-hosts'] = validHosts;
            }
            
            // Save updated config
            const tomlStr = toml.stringify(config);
            await fs.writeFile(configPath, tomlStr, 'utf8');
            console.log('✓ Validated Velocity configuration');
            
        } catch (error) {
            console.error('Error validating Velocity config:', error.message);
            // Don't throw - let Velocity start and handle it
        }
    }

    async startBackendServers(proxyServerId) {
        try {
            console.log(`[Proxy] startBackendServers called for server ID: ${proxyServerId}`);
            
            const proxyServer = this.servers.get(proxyServerId);
            if (!proxyServer) {
                console.error('[Proxy] Proxy server not found for auto-start backend servers');
                return;
            }

            console.log(`[Proxy] Auto-starting backend servers for ${proxyServer.name} (${proxyServer.type})...`);
            console.log(`[Proxy] Reading config from: ${proxyServer.path}`);

            const proxyManager = require('./proxyManager');
            const backendServers = await proxyManager.getBackendServers(proxyServer.path, proxyServer.type);
            
            console.log(`[Proxy] Found ${backendServers ? backendServers.length : 0} backend servers in config:`, backendServers);

            if (!backendServers || backendServers.length === 0) {
                console.log(`[Proxy] No backend servers configured for ${proxyServer.name}`);
                return;
            }

            const startPromises = [];

            for (const backend of backendServers) {
                // Extract port from address (localhost:25565 -> 25565)
                const match = backend.address.match(/:(\d+)$/);
                if (!match) {
                    console.warn(`[Proxy] Invalid backend address format: ${backend.address}`);
                    continue;
                }

                const port = parseInt(match[1], 10);
                
                // Find server in database by port
                const matchingServer = Array.from(this.servers.values()).find(s => s.port === port);
                
                if (!matchingServer) {
                    console.warn(`[Proxy] Backend server not found for port ${port} (${backend.name})`);
                    continue;
                }

                if (matchingServer.status === 'running') {
                    console.log(`[Proxy] Backend server ${matchingServer.name} already running`);
                    continue;
                }

                console.log(`[Proxy] Starting backend server: ${matchingServer.name} (port ${port})`);
                
                // Start the backend server and wait for it
                const startPromise = this.startServer(matchingServer.id)
                    .then(() => {
                        console.log(`[Proxy] ✓ Backend server ${matchingServer.name} started successfully`);
                    })
                    .catch(err => {
                        console.error(`[Proxy] ✗ Failed to start backend server ${matchingServer.name}:`, err.message);
                    });
                
                startPromises.push(startPromise);
                
                // Small delay between start commands
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Wait for all backend servers to start
            if (startPromises.length > 0) {
                console.log(`[Proxy] Waiting for ${startPromises.length} backend server(s) to start...`);
                await Promise.allSettled(startPromises);
                
                // Additional delay to ensure servers are fully ready
                console.log(`[Proxy] Waiting 5 seconds for backend servers to be fully ready...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }

            console.log(`[Proxy] Backend server auto-start complete for ${proxyServer.name}`);
        } catch (error) {
            console.error('[Proxy] Error auto-starting backend servers:', error.message);
        }
    }

    /**
     * Stop all backend servers for a proxy
     */
    async stopBackendServers(proxyServerId) {
        try {
            console.log(`[Proxy] stopBackendServers called for server ID: ${proxyServerId}`);
            
            const proxyServer = this.servers.get(proxyServerId);
            if (!proxyServer) {
                console.error('[Proxy] Proxy server not found for auto-stop backend servers');
                return;
            }

            console.log(`[Proxy] Auto-stopping backend servers for ${proxyServer.name} (${proxyServer.type})...`);

            const proxyManager = require('./proxyManager');
            const backendServers = await proxyManager.getBackendServers(proxyServer.path, proxyServer.type);
            
            if (!backendServers || backendServers.length === 0) {
                console.log(`[Proxy] No backend servers configured for ${proxyServer.name}`);
                return;
            }

            const stopPromises = [];

            for (const backend of backendServers) {
                // Extract port from address
                const match = backend.address.match(/:(\d+)$/);
                if (!match) continue;

                const port = parseInt(match[1], 10);
                
                // Find server in database by port
                const matchingServer = Array.from(this.servers.values()).find(s => s.port === port);
                
                if (!matchingServer) {
                    console.warn(`[Proxy] Backend server not found for port ${port} (${backend.name})`);
                    continue;
                }

                if (matchingServer.status !== 'running') {
                    console.log(`[Proxy] Backend server ${matchingServer.name} already stopped`);
                    continue;
                }

                console.log(`[Proxy] Stopping backend server: ${matchingServer.name} (port ${port})`);
                
                // Stop server without triggering backend stop (prevent recursion)
                const stopPromise = this.stopServer(matchingServer.id, true)
                    .then(() => {
                        console.log(`[Proxy] ✓ Backend server ${matchingServer.name} stopped successfully`);
                    })
                    .catch(err => {
                        console.error(`[Proxy] ✗ Failed to stop backend server ${matchingServer.name}:`, err.message);
                    });
                
                stopPromises.push(stopPromise);
                
                // Small delay between stop commands
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Wait for all backend servers to stop
            if (stopPromises.length > 0) {
                console.log(`[Proxy] Waiting for ${stopPromises.length} backend server(s) to stop...`);
                await Promise.allSettled(stopPromises);
            }

            console.log(`[Proxy] Backend server auto-stop complete for ${proxyServer.name}`);
        } catch (error) {
            console.error('[Proxy] Error auto-stopping backend servers:', error.message);
        }
    }

    async deleteServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error('Server not found');
        }

        // Stop server if running
        if (server.status === 'running') {
            await this.stopServer(serverId);
        }

        // Delete server directory
        await fs.rm(server.path, { recursive: true, force: true });

        // Remove from database
        this.servers.delete(serverId);
        await this.saveDatabase();

        console.log(`✓ Server deleted: ${server.name}`);
        return { success: true };
    }

    async startServer(serverId) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error('Server not found');
        }

        if (server.status === 'running') {
            throw new Error('Server is already running');
        }

        // For Velocity proxies: Ensure forwarding-secret is set and config is valid
        if (server.type === 'velocity') {
            await this.ensureVelocityConfig(server);
        }

        // Clear session locks before starting (only for Minecraft servers, not proxies)
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            await this.clearSessionLocks(server.path);
        }

        const { spawn } = require('child_process');
        
        // Determine JAR filename based on server type
        let jarFilename = 'server.jar';
        if (server.type === 'velocity') {
            jarFilename = 'velocity.jar';
        } else if (server.type === 'bungeecord') {
            jarFilename = 'bungeecord.jar';
        } else if (server.type === 'waterfall') {
            jarFilename = 'waterfall.jar';
        }
        
        // Check if JAR file exists
        const jarPath = path.join(server.path, jarFilename);
        try {
            await fs.access(jarPath);
        } catch (error) {
            throw new Error(`Server JAR file (${jarFilename}) not found. Please download server files first.`);
        }

        // Start server process
        const args = [
            `-Xmx${server.memory}`,
            `-Xms${server.memory}`,
            '-jar',
            jarFilename,
            'nogui'
        ];

        const process = spawn('java', args, {
            cwd: server.path,
            stdio: ['pipe', 'pipe', 'pipe']
        });

        // Store process
        this.processes.set(serverId, process);

        // Update server status
        server.status = 'running';
        server.startedAt = new Date().toISOString();
        await this.saveDatabase();
        
        // Start proxy monitoring if this is a proxy server
        if (server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity') {
            const proxyMonitor = require('./proxyMonitor');
            proxyMonitor.startMonitoring(server);
            
            // Auto-start backend servers
            await this.startBackendServers(serverId);
        }

        // Handle process events
        process.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[${server.name}] ${output}`);
            
            // Parse TPS from output (Paper/Spigot format: "TPS from last 1m, 5m, 15m: 20.0, 20.0, 20.0" or "20,0, 20,0, 20,0")
            const tpsMatch = output.match(/TPS from last \d+m(?:, \d+m)*: ([\d.,]+)/);
            if (tpsMatch) {
                // Replace comma with dot for decimal separator (German locale)
                const tpsString = tpsMatch[1].replace(',', '.');
                const tps = Number.parseFloat(tpsString);
                const resourceMonitor = require('./resourceMonitor');
                resourceMonitor.updateTPS(serverId, tps);
            }
            
            // Emit to WebSocket clients subscribed to this server
            if (this.io) {
                this.io.to(`server-${serverId}`).emit('console-log', {
                    serverId,
                    type: 'stdout',
                    message: output,
                    timestamp: new Date().toISOString()
                });
            }
        });

        process.stdout.on('data', (data) => {
            const output = data.toString();
            console.log(`[${server.name}]`, output.trim());
            
            // Check for player join/leave events
            if (this.notificationManager) {
                const playerEvent = this.notificationManager.parsePlayerEvent(output);
                if (playerEvent) {
                    this.notificationManager.sendNotification(serverId, playerEvent.type, {
                        serverName: server.name,
                        serverType: server.type,
                        playerName: playerEvent.playerName,
                        timestamp: new Date().toISOString()
                    });
                }
            }
            
            // Emit to WebSocket clients
            if (this.io) {
                this.io.to(`server-${serverId}`).emit('console-log', {
                    serverId,
                    type: 'stdout',
                    message: output,
                    timestamp: new Date().toISOString()
                });
            }
        });

        process.on('close', (code) => {
            console.log(`[${server.name}] Process exited with code ${code}`);
            server.status = 'stopped';
            this.processes.delete(serverId);
            this.saveDatabase();
            
            // Stop resource monitoring
            const resourceMonitor = require('./resourceMonitor');
            resourceMonitor.stopMonitoring(serverId);
            
            // Send notification for stop/crash
            if (this.notificationManager) {
                const eventType = code !== 0 ? 'crash' : 'stop';
                this.notificationManager.sendNotification(serverId, eventType, {
                    serverName: server.name,
                    serverType: server.type,
                    exitCode: code,
                    message: code !== 0 ? `Server crashed with exit code ${code}` : 'Server stopped normally',
                    timestamp: new Date().toISOString()
                });
            }
            
            // Notify WebSocket clients
            if (this.io) {
                this.io.to(`server-${serverId}`).emit('server-status', {
                    serverId,
                    status: 'stopped',
                    exitCode: code
                });
            }
        });

        console.log(`✓ Server started: ${server.name}`);
        
        // Send notification for server start
        if (this.notificationManager) {
            await this.notificationManager.sendNotification(serverId, 'start', {
                serverName: server.name,
                serverType: server.type,
                timestamp: new Date().toISOString()
            });
        }
        
        // Start resource monitoring
        const resourceMonitor = require('./resourceMonitor');
        resourceMonitor.startMonitoring(serverId, process.pid, process);
        
        return server;
    }

    async stopServer(serverId, skipBackends = false) {
        const server = this.servers.get(serverId);
        if (!server) {
            throw new Error('Server not found');
        }

        const process = this.processes.get(serverId);
        if (!process) {
            throw new Error('Server is not running');
        }

        // Stop backend servers if this is a proxy server (unless we're already stopping from a proxy)
        if (!skipBackends && (server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity')) {
            console.log(`[Proxy] Stopping backend servers for proxy ${server.name}...`);
            await this.stopBackendServers(serverId);
        }

        // Send stop command
        process.stdin.write('stop\n');
        
        // Stop resource monitoring
        const resourceMonitor = require('./resourceMonitor');
        resourceMonitor.stopMonitoring(serverId);
        
        // Stop proxy monitoring if this is a proxy server
        if (server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity') {
            const proxyMonitor = require('./proxyMonitor');
            proxyMonitor.stopMonitoring(serverId);
        }

        // Wait for graceful shutdown (max 30 seconds)
        await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                process.kill('SIGTERM');
                resolve();
            }, 30000);

            process.on('close', () => {
                clearTimeout(timeout);
                resolve();
            });
        });

        server.status = 'stopped';
        await this.saveDatabase();

        console.log(`✓ Server stopped: ${server.name}`);
        return server;
    }

    async restartServer(serverId) {
        await this.stopServer(serverId);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        return await this.startServer(serverId);
    }

    getServer(serverId) {
        return this.servers.get(serverId);
    }
    
    getProcess(serverId) {
        return this.processes.get(serverId);
    }

    getAllServers(userId = null, userRole = null) {
        const servers = Array.from(this.servers.values());
        
        // Admins see all servers
        if (userRole === 'admin') {
            return servers;
        }
        
        // Regular users only see their own servers
        if (userId) {
            return servers.filter(server => server.userId === userId);
        }
        
        // No userId provided, return all (for backward compatibility)
        return servers;
    }
    
    canAccessServer(serverId, userId, userRole) {
        const server = this.servers.get(serverId);
        if (!server) return false;
        
        // Admins can access all servers
        if (userRole === 'admin') return true;
        
        // Users can only access their own servers
        return server.userId === userId;
    }

    async sendCommand(serverId, command) {
        const process = this.processes.get(serverId);
        if (!process) {
            throw new Error('Server is not running');
        }

        process.stdin.write(`${command}\n`);
    }

    async stopAllServers() {
        console.log('\nStopping all running servers...');
        const runningServers = Array.from(this.servers.values()).filter(s => s.status === 'running');
        
        for (const server of runningServers) {
            try {
                console.log(`Stopping ${server.name}...`);
                await this.stopServer(server.id);
            } catch (error) {
                console.error(`Error stopping ${server.name}:`, error.message);
                // Force kill if graceful stop fails
                const process = this.processes.get(server.id);
                if (process) {
                    try {
                        process.kill('SIGKILL');
                    } catch (e) {
                        // Process already dead
                    }
                }
            }
        }
        
        // Mark all as stopped and save
        for (const server of this.servers.values()) {
            server.status = 'stopped';
        }
        await this.saveDatabase();
        console.log('✓ All servers stopped');
    }
}

module.exports = new ServerManager();
