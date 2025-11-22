require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const { Rcon } = require('rcon-client');
const serverManager = require('./serverManager');
const serverDownloader = require('./serverDownloader');
const pluginManager = require('./pluginManager');
const resourceMonitor = require('./resourceMonitor');
const backupManager = require('./backupManager');
const authManager = require('./authManager');
const taskScheduler = require('./taskScheduler');
const notificationManager = require('./notificationManager');
const logManager = require('./logManager');
const worldManager = require('./worldManager');
const PlayerManager = require('./playerManager');
const proxyManager = require('./proxyManager');
const proxyMonitor = require('./proxyMonitor');

const app = express();
const playerManager = new PlayerManager(serverManager);
const server = http.createServer(app);

// CORS Configuration - Environment-based for Production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:5173'];

const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? allowedOrigins : "*",
        methods: ["GET", "POST"],
        credentials: true
    }
});
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https://crafatar.com"],
            connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*", "https://cdn.jsdelivr.net"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    crossOriginEmbedderPolicy: false
}));

// Rate Limiting
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 500, // Limit each IP to 500 requests per windowMs (increased for dev)
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => process.env.NODE_ENV !== 'production' // Disable in development
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many login attempts, please try again later.',
    skipSuccessfulRequests: true
});

// Apply rate limiting
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// CORS - Environment-based
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        }
        : '*',
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

// RCON Connection Instance
let rconClient = null;
let isConnected = false;

// WebSocket Connection with Authentication
io.on('connection', (socket) => {
    console.log(`✓ Client connected: ${socket.id}`);
    
    let authenticatedUser = null;
    
    // Authenticate WebSocket connection
    socket.on('authenticate', async (token) => {
        try {
            const decoded = authManager.verifyToken(token);
            authenticatedUser = decoded;
            socket.emit('authenticated', { success: true, user: decoded });
            console.log(`✓ Socket ${socket.id} authenticated as ${decoded.username}`);
        } catch (error) {
            socket.emit('authenticated', { success: false, message: 'Invalid token' });
            console.log(`✗ Socket ${socket.id} authentication failed`);
        }
    });
    
    socket.on('disconnect', () => {
        console.log(`✗ Client disconnected: ${socket.id}`);
    });
    
    socket.on('subscribe-server', (serverId) => {
        // Optional: Check if user has access to this server
        if (authenticatedUser) {
            const canAccess = serverManager.canAccessServer(
                serverId, 
                authenticatedUser.id, 
                authenticatedUser.role
            );
            
            if (!canAccess) {
                socket.emit('subscription-error', { 
                    serverId, 
                    message: 'Keine Berechtigung für diesen Server' 
                });
                return;
            }
        }
        
        socket.join(`server-${serverId}`);
        console.log(`Socket ${socket.id} subscribed to server ${serverId}`);
    });
    
    socket.on('unsubscribe-server', (serverId) => {
        socket.leave(`server-${serverId}`);
        console.log(`Socket ${socket.id} unsubscribed from server ${serverId}`);
    });
});

// Expose io to serverManager and resourceMonitor
serverManager.setSocketIO(io);
resourceMonitor.setSocketIO(io);

// Initialize Task Scheduler
taskScheduler.setServerManager(serverManager);
taskScheduler.setBackupManager(backupManager);

// Initialize Server Manager and Task Scheduler
serverManager.initialize().catch(err => {
    console.error('Failed to initialize server manager:', err);
});

taskScheduler.initialize().catch(err => {
    console.error('Failed to initialize task scheduler:', err);
});

notificationManager.initialize().catch(err => {
    console.error('Failed to initialize notification manager:', err);
});

// Set notification manager in serverManager for event notifications
serverManager.setNotificationManager(notificationManager);

// API Routes

/**
 * Connect to Minecraft Server via RCON
 * POST /api/connect
 * Body: { host, port, password }
 */
app.post('/api/connect', async (req, res) => {
    try {
        const { host, port, password } = req.body;

        if (!host || !port || !password) {
            return res.status(400).json({
                success: false,
                message: 'Host, Port und Passwort sind erforderlich'
            });
        }

        // Disconnect existing connection if any
        if (rconClient) {
            try {
                await rconClient.end();
            } catch (error) {
                console.log('Previous connection cleanup:', error.message);
            }
        }

        // Create new RCON connection
        rconClient = new Rcon({
            host: host,
            port: Number.parseInt(port, 10),
            password: password,
            timeout: 5000
        });

        // Connect to server
        await rconClient.connect();
        isConnected = true;

        console.log(`✓ Connected to ${host}:${port}`);

        res.json({
            success: true,
            message: 'Erfolgreich mit Server verbunden',
            server: { host, port }
        });

    } catch (error) {
        console.error('Connection error:', error);
        isConnected = false;
        rconClient = null;

        res.status(500).json({
            success: false,
            message: `Verbindungsfehler: ${error.message}`
        });
    }
});

/**
 * Disconnect from Minecraft Server
 * POST /api/disconnect
 */
app.post('/api/disconnect', async (req, res) => {
    try {
        if (rconClient) {
            await rconClient.end();
            rconClient = null;
            isConnected = false;
            console.log('✓ Disconnected from server');
        }

        res.json({
            success: true,
            message: 'Verbindung getrennt'
        });

    } catch (error) {
        console.error('Disconnect error:', error);
        res.status(500).json({
            success: false,
            message: `Fehler beim Trennen: ${error.message}`
        });
    }
});

/**
 * Execute RCON Command
 * POST /api/command
 * Body: { command }
 */
app.post('/api/command', async (req, res) => {
    try {
        if (!rconClient || !isConnected) {
            return res.status(400).json({
                success: false,
                message: 'Nicht mit Server verbunden'
            });
        }

        const { command } = req.body;

        if (!command) {
            return res.status(400).json({
                success: false,
                message: 'Befehl ist erforderlich'
            });
        }

        // Execute command
        const response = await rconClient.send(command);
        
        console.log(`Command: ${command} | Response: ${response}`);

        res.json({
            success: true,
            command: command,
            response: response || 'Befehl ausgeführt (keine Antwort)'
        });

    } catch (error) {
        console.error('Command error:', error);
        
        // Connection might be lost
        if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
            isConnected = false;
            rconClient = null;
        }

        res.status(500).json({
            success: false,
            message: `Befehlsfehler: ${error.message}`
        });
    }
});

/**
 * Get Connection Status
 * GET /api/status
 */
app.get('/api/status', (req, res) => {
    res.json({
        connected: isConnected,
        hasClient: rconClient !== null
    });
});

/**
 * Health Check
 * GET /api/health
 */
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// SERVER MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Get system-wide resource statistics
 * GET /api/system/stats
 * Protected: Requires authentication
 */
app.get('/api/system/stats', authManager.authMiddleware, async (req, res) => {
    try {
        const systemStats = await resourceMonitor.getSystemStats();
        
        res.json({
            success: true,
            stats: systemStats
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Abrufen der Systemstatistiken: ${error.message}`
        });
    }
});

/**
 * Get all servers
 * GET /api/servers
 * Protected: Requires authentication, returns user's servers only (or all for admin)
 */
app.get('/api/servers', authManager.authMiddleware, async (req, res) => {
    try {
        let servers = serverManager.getAllServers(req.user.id, req.user.role);
        
        // Filter out servers that are backend servers in proxy configurations
        const backendServerPorts = new Set();
        
        // Check all proxy servers for their backend configurations
        for (const server of servers) {
            if (server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity') {
                try {
                    const backendServers = await proxyManager.getBackendServers(server.path, server.type);
                    // Extract ports from addresses (format: "localhost:25565")
                    for (const backend of backendServers) {
                        const match = backend.address.match(/:(\d+)$/);
                        if (match) {
                            backendServerPorts.add(parseInt(match[1], 10));
                        }
                    }
                } catch (error) {
                    // Proxy config might not exist yet, skip
                    console.log(`Could not read proxy config for ${server.name}:`, error.message);
                }
            }
        }
        
        // Filter out servers whose ports are used as backend servers
        servers = servers.filter(server => {
            // Keep proxy servers themselves
            if (server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity') {
                return true;
            }
            // Filter out servers that are backend servers
            return !backendServerPorts.has(server.port);
        });
        
        res.json({
            success: true,
            servers
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get server by ID
 * GET /api/servers/:id
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id', authManager.authMiddleware, (req, res) => {
    try {
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }
        
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        res.json({
            success: true,
            server
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get server resource stats
 * GET /api/servers/:id/stats
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/stats', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }
        
        if (server.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Server is not running'
            });
        }
        
        const process = serverManager.getProcess(req.params.id);
        if (!process) {
            return res.status(400).json({
                success: false,
                message: 'Server process not found'
            });
        }
        
        const stats = await resourceMonitor.getProcessStats(process.pid);
        const systemStats = await resourceMonitor.getSystemStats();
        
        res.json({
            success: true,
            stats: {
                process: stats,
                system: systemStats
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Create new server
 * POST /api/servers/create
 * Body: { name, type, version, port, rconPort, rconPassword, memory }
 * Protected: Requires authentication
*/
app.post('/api/servers/create', authManager.authMiddleware, async (req, res) => {
    try {
        const { name, type, version, port, rconPort, rconPassword, memory } = req.body;

        if (!name || !type || !version) {
            return res.status(400).json({
                success: false,
                message: 'Name, Typ und Version sind erforderlich'
            });
        }

        // Create server entry with owner userId
        const server = await serverManager.createServer({
            name,
            type,
            version,
            port,
            rconPort,
            rconPassword,
            memory
        }, req.user.id);

        // Download server files
        console.log(`Downloading ${type} ${version}...`);
        await serverDownloader.downloadServer(type, version, server.path);

        res.json({
            success: true,
            message: 'Server erfolgreich erstellt',
            server
        });

    } catch (error) {
        console.error('Server creation error:', error);
        res.status(500).json({
            success: false,
            message: `Fehler beim Erstellen: ${error.message}`
        });
    }
});

/**
 * Start server
 * POST /api/servers/:id/start
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/start', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = await serverManager.startServer(req.params.id);
        res.json({
            success: true,
            message: 'Server gestartet',
            server
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Stop server
 * POST /api/servers/:id/stop
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/stop', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = await serverManager.stopServer(req.params.id);
        res.json({
            success: true,
            message: 'Server gestoppt',
            server
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Restart server
 * POST /api/servers/:id/restart
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/restart', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = await serverManager.restartServer(req.params.id);
        res.json({
            success: true,
            message: 'Server neugestartet',
            server
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Delete server
 * DELETE /api/servers/:id
 * Protected: Requires authentication and server access
 */
app.delete('/api/servers/:id', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        await serverManager.deleteServer(req.params.id);
        res.json({
            success: true,
            message: 'Server gelöscht'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Send command to server
 * POST /api/servers/:id/command
 * Body: { command }
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/command', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const { command } = req.body;
        if (!command) {
            return res.status(400).json({
                success: false,
                message: 'Befehl ist erforderlich'
            });
        }

        await serverManager.sendCommand(req.params.id, command);
        res.json({
            success: true,
            message: 'Befehl gesendet'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get available versions for server type
 * GET /api/versions/:type
 */
app.get('/api/versions/:type', async (req, res) => {
    try {
        const versions = await serverDownloader.getAvailableVersions(req.params.type);
        res.json({
            success: true,
            versions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// TEMPLATE ENDPOINTS
// ==========================================

/**
 * Get server templates
 * GET /api/templates
 * Protected: Requires authentication
 */
app.get('/api/templates', authManager.authMiddleware, (req, res) => {
    try {
        const templatesPath = path.join(__dirname, '..', 'data', 'templates.json');
        const templatesData = require('fs').readFileSync(templatesPath, 'utf8');
        const templates = JSON.parse(templatesData);

        res.json({
            success: true,
            templates: templates.templates
        });
    } catch (error) {
        console.error('Error loading templates:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load templates',
            error: error.message
        });
    }
});

// ==========================================
// BACKUP/RESTORE ENDPOINTS
// ==========================================

/**
 * Create a backup of a server
 * POST /api/servers/:id/backup
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/backup', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const serverId = req.params.id;
        const { name } = req.body;
        const server = serverManager.getServer(serverId);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const backup = await backupManager.createBackup(serverId, server.path, name);

        res.json({
            success: true,
            message: 'Backup created successfully',
            backup: backup
        });
    } catch (error) {
        console.error('Error creating backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create backup',
            error: error.message
        });
    }
});

/**
 * List all backups for a server
 * GET /api/servers/:id/backups
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/backups', authManager.authMiddleware, (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const serverId = req.params.id;
        const server = serverManager.getServer(serverId);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const backups = backupManager.listBackups(serverId);

        res.json({
            success: true,
            backups: backups
        });
    } catch (error) {
        console.error('Error listing backups:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to list backups',
            error: error.message
        });
    }
});

/**
 * Restore a backup
 * POST /api/servers/:id/restore/:backupId
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/restore/:backupId', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const { id: serverId, backupId } = req.params;
        const server = serverManager.getServer(serverId);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        // Stop server if running
        if (server.status === 'running') {
            await serverManager.stopServer(serverId);
        }

        await backupManager.restoreBackup(serverId, backupId, server.path);

        res.json({
            success: true,
            message: 'Backup restored successfully'
        });
    } catch (error) {
        console.error('Error restoring backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to restore backup',
            error: error.message
        });
    }
});

/**
 * Delete a backup
 * DELETE /api/servers/:id/backups/:backupId
 * Protected: Requires authentication and server access
 */
app.delete('/api/servers/:id/backups/:backupId', authManager.authMiddleware, (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const { id: serverId, backupId } = req.params;
        const server = serverManager.getServer(serverId);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        backupManager.deleteBackup(serverId, backupId);

        res.json({
            success: true,
            message: 'Backup deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete backup',
            error: error.message
        });
    }
});

/**
 * Download a backup
 * GET /api/servers/:id/backups/:backupId/download
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/backups/:backupId/download', authManager.authMiddleware, (req, res) => {
    // Check permission
    if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
        return res.status(403).json({
            success: false,
            message: 'Keine Berechtigung für diesen Server'
        });
    }
    
    try {
        const { id: serverId, backupId } = req.params;
        const server = serverManager.getServer(serverId);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const backupPath = backupManager.getBackupPath(serverId, backupId);
        res.download(backupPath, `${backupId}.zip`);
    } catch (error) {
        console.error('Error downloading backup:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to download backup',
            error: error.message
        });
    }
});

// ==========================================
// PLUGIN/MOD MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Search for plugins/mods
 * GET /api/plugins/search?q=query&type=paper&version=1.20.4&source=modrinth
 */
app.get('/api/plugins/search', async (req, res) => {
    try {
        const { q, type, version, source } = req.query;

        if (!q) {
            return res.status(400).json({
                success: false,
                message: 'Search query required'
            });
        }

        let results = [];

        if (!source || source === 'modrinth') {
            const modrinthResults = await pluginManager.searchModrinth(q, type, version);
            results = results.concat(modrinthResults);
        }

        if (!source || source === 'spigot') {
            const spigotResults = await pluginManager.searchSpigot(q);
            results = results.concat(spigotResults);
        }

        res.json({
            success: true,
            results,
            count: results.length
        });
    } catch (error) {
        console.error('Plugin search error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Get plugin versions
 * GET /api/plugins/:source/:id/versions?mcVersion=1.20.4
 */
app.get('/api/plugins/:source/:id/versions', async (req, res) => {
    try {
        const { source, id } = req.params;
        const { mcVersion } = req.query;

        let versions = [];

        if (source === 'modrinth') {
            versions = await pluginManager.getModrinthVersions(id, mcVersion);
        } else if (source === 'spigot') {
            const details = await pluginManager.getSpigotDetails(id);
            versions = details?.versions || [];
        }

        res.json({
            success: true,
            versions
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Install plugin/mod to server
 * POST /api/servers/:id/plugins/install
 * Body: { url, filename }
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/plugins/install', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const { url, filename } = req.body;

        if (!url || !filename) {
            return res.status(400).json({
                success: false,
                message: 'URL and filename required'
            });
        }

        const result = await pluginManager.installToServer(
            server.id,
            server.path,
            server.type,
            { url, filename }
        );

        res.json({
            success: true,
            message: `${filename} installed successfully`,
            ...result
        });
    } catch (error) {
        console.error('Plugin install error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * List installed plugins/mods
 * GET /api/servers/:id/plugins
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/plugins', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const plugins = await pluginManager.listInstalled(server.path, server.type);

        res.json({
            success: true,
            plugins,
            count: plugins.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Uninstall plugin/mod
 * DELETE /api/servers/:id/plugins/:filename
 * Protected: Requires authentication and server access
 */
app.delete('/api/servers/:id/plugins/:filename', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        await pluginManager.uninstall(server.path, server.type, req.params.filename);

        res.json({
            success: true,
            message: 'Plugin uninstalled successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// TASK SCHEDULER ENDPOINTS
// ==========================================

/**
 * Get all scheduled tasks
 * GET /api/tasks
 * Protected: Requires authentication
 */
app.get('/api/tasks', authManager.authMiddleware, async (req, res) => {
    try {
        const tasks = await taskScheduler.getAllTasks();
        
        // Filter tasks based on user permissions
        const userTasks = tasks.filter(task => {
            if (req.user.role === 'admin') return true;
            return serverManager.canAccessServer(task.serverId, req.user.id, req.user.role);
        });

        res.json({
            success: true,
            tasks: userTasks
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Abrufen der Tasks: ${error.message}`
        });
    }
});

/**
 * Get task execution log
 * GET /api/tasks/log
 * Protected: Requires authentication
 */
app.get('/api/tasks/log', authManager.authMiddleware, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const log = taskScheduler.getExecutionLog(limit);

        res.json({
            success: true,
            log
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Abrufen des Logs: ${error.message}`
        });
    }
});

/**
 * Create new scheduled task
 * POST /api/tasks
 * Protected: Requires authentication and server access
 */
app.post('/api/tasks', authManager.authMiddleware, async (req, res) => {
    try {
        const { name, type, serverId, cronExpression, command, enabled } = req.body;

        // Validate input
        if (!name || !type || !serverId || !cronExpression) {
            return res.status(400).json({
                success: false,
                message: 'Name, type, serverId und cronExpression sind erforderlich'
            });
        }

        // Check server access permission
        if (!serverManager.canAccessServer(serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        // Validate server exists
        const server = serverManager.getServer(serverId);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Validate task type
        const validTypes = ['backup', 'restart', 'command', 'start', 'stop'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                success: false,
                message: `Ungültiger Task-Typ. Erlaubte Typen: ${validTypes.join(', ')}`
            });
        }

        // For command type, command is required
        if (type === 'command' && !command) {
            return res.status(400).json({
                success: false,
                message: 'Befehl ist für command-Tasks erforderlich'
            });
        }

        const task = await taskScheduler.createTask({
            name,
            type,
            serverId,
            cronExpression,
            command,
            enabled
        });

        res.json({
            success: true,
            task,
            message: 'Task erfolgreich erstellt'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Erstellen des Tasks: ${error.message}`
        });
    }
});

/**
 * Update scheduled task
 * PUT /api/tasks/:id
 * Protected: Requires authentication and server access
 */
app.put('/api/tasks/:id', authManager.authMiddleware, async (req, res) => {
    try {
        const tasks = await taskScheduler.getAllTasks();
        const task = tasks.find(t => t.id === req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task nicht gefunden'
            });
        }

        // Check permission for the task's server
        if (!serverManager.canAccessServer(task.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Task'
            });
        }

        const updatedTask = await taskScheduler.updateTask(req.params.id, req.body);

        res.json({
            success: true,
            task: updatedTask,
            message: 'Task erfolgreich aktualisiert'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Aktualisieren des Tasks: ${error.message}`
        });
    }
});

/**
 * Toggle task enabled/disabled
 * POST /api/tasks/:id/toggle
 * Protected: Requires authentication and server access
 */
app.post('/api/tasks/:id/toggle', authManager.authMiddleware, async (req, res) => {
    try {
        const tasks = await taskScheduler.getAllTasks();
        const task = tasks.find(t => t.id === req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task nicht gefunden'
            });
        }

        // Check permission
        if (!serverManager.canAccessServer(task.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Task'
            });
        }

        const updatedTask = await taskScheduler.toggleTask(req.params.id);

        res.json({
            success: true,
            task: updatedTask,
            message: `Task ${updatedTask.enabled ? 'aktiviert' : 'deaktiviert'}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Umschalten des Tasks: ${error.message}`
        });
    }
});

/**
 * Delete scheduled task
 * DELETE /api/tasks/:id
 * Protected: Requires authentication and server access
 */
app.delete('/api/tasks/:id', authManager.authMiddleware, async (req, res) => {
    try {
        const tasks = await taskScheduler.getAllTasks();
        const task = tasks.find(t => t.id === req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task nicht gefunden'
            });
        }

        // Check permission
        if (!serverManager.canAccessServer(task.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Task'
            });
        }

        await taskScheduler.deleteTask(req.params.id);

        res.json({
            success: true,
            message: 'Task erfolgreich gelöscht'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Löschen des Tasks: ${error.message}`
        });
    }
});

/**
 * Execute task immediately (manual trigger)
 * POST /api/tasks/:id/execute
 * Protected: Requires authentication and server access
 */
app.post('/api/tasks/:id/execute', authManager.authMiddleware, async (req, res) => {
    try {
        const tasks = await taskScheduler.getAllTasks();
        const task = tasks.find(t => t.id === req.params.id);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: 'Task nicht gefunden'
            });
        }

        // Check permission
        if (!serverManager.canAccessServer(task.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Task'
            });
        }

        // Execute task without waiting for completion
        taskScheduler.executeTask(task).catch(err => {
            console.error('Task execution error:', err);
        });

        res.json({
            success: true,
            message: 'Task wird ausgeführt'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Ausführen des Tasks: ${error.message}`
        });
    }
});

// ==========================================
// WEBHOOK/NOTIFICATION ENDPOINTS
// ==========================================

/**
 * Get all webhooks
 * GET /api/webhooks
 * Protected: Requires authentication
 */
app.get('/api/webhooks', authManager.authMiddleware, async (req, res) => {
    try {
        const webhooks = await notificationManager.getAllWebhooks();
        
        // For now, all authenticated users can see all webhooks
        // TODO: Implement per-user webhook filtering based on server access
        res.json({
            success: true,
            webhooks: webhooks
        });
    } catch (error) {
        console.error('Error fetching webhooks:', error);
        res.status(500).json({
            success: false,
            message: `Fehler beim Abrufen der Webhooks: ${error.message}`
        });
    }
});

/**
 * Create new webhook
 * POST /api/webhooks
 * Protected: Requires authentication and server access
 */
app.post('/api/webhooks', authManager.authMiddleware, async (req, res) => {
    try {
        const { name, serverId, url, type, events, enabled } = req.body;

        // Validate input
        if (!name || !serverId || !url) {
            return res.status(400).json({
                success: false,
                message: 'Name, serverId und URL sind erforderlich'
            });
        }

        // Check server access permission
        if (!serverManager.canAccessServer(serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        // Validate server exists
        const server = serverManager.getServer(serverId);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        const webhook = await notificationManager.createWebhook({
            name,
            serverId,
            url,
            type: type || 'discord',
            events: events || ['crash', 'start', 'stop'],
            enabled
        });

        res.json({
            success: true,
            webhook,
            message: 'Webhook erfolgreich erstellt'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Erstellen des Webhooks: ${error.message}`
        });
    }
});

/**
 * Update webhook
 * PUT /api/webhooks/:id
 * Protected: Requires authentication and server access
 */
app.put('/api/webhooks/:id', authManager.authMiddleware, async (req, res) => {
    try {
        const webhooks = await notificationManager.getAllWebhooks();
        const webhook = webhooks.find(w => w.id === req.params.id);

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook nicht gefunden'
            });
        }

        // Check permission for the webhook's server
        if (!serverManager.canAccessServer(webhook.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Webhook'
            });
        }

        const updatedWebhook = await notificationManager.updateWebhook(req.params.id, req.body);

        res.json({
            success: true,
            webhook: updatedWebhook,
            message: 'Webhook erfolgreich aktualisiert'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Aktualisieren des Webhooks: ${error.message}`
        });
    }
});

/**
 * Toggle webhook enabled/disabled
 * POST /api/webhooks/:id/toggle
 * Protected: Requires authentication and server access
 */
app.post('/api/webhooks/:id/toggle', authManager.authMiddleware, async (req, res) => {
    try {
        const webhooks = await notificationManager.getAllWebhooks();
        const webhook = webhooks.find(w => w.id === req.params.id);

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook nicht gefunden'
            });
        }

        // Check permission
        if (!serverManager.canAccessServer(webhook.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Webhook'
            });
        }

        const updatedWebhook = await notificationManager.toggleWebhook(req.params.id);

        res.json({
            success: true,
            webhook: updatedWebhook,
            message: `Webhook ${updatedWebhook.enabled ? 'aktiviert' : 'deaktiviert'}`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Umschalten des Webhooks: ${error.message}`
        });
    }
});

/**
 * Delete webhook
 * DELETE /api/webhooks/:id
 * Protected: Requires authentication and server access
 */
app.delete('/api/webhooks/:id', authManager.authMiddleware, async (req, res) => {
    try {
        const webhooks = await notificationManager.getAllWebhooks();
        const webhook = webhooks.find(w => w.id === req.params.id);

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook nicht gefunden'
            });
        }

        // Check permission
        if (!serverManager.canAccessServer(webhook.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Webhook'
            });
        }

        await notificationManager.deleteWebhook(req.params.id);

        res.json({
            success: true,
            message: 'Webhook erfolgreich gelöscht'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Löschen des Webhooks: ${error.message}`
        });
    }
});

/**
 * Test webhook (send test notification)
 * POST /api/webhooks/:id/test
 * Protected: Requires authentication and server access
 */
app.post('/api/webhooks/:id/test', authManager.authMiddleware, async (req, res) => {
    try {
        const webhooks = await notificationManager.getAllWebhooks();
        const webhook = webhooks.find(w => w.id === req.params.id);

        if (!webhook) {
            return res.status(404).json({
                success: false,
                message: 'Webhook nicht gefunden'
            });
        }

        // Check permission
        if (!serverManager.canAccessServer(webhook.serverId, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Webhook'
            });
        }

        const server = serverManager.getServer(webhook.serverId);
        
        // Send test notification
        await notificationManager.sendToWebhook(webhook, 'start', {
            serverName: server ? server.name : 'Test Server',
            serverType: server ? server.type : 'paper',
            message: '🧪 Test-Benachrichtigung vom Minecraft Server Manager',
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Test-Benachrichtigung gesendet'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: `Fehler beim Senden der Test-Benachrichtigung: ${error.message}`
        });
    }
});

// ==========================================
// LOG VIEWER ENDPOINTS
// ==========================================

/**
 * Get server logs
 * GET /api/servers/:id/logs
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/logs', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const options = {
            lines: parseInt(req.query.lines) || 100,
            logType: req.query.logType || 'latest',
            level: req.query.level || null,
            search: req.query.search || null,
            startLine: parseInt(req.query.startLine) || 0
        };

        const logs = await logManager.readLogs(server.path, options);

        res.json({
            success: true,
            logs,
            count: logs.length
        });
    } catch (error) {
        console.error('Error reading logs:', error);
        res.status(500).json({
            success: false,
            message: `Failed to read logs: ${error.message}`
        });
    }
});

/**
 * Get available log files
 * GET /api/servers/:id/logs/files
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/logs/files', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const files = await logManager.getAvailableLogs(server.path);

        res.json({
            success: true,
            files
        });
    } catch (error) {
        console.error('Error getting log files:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get log files: ${error.message}`
        });
    }
});

/**
 * Get log statistics
 * GET /api/servers/:id/logs/stats
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/logs/stats', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const stats = await logManager.getLogStats(server.path);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting log stats:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get log stats: ${error.message}`
        });
    }
});

/**
 * Export logs
 * GET /api/servers/:id/logs/export
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/logs/export', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const options = {
            logType: req.query.logType || 'latest',
            level: req.query.level || null,
            search: req.query.search || null
        };

        const content = await logManager.exportLogs(server.path, options);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${server.name}-logs-${timestamp}.txt`;

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(content);
    } catch (error) {
        console.error('Error exporting logs:', error);
        res.status(500).json({
            success: false,
            message: `Failed to export logs: ${error.message}`
        });
    }
});

// ==========================================
// WORLD MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Get world information
 * GET /api/servers/:id/world/info
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/world/info', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const worldInfo = await worldManager.getWorldInfo(server.path);
        const worlds = await worldManager.getWorlds(server.path);

        res.json({
            success: true,
            worldInfo,
            worlds
        });
    } catch (error) {
        console.error('Error getting world info:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get world info: ${error.message}`
        });
    }
});

/**
 * Download world as ZIP
 * GET /api/servers/:id/world/download
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/world/download', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const worldName = req.query.world || 'world';
        const downloadInfo = await worldManager.downloadWorld(server.path, worldName);

        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${downloadInfo.zipName}"`);

        const archive = worldManager.createWorldZipStream(downloadInfo.worldPath);
        
        archive.on('error', (err) => {
            console.error('Archive error:', err);
            if (!res.headersSent) {
                res.status(500).json({
                    success: false,
                    message: 'Error creating archive'
                });
            }
        });

        archive.pipe(res);
        archive.finalize();

    } catch (error) {
        console.error('Error downloading world:', error);
        res.status(500).json({
            success: false,
            message: `Failed to download world: ${error.message}`
        });
    }
});

/**
 * Reset world
 * POST /api/servers/:id/world/reset
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/world/reset', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        // Check if server is running
        if (server.status === 'running') {
            return res.status(400).json({
                success: false,
                message: 'Server muss gestoppt sein um die Welt zurückzusetzen'
            });
        }

        const worldName = req.body.world || 'world';
        const result = await worldManager.resetWorld(server.path, worldName);

        res.json(result);
    } catch (error) {
        console.error('Error resetting world:', error);
        res.status(500).json({
            success: false,
            message: `Failed to reset world: ${error.message}`
        });
    }
});

/**
 * Get gamerules
 * GET /api/servers/:id/world/gamerules
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/world/gamerules', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const gamerules = await worldManager.getGamerules(server.path);

        res.json({
            success: true,
            gamerules
        });
    } catch (error) {
        console.error('Error getting gamerules:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get gamerules: ${error.message}`
        });
    }
});

/**
 * Set gamerule
 * POST /api/servers/:id/world/gamerules
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/world/gamerules', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        if (server.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Server muss laufen um Gamerules zu setzen'
            });
        }

        const { rule, value } = req.body;
        const serverProcess = serverManager.getProcess(req.params.id);
        
        const result = await worldManager.setGamerule(serverProcess, rule, value);

        res.json(result);
    } catch (error) {
        console.error('Error setting gamerule:', error);
        res.status(500).json({
            success: false,
            message: `Failed to set gamerule: ${error.message}`
        });
    }
});

/**
 * Get world border
 * GET /api/servers/:id/world/border
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/world/border', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const border = await worldManager.getWorldBorder(server.path);

        res.json({
            success: true,
            border
        });
    } catch (error) {
        console.error('Error getting world border:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get world border: ${error.message}`
        });
    }
});

/**
 * Set world border
 * POST /api/servers/:id/world/border
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/world/border', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        if (server.status !== 'running') {
            return res.status(400).json({
                success: false,
                message: 'Server muss laufen um Weltgrenze zu setzen'
            });
        }

        const { size, centerX, centerZ } = req.body;
        const serverProcess = serverManager.getProcess(req.params.id);
        
        const result = await worldManager.setWorldBorder(serverProcess, size, centerX, centerZ);

        res.json(result);
    } catch (error) {
        console.error('Error setting world border:', error);
        res.status(500).json({
            success: false,
            message: `Failed to set world border: ${error.message}`
        });
    }
});

// ==========================================
// PROXY MANAGEMENT ENDPOINTS (BungeeCord/Waterfall)
// ==========================================

/**
 * Get backend servers from proxy config
 * GET /api/servers/:id/proxy/servers
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/proxy/servers', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const backendServers = await proxyManager.getBackendServers(server.path, server.type);
        
        res.json({
            success: true,
            servers: backendServers
        });
    } catch (error) {
        console.error('Error getting backend servers:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Laden der Backend-Server'
        });
    }
});

/**
 * Add backend server to proxy config
 * POST /api/servers/:id/proxy/servers
 * Protected: Requires operator or admin
 */
app.post('/api/servers/:id/proxy/servers', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (operator or admin required)
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { name, address, motd, restricted, default: isDefault } = req.body;

        if (!name || !address) {
            return res.status(400).json({
                success: false,
                message: 'Name und Adresse sind erforderlich'
            });
        }

        await proxyManager.addBackendServer(server.path, {
            name,
            address,
            motd,
            restricted,
            default: isDefault
        }, server.type);

        res.json({
            success: true,
            message: `Backend-Server '${name}' hinzugefügt`
        });
    } catch (error) {
        console.error('Error adding backend server:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Hinzufügen des Backend-Servers'
        });
    }
});

/**
 * Update backend server in proxy config
 * PUT /api/servers/:id/proxy/servers/:serverName
 * Protected: Requires operator or admin
 */
app.put('/api/servers/:id/proxy/servers/:serverName', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (operator or admin required)
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { name, address, motd, restricted } = req.body;

        if (!name || !address) {
            return res.status(400).json({
                success: false,
                message: 'Name und Adresse sind erforderlich'
            });
        }

        await proxyManager.updateBackendServer(server.path, req.params.serverName, {
            name,
            address,
            motd,
            restricted
        }, server.type);

        res.json({
            success: true,
            message: `Backend-Server '${name}' aktualisiert`
        });
    } catch (error) {
        console.error('Error updating backend server:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Aktualisieren des Backend-Servers'
        });
    }
});

/**
 * Delete backend server from proxy config
 * DELETE /api/servers/:id/proxy/servers/:serverName
 * Protected: Requires operator or admin
 */
app.delete('/api/servers/:id/proxy/servers/:serverName', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (operator or admin required)
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        await proxyManager.removeBackendServer(server.path, req.params.serverName, server.type);

        res.json({
            success: true,
            message: `Backend-Server '${req.params.serverName}' entfernt`
        });
    } catch (error) {
        console.error('Error removing backend server:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Entfernen des Backend-Servers'
        });
    }
});

/**
 * Set default backend server
 * POST /api/servers/:id/proxy/servers/:serverName/default
 * Protected: Requires operator or admin
 */
app.post('/api/servers/:id/proxy/servers/:serverName/default', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (operator or admin required)
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        await proxyManager.setDefaultServer(server.path, req.params.serverName, server.type);

        res.json({
            success: true,
            message: `'${req.params.serverName}' als Standard-Server gesetzt`
        });
    } catch (error) {
        console.error('Error setting default server:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Setzen des Standard-Servers'
        });
    }
});

/**
 * Get available servers that can be added as backends to proxy
 * GET /api/servers/:id/proxy/available-servers
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/proxy/available-servers', authManager.authMiddleware, async (req, res) => {
    try {
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const proxyServer = serverManager.getServer(req.params.id);
        if (!proxyServer) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        if (proxyServer.type !== 'bungeecord' && proxyServer.type !== 'waterfall' && proxyServer.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const allServers = serverManager.getAllServers();
        const availableServers = allServers.filter(server => {
            return server.type !== 'bungeecord' && 
                   server.type !== 'waterfall' && 
                   server.type !== 'velocity' &&
                   server.id !== proxyServer.id;
        }).map(server => ({
            id: server.id,
            name: server.name,
            type: server.type,
            version: server.version,
            port: server.port,
            status: server.status
        }));

        res.json({
            success: true,
            servers: availableServers
        });
    } catch (error) {
        console.error('Error getting available servers:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Laden der verfügbaren Server'
        });
    }
});

/**
 * Auto-add server as backend to proxy
 * POST /api/servers/:id/proxy/add-server
 * Body: { serverId }
 * Protected: Requires operator or admin
 */
app.post('/api/servers/:id/proxy/add-server', authManager.authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const proxyServer = serverManager.getServer(req.params.id);
        if (!proxyServer) {
            return res.status(404).json({
                success: false,
                message: 'Proxy-Server nicht gefunden'
            });
        }

        if (proxyServer.type !== 'bungeecord' && proxyServer.type !== 'waterfall' && proxyServer.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { serverId } = req.body;
        const backendServer = serverManager.getServer(serverId);
        
        if (!backendServer) {
            return res.status(404).json({
                success: false,
                message: 'Backend-Server nicht gefunden'
            });
        }

        const serverName = backendServer.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const address = `localhost:${backendServer.port}`;
        const motd = backendServer.name;

        await proxyManager.addBackendServer(proxyServer.path, {
            name: serverName,
            address: address,
            motd: motd,
            restricted: false
        }, proxyServer.type);

        res.json({
            success: true,
            message: `Server '${backendServer.name}' wurde als '${serverName}' hinzugefügt`,
            serverName: serverName
        });
    } catch (error) {
        console.error('Error auto-adding backend server:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Hinzufügen des Servers'
        });
    }
});

/**
 * Create new server and add as backend to proxy
 * POST /api/servers/:id/proxy/create-and-add
 * Body: { name, type, port }
 * Protected: Requires operator or admin
 */
app.post('/api/servers/:id/proxy/create-and-add', authManager.authMiddleware, async (req, res) => {
    try {
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const proxyServer = serverManager.getServer(req.params.id);
        if (!proxyServer) {
            return res.status(404).json({
                success: false,
                message: 'Proxy-Server nicht gefunden'
            });
        }

        if (proxyServer.type !== 'bungeecord' && proxyServer.type !== 'waterfall' && proxyServer.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { name, type, version, port } = req.body;

        if (!name || !type || !port) {
            return res.status(400).json({
                success: false,
                message: 'Name, Typ und Port sind erforderlich'
            });
        }

        // Validate port
        if (port < 1024 || port > 65535) {
            return res.status(400).json({
                success: false,
                message: 'Port muss zwischen 1024 und 65535 liegen'
            });
        }

        // Check if port is already in use
        const allServers = serverManager.getAllServers();
        const portInUse = allServers.some(s => s.port === port);
        if (portInUse) {
            return res.status(400).json({
                success: false,
                message: `Port ${port} wird bereits verwendet`
            });
        }

        // Use provided version or get latest
        let serverVersion = version;
        if (!serverVersion) {
            try {
                const versionsResponse = await fetch(`http://localhost:${PORT}/api/versions/${type}`);
                const versionsData = await versionsResponse.json();
                if (versionsData.success && versionsData.versions && versionsData.versions.length > 0) {
                    serverVersion = versionsData.versions[0];
                } else {
                    throw new Error('Keine Versionen verfügbar');
                }
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: `Fehler beim Laden der Versionen: ${error.message}`
                });
            }
        }

        // Create server
        const serverData = {
            name: name,
            type: type,
            version: serverVersion,
            port: port,
            rconPort: port + 10,
            rconPassword: 'rcon123',
            memory: '2G',
            userId: req.user.id
        };

        const newServer = await serverManager.createServer(serverData);

        // Download server JAR file (wait for completion)
        console.log(`[Proxy] Downloading ${type} ${serverVersion} for ${name}...`);
        try {
            await serverDownloader.downloadServer(type, serverVersion, newServer.path);
            console.log(`[Proxy] ✓ Download complete for ${name}`);
        } catch (downloadError) {
            console.error(`[Proxy] ✗ Failed to download server JAR for ${name}:`, downloadError.message);
            // Continue anyway - user can manually download later
        }

        // Configure backend server for proxy compatibility
        console.log(`[Proxy] Configuring ${name} for ${proxyServer.type} proxy compatibility...`);
        try {
            const fs = require('fs').promises;
            const path = require('path');

            // Update server.properties to disable online-mode
            const serverPropertiesPath = path.join(newServer.path, 'server.properties');
            try {
                let propertiesContent = await fs.readFile(serverPropertiesPath, 'utf8');
                propertiesContent = propertiesContent.replace(/online-mode=true/g, 'online-mode=false');
                await fs.writeFile(serverPropertiesPath, propertiesContent, 'utf8');
                console.log(`[Proxy] ✓ Disabled online-mode in server.properties`);
            } catch (err) {
                console.log(`[Proxy] ⚠️ Could not update server.properties: ${err.message}`);
            }

            if (proxyServer.type === 'velocity') {
                // For Velocity: Configure Paper's velocity forwarding
                // Read the forwarding secret from Velocity's config
                const yaml = require('js-yaml');
                const toml = require('@iarna/toml');
                const velocityConfigPath = path.join(proxyServer.path, 'velocity.toml');
                
                let forwardingSecret = 'your-secret-here'; // Default fallback
                try {
                    const velocityConfigContent = await fs.readFile(velocityConfigPath, 'utf8');
                    const velocityConfig = toml.parse(velocityConfigContent);
                    
                    // Extract forwarding secret (Velocity generates it on first start)
                    // The secret is stored in forwarding.secret file
                    const secretPath = path.join(proxyServer.path, 'forwarding.secret');
                    try {
                        forwardingSecret = (await fs.readFile(secretPath, 'utf8')).trim();
                        console.log(`[Proxy] ✓ Read forwarding secret from Velocity proxy`);
                    } catch (secretErr) {
                        console.log(`[Proxy] ⚠️ Forwarding secret not found, using default (proxy needs restart)`);
                    }
                } catch (readErr) {
                    console.log(`[Proxy] ⚠️ Could not read Velocity config: ${readErr.message}`);
                }

                // Create config directory for Paper
                const configDir = path.join(newServer.path, 'config');
                await fs.mkdir(configDir, { recursive: true });

                // Create paper-global.yml with Velocity forwarding
                const paperGlobalPath = path.join(configDir, 'paper-global.yml');
                const paperGlobalYml = {
                    _version: 31,
                    proxies: {
                        velocity: {
                            enabled: true,
                            online_mode: true,
                            secret: forwardingSecret
                        }
                    }
                };
                await fs.writeFile(paperGlobalPath, yaml.dump(paperGlobalYml), 'utf8');
                console.log(`[Proxy] ✓ Created paper-global.yml with Velocity forwarding enabled`);
            } else {
                // For BungeeCord/Waterfall: Use spigot.yml
                const spigotYmlPath = path.join(newServer.path, 'spigot.yml');
                const spigotYml = `settings:
  bungeecord: true
messages:
  restart: Server is restarting
`;
                await fs.writeFile(spigotYmlPath, spigotYml, 'utf8');
                console.log(`[Proxy] ✓ Created spigot.yml with BungeeCord enabled`);
            }
        } catch (configError) {
            console.error(`[Proxy] ⚠️ Failed to configure proxy compatibility:`, configError.message);
        }

        // Add to proxy config
        const serverName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const address = `${proxyServer.host}:${port}`;  // Use proxy's host IP for backend server address

        // For Velocity: Replace the placeholder "lobby" server if this is the first real backend server
        if (proxyServer.type === 'velocity') {
            try {
                const toml = require('@iarna/toml');
                const fsPromises = require('fs').promises;
                const velocityConfigPath = path.join(proxyServer.path, 'velocity.toml');
                const velocityConfigContent = await fsPromises.readFile(velocityConfigPath, 'utf8');
                const velocityConfig = toml.parse(velocityConfigContent);
                
                // If only "lobby" placeholder exists, replace it with the new server
                if (velocityConfig.servers && 
                    Object.keys(velocityConfig.servers).length === 1 && 
                    velocityConfig.servers['lobby']) {
                    
                    console.log(`[Proxy] Replacing placeholder "lobby" server with ${serverName}`);
                    delete velocityConfig.servers['lobby'];
                    velocityConfig.servers[serverName] = address;
                    velocityConfig.try = [serverName]; // First server goes to try[] list
                    
                    // Save updated config
                    const tomlStr = toml.stringify(velocityConfig);
                    await fsPromises.writeFile(velocityConfigPath, tomlStr, 'utf8');
                    console.log(`[Proxy] ✓ Replaced placeholder lobby server`);
                } else {
                    // Add additional servers (without adding to try[] list)
                    await proxyManager.addBackendServer(proxyServer.path, {
                        name: serverName,
                        address: address,
                        motd: name,
                        restricted: false,
                        default: false  // Don't add to try[] list
                    }, proxyServer.type);
                }
            } catch (replaceError) {
                console.error(`[Proxy] ⚠️ Could not replace placeholder:`, replaceError.message);
                // Fallback to normal add
                await proxyManager.addBackendServer(proxyServer.path, {
                    name: serverName,
                    address: address,
                    motd: name,
                    restricted: false,
                    default: false
                }, proxyServer.type);
            }
        } else {
            // BungeeCord/Waterfall: Add to priorities only if first server
            const proxyManager = require('./proxyManager');
            const existingServers = await proxyManager.getBackendServers(proxyServer.path, proxyServer.type);
            const isFirstServer = existingServers.length === 0;
            
            await proxyManager.addBackendServer(proxyServer.path, {
                name: serverName,
                address: address,
                motd: name,
                restricted: false,
                default: isFirstServer  // Only first server to priorities
            }, proxyServer.type);
        }

        console.log(`[Proxy] ✓ Added ${serverName} to proxy config as default server`);
        
        // Verify the configuration was saved correctly
        if (proxyServer.type === 'velocity') {
            try {
                const toml = require('@iarna/toml');
                const fsPromises = require('fs').promises;
                const velocityConfigPath = path.join(proxyServer.path, 'velocity.toml');
                const velocityConfigContent = await fsPromises.readFile(velocityConfigPath, 'utf8');
                const velocityConfig = toml.parse(velocityConfigContent);
                console.log(`[Proxy] Velocity config - servers:`, velocityConfig.servers);
                console.log(`[Proxy] Velocity config - try:`, velocityConfig.try);
            } catch (verifyError) {
                console.error(`[Proxy] ⚠️ Could not verify config:`, verifyError.message);
            }
        }
        
        // Restart proxy to load new backend server configuration
        console.log(`[Proxy] Restarting ${proxyServer.name} to apply configuration changes...`);
        try {
            if (proxyServer.status === 'running') {
                await serverManager.restartServer(proxyServerId);
                console.log(`[Proxy] ✓ ${proxyServer.name} restarted successfully`);
                
                // Wait for proxy to fully start and generate forwarding.secret
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Sync forwarding secret if Velocity
                if (proxyServer.type === 'velocity') {
                    try {
                        const fsPromises = require('fs').promises;
                        const secretPath = path.join(proxyServer.path, 'forwarding.secret');
                        const forwardingSecret = (await fsPromises.readFile(secretPath, 'utf8')).trim();
                        
                        // Update backend server's paper-global.yml with correct secret
                        const yaml = require('js-yaml');
                        const paperGlobalPath = path.join(newServer.path, 'config', 'paper-global.yml');
                        const paperGlobalContent = await fsPromises.readFile(paperGlobalPath, 'utf8');
                        const paperGlobal = yaml.load(paperGlobalContent);
                        paperGlobal.proxies.velocity.secret = forwardingSecret;
                        await fsPromises.writeFile(paperGlobalPath, yaml.dump(paperGlobal), 'utf8');
                        
                        console.log(`[Proxy] ✓ Synced forwarding secret to backend server`);
                        
                        // Restart backend server to apply new secret
                        await serverManager.restartServer(newServer.id);
                        console.log(`[Proxy] ✓ Backend server restarted with synced secret`);
                    } catch (syncError) {
                        console.error(`[Proxy] ⚠️ Failed to sync forwarding secret:`, syncError.message);
                    }
                }
            } else {
                console.log(`[Proxy] ⚠️ Proxy was not running, skipping restart`);
            }
        } catch (restartError) {
            console.error(`[Proxy] ⚠️ Failed to restart proxy:`, restartError.message);
            // Continue anyway - user can manually restart
        }

        res.json({
            success: true,
            message: `Server '${name}' wurde erstellt, konfiguriert und als Backend hinzugefügt. Proxy wurde neu gestartet.`,
            serverId: newServer.id,
            serverName: serverName
        });
    } catch (error) {
        console.error('Error creating and adding server:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Erstellen des Servers'
        });
    }
});

/**
 * Get proxy listener settings
 * GET /api/servers/:id/proxy/settings
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/proxy/settings', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const settings = await proxyManager.getListenerSettings(server.path, server.type);
        
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Error getting listener settings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Laden der Listener-Einstellungen'
        });
    }
});

/**
 * Update proxy listener settings
 * PUT /api/servers/:id/proxy/settings
 * Protected: Requires operator or admin
 */
app.put('/api/servers/:id/proxy/settings', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (operator or admin required)
        if (req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Operator oder Admin-Rechte erforderlich'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        // Only for proxy servers
        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        await proxyManager.updateListenerSettings(server.path, req.body, server.type);

        res.json({
            success: true,
            message: 'Listener-Einstellungen aktualisiert'
        });
    } catch (error) {
        console.error('Error updating listener settings:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Aktualisieren der Listener-Einstellungen'
        });
    }
});

// ==========================================
// PROXY MONITORING ENDPOINTS
// ==========================================

/**
 * Get backend server status
 * GET /api/servers/:id/proxy/status
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/proxy/status', authManager.authMiddleware, async (req, res) => {
    try {
        const server = serverManager.getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const backendStatus = proxyMonitor.getBackendStatus(req.params.id);

        res.json({
            success: true,
            backends: backendStatus
        });
    } catch (error) {
        console.error('Error getting backend status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Abrufen des Backend-Status'
        });
    }
});

/**
 * Get global player count
 * GET /api/servers/:id/proxy/players/count
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/proxy/players/count', authManager.authMiddleware, async (req, res) => {
    try {
        const server = serverManager.getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const playerCount = await proxyMonitor.getGlobalPlayerCount(server);

        res.json({
            success: true,
            playerCount
        });
    } catch (error) {
        console.error('Error getting player count:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Abrufen der Spielerzahl'
        });
    }
});

/**
 * Get online players list
 * GET /api/servers/:id/proxy/players/list
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/proxy/players/list', authManager.authMiddleware, async (req, res) => {
    try {
        const server = serverManager.getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const players = await proxyMonitor.getOnlinePlayers(server);

        res.json({
            success: true,
            players
        });
    } catch (error) {
        console.error('Error getting online players:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Abrufen der Spielerliste'
        });
    }
});

/**
 * Send player to backend server
 * POST /api/servers/:id/proxy/players/:playerName/send
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/proxy/players/:playerName/send', authManager.authMiddleware, async (req, res) => {
    try {
        const server = serverManager.getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { targetServer } = req.body;

        if (!targetServer) {
            return res.status(400).json({
                success: false,
                message: 'Ziel-Server erforderlich'
            });
        }

        const result = await proxyMonitor.sendPlayer(server, req.params.playerName, targetServer);

        res.json(result);
    } catch (error) {
        console.error('Error sending player:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Senden des Spielers'
        });
    }
});

/**
 * Broadcast alert to all backend servers
 * POST /api/servers/:id/proxy/alert
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/proxy/alert', authManager.authMiddleware, async (req, res) => {
    try {
        const server = serverManager.getServer(req.params.id);

        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server nicht gefunden'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        if (server.type !== 'bungeecord' && server.type !== 'waterfall' && server.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                success: false,
                message: 'Nachricht erforderlich'
            });
        }

        const result = await proxyMonitor.broadcastAlert(server, message);

        res.json(result);
    } catch (error) {
        console.error('Error broadcasting alert:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Senden der Benachrichtigung'
        });
    }
});

/**
 * Get backend server templates
 * GET /api/proxy/templates
 * Protected: Requires authentication
 */
app.get('/api/proxy/templates', authManager.authMiddleware, async (req, res) => {
    try {
        const templatesPath = path.join(__dirname, '..', 'data', 'backend-server-templates.json');
        const templatesData = fs.readFileSync(templatesPath, 'utf8');
        const templates = JSON.parse(templatesData);

        res.json({
            success: true,
            templates: templates.templates
        });
    } catch (error) {
        console.error('Error loading backend server templates:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Laden der Templates'
        });
    }
});

/**
 * Create backend server from template
 * POST /api/servers/:id/proxy/servers/from-template
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/proxy/servers/from-template', authManager.authMiddleware, async (req, res) => {
    try {
        const proxyServer = serverManager.getServer(req.params.id);

        if (!proxyServer) {
            return res.status(404).json({
                success: false,
                message: 'Proxy-Server nicht gefunden'
            });
        }

        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        if (proxyServer.type !== 'bungeecord' && proxyServer.type !== 'waterfall' && proxyServer.type !== 'velocity') {
            return res.status(400).json({
                success: false,
                message: 'Dies ist kein Proxy-Server'
            });
        }

        const { templateId, serverName, customSettings } = req.body;

        if (!templateId || !serverName) {
            return res.status(400).json({
                success: false,
                message: 'Template-ID und Server-Name erforderlich'
            });
        }

        // Load template
        const templatesPath = path.join(__dirname, '..', 'data', 'backend-server-templates.json');
        const templatesData = fs.readFileSync(templatesPath, 'utf8');
        const templates = JSON.parse(templatesData);
        const template = templates.templates.find(t => t.id === templateId);

        if (!template) {
            return res.status(404).json({
                success: false,
                message: 'Template nicht gefunden'
            });
        }

        // Find next available port
        const allServers = serverManager.getAllServers();
        const usedPorts = allServers.map(s => s.port);
        let nextPort = 25565;
        while (usedPorts.includes(nextPort)) {
            nextPort++;
        }

        // Get latest version for template type
        const versions = await serverDownloader.getAvailableVersions(template.type);
        const version = versions && versions.length > 0 ? versions[0] : '1.20.4';

        // Create the backend server
        const serverData = {
            name: serverName,
            type: template.type,
            version: version,
            port: nextPort,
            rconPort: nextPort + 10000,
            rconPassword: Math.random().toString(36).substring(7),
            memory: customSettings?.memory || template.memory,
            createdFrom: 'template',
            templateId: templateId
        };

        const newServer = await serverManager.createServer(serverData);

        // Apply template settings to server.properties
        if (template.serverProperties) {
            const serverPropsPath = path.join(newServer.path, 'server.properties');
            const propertiesData = Object.entries(template.serverProperties)
                .map(([key, value]) => `${key}=${value}`)
                .join('\n');
            
            fs.writeFileSync(serverPropsPath, propertiesData + '\n', 'utf8');
        }

        // Add to proxy config
        const proxyBackendName = customSettings?.proxyName || serverName.toLowerCase().replace(/\s+/g, '-');
        const proxySettings = {
            name: proxyBackendName,
            address: `localhost:${nextPort}`,
            motd: template.proxySettings.motd,
            restricted: template.proxySettings.restricted,
            default: template.proxySettings.default
        };

        await proxyManager.addBackendServer(proxyServer.path, proxySettings, proxyServer.type);

        res.json({
            success: true,
            message: `Backend-Server "${serverName}" erfolgreich erstellt`,
            server: newServer,
            proxyName: proxyBackendName,
            template: template.name
        });
    } catch (error) {
        console.error('Error creating backend server from template:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Fehler beim Erstellen des Backend-Servers'
        });
    }
});

// ==========================================
// PLAYER MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Get all players for a server
 * GET /api/servers/:id/players
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/players', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const players = await playerManager.getAllPlayers(req.params.id);
        
        res.json({
            success: true,
            players
        });
    } catch (error) {
        console.error('Error getting players:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get players: ${error.message}`
        });
    }
});

/**
 * Get player statistics
 * GET /api/servers/:id/players/:playerName/stats
 * Protected: Requires authentication
 */
app.get('/api/servers/:id/players/:playerName/stats', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }

        const stats = await playerManager.getPlayerStats(req.params.id, req.params.playerName);
        
        if (!stats) {
            return res.status(404).json({
                success: false,
                message: 'Player statistics not found'
            });
        }

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting player stats:', error);
        res.status(500).json({
            success: false,
            message: `Failed to get player stats: ${error.message}`
        });
    }
});

/**
 * Kick a player
 * POST /api/servers/:id/players/:playerName/kick
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/players/:playerName/kick', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (only operators can kick)
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        const { reason } = req.body;
        const result = await playerManager.kickPlayer(req.params.id, req.params.playerName, reason);
        
        res.json(result);
    } catch (error) {
        console.error('Error kicking player:', error);
        res.status(500).json({
            success: false,
            message: `Failed to kick player: ${error.message}`
        });
    }
});

/**
 * Ban a player
 * POST /api/servers/:id/players/:playerName/ban
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/players/:playerName/ban', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (only operators can ban)
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        const { reason } = req.body;
        const result = await playerManager.banPlayer(req.params.id, req.params.playerName, reason);
        
        res.json(result);
    } catch (error) {
        console.error('Error banning player:', error);
        res.status(500).json({
            success: false,
            message: `Failed to ban player: ${error.message}`
        });
    }
});

/**
 * Pardon (unban) a player
 * POST /api/servers/:id/players/:playerName/pardon
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/players/:playerName/pardon', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (only operators can pardon)
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        const result = await playerManager.pardonPlayer(req.params.id, req.params.playerName);
        
        res.json(result);
    } catch (error) {
        console.error('Error pardoning player:', error);
        res.status(500).json({
            success: false,
            message: `Failed to pardon player: ${error.message}`
        });
    }
});

/**
 * Op a player
 * POST /api/servers/:id/players/:playerName/op
 * Protected: Requires authentication and admin role
 */
app.post('/api/servers/:id/players/:playerName/op', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (only admins can op)
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Nur Administratoren können Operator-Rechte vergeben'
            });
        }

        const result = await playerManager.opPlayer(req.params.id, req.params.playerName);
        
        res.json(result);
    } catch (error) {
        console.error('Error opping player:', error);
        res.status(500).json({
            success: false,
            message: `Failed to op player: ${error.message}`
        });
    }
});

/**
 * Deop a player
 * POST /api/servers/:id/players/:playerName/deop
 * Protected: Requires authentication and admin role
 */
app.post('/api/servers/:id/players/:playerName/deop', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission (only admins can deop)
        if (req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Nur Administratoren können Operator-Rechte entziehen'
            });
        }

        const result = await playerManager.deopPlayer(req.params.id, req.params.playerName);
        
        res.json(result);
    } catch (error) {
        console.error('Error deopping player:', error);
        res.status(500).json({
            success: false,
            message: `Failed to deop player: ${error.message}`
        });
    }
});

/**
 * Add player to whitelist
 * POST /api/servers/:id/players/:playerName/whitelist
 * Protected: Requires authentication and operator role
 */
app.post('/api/servers/:id/players/:playerName/whitelist', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        const result = await playerManager.whitelistAdd(req.params.id, req.params.playerName);
        
        res.json(result);
    } catch (error) {
        console.error('Error adding to whitelist:', error);
        res.status(500).json({
            success: false,
            message: `Failed to add to whitelist: ${error.message}`
        });
    }
});

/**
 * Remove player from whitelist
 * DELETE /api/servers/:id/players/:playerName/whitelist
 * Protected: Requires authentication and operator role
 */
app.delete('/api/servers/:id/players/:playerName/whitelist', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role) || req.user.role === 'viewer') {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diese Aktion'
            });
        }

        const result = await playerManager.whitelistRemove(req.params.id, req.params.playerName);
        
        res.json(result);
    } catch (error) {
        console.error('Error removing from whitelist:', error);
        res.status(500).json({
            success: false,
            message: `Failed to remove from whitelist: ${error.message}`
        });
    }
});

// ==========================================
// SERVER CONFIGURATION ENDPOINTS
// ==========================================

/**
 * Get server config file
 * GET /api/servers/:id/config/:filename
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/config/:filename', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const filename = req.params.filename;
        const allowedFiles = ['server.properties', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'config.yml', 'velocity.toml'];
        
        if (!allowedFiles.includes(filename)) {
            return res.status(400).json({
                success: false,
                message: 'File not allowed'
            });
        }

        const filePath = path.join(server.path, filename);
        
        if (!fs.existsSync(filePath)) {
            // Return empty content for non-existent files
            return res.json({
                success: true,
                content: filename.endsWith('.json') ? '[]' : '',
                properties: filename === 'server.properties' ? {} : undefined
            });
        }

        const content = await fs.promises.readFile(filePath, 'utf8');

        // Parse server.properties into key-value object
        if (filename === 'server.properties') {
            const properties = {};
            content.split('\n').forEach(line => {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const [key, ...valueParts] = line.split('=');
                    if (key) {
                        properties[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });
            
            return res.json({
                success: true,
                content,
                properties
            });
        }

        res.json({
            success: true,
            content
        });
    } catch (error) {
        console.error('Config read error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Update server config file
 * POST /api/servers/:id/config/:filename
 * Body: { content } or { properties } for server.properties
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/config/:filename', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const filename = req.params.filename;
        const allowedFiles = ['server.properties', 'ops.json', 'whitelist.json', 'banned-players.json', 'banned-ips.json', 'config.yml', 'velocity.toml'];
        
        if (!allowedFiles.includes(filename)) {
            return res.status(400).json({
                success: false,
                message: 'File not allowed'
            });
        }

        const filePath = path.join(server.path, filename);
        let content;

        // Handle server.properties specially - convert properties object to file format
        if (filename === 'server.properties' && req.body.properties) {
            const properties = req.body.properties;
            
            // Read existing file to preserve comments and structure
            let existingContent = '';
            if (fs.existsSync(filePath)) {
                existingContent = await fs.promises.readFile(filePath, 'utf8');
            }

            // Update properties while preserving comments
            const lines = existingContent ? existingContent.split('\n') : [];
            const updatedLines = [];
            const updatedKeys = new Set();

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed.startsWith('#')) {
                    // Keep comments and empty lines
                    updatedLines.push(line);
                } else {
                    const [key] = trimmed.split('=');
                    const cleanKey = key.trim();
                    if (properties.hasOwnProperty(cleanKey)) {
                        updatedLines.push(`${cleanKey}=${properties[cleanKey]}`);
                        updatedKeys.add(cleanKey);
                    } else {
                        updatedLines.push(line);
                    }
                }
            }

            // Add new properties that weren't in the file
            for (const [key, value] of Object.entries(properties)) {
                if (!updatedKeys.has(key)) {
                    updatedLines.push(`${key}=${value}`);
                }
            }

            content = updatedLines.join('\n');
        } else {
            content = req.body.content;
        }

        if (content === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Content or properties required'
            });
        }

        await fs.promises.writeFile(filePath, content, 'utf8');

        res.json({
            success: true,
            message: 'File saved successfully'
        });
    } catch (error) {
        console.error('Config write error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// ==========================================
// FILE EXPLORER ENDPOINTS
// ==========================================

/**
 * List files and directories in server path
 * GET /api/servers/:id/files?path=some/path
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/files', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const relativePath = req.query.path || '';
        const fullPath = path.join(server.path, relativePath);

        // Security check - ensure path is within server directory
        if (!fullPath.startsWith(server.path)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                message: 'Path not found'
            });
        }

        const items = await fs.promises.readdir(fullPath, { withFileTypes: true });
        const files = [];
        const directories = [];

        for (const item of items) {
            const itemPath = path.join(fullPath, item.name);
            const stats = await fs.promises.stat(itemPath);

            if (item.isDirectory()) {
                directories.push({
                    name: item.name,
                    type: 'directory'
                });
            } else {
                files.push({
                    name: item.name,
                    type: 'file',
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }

        // Sort directories and files alphabetically
        directories.sort((a, b) => a.name.localeCompare(b.name));
        files.sort((a, b) => a.name.localeCompare(b.name));

        res.json({
            success: true,
            files,
            directories,
            currentPath: relativePath
        });
    } catch (error) {
        console.error('File list error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Read file content
 * GET /api/servers/:id/files/read?path=file.txt
 * Protected: Requires authentication and server access
 */
app.get('/api/servers/:id/files/read', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const relativePath = req.query.path || '';
        if (!relativePath) {
            return res.status(400).json({
                success: false,
                message: 'Path required'
            });
        }

        const fullPath = path.join(server.path, relativePath);

        // Security check
        if (!fullPath.startsWith(server.path)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({
                success: false,
                message: 'File not found'
            });
        }

        // Check if file is too large (>10MB)
        const stats = await fs.promises.stat(fullPath);
        if (stats.size > 10 * 1024 * 1024) {
            return res.status(400).json({
                success: false,
                message: 'File too large to edit (max 10MB)'
            });
        }

        const content = await fs.promises.readFile(fullPath, 'utf8');

        res.json({
            success: true,
            content,
            size: stats.size
        });
    } catch (error) {
        console.error('File read error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Write file content
 * POST /api/servers/:id/files/write
 * Body: { path, content }
 * Protected: Requires authentication and server access
 */
app.post('/api/servers/:id/files/write', authManager.authMiddleware, async (req, res) => {
    try {
        // Check permission
        if (!serverManager.canAccessServer(req.params.id, req.user.id, req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Keine Berechtigung für diesen Server'
            });
        }
        
        const server = serverManager.getServer(req.params.id);
        if (!server) {
            return res.status(404).json({
                success: false,
                message: 'Server not found'
            });
        }

        const { path: relativePath, content } = req.body;

        if (!relativePath) {
            return res.status(400).json({
                success: false,
                message: 'Path required'
            });
        }

        if (content === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Content required'
            });
        }

        const fullPath = path.join(server.path, relativePath);

        // Security check
        if (!fullPath.startsWith(server.path)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        await fs.promises.writeFile(fullPath, content, 'utf8');

        res.json({
            success: true,
            message: 'File saved successfully'
        });
    } catch (error) {
        console.error('File write error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

// Error Handler
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({
        success: false,
        message: 'Interner Serverfehler'
    });
});

// ==========================================
// AUTHENTICATION ENDPOINTS
// ==========================================

/**
 * Register new user
 * POST /api/auth/register
 */
app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, password, role } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const user = await authManager.register(username, password, role || 'user');

        res.json({
            success: true,
            message: 'User registered successfully',
            user: user
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Login user
 * POST /api/auth/login
 */
app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                message: 'Username and password are required'
            });
        }

        const result = await authManager.login(username, password);

        res.json({
            success: true,
            message: 'Login successful',
            ...result
        });
    } catch (error) {
        console.error('Error logging in:', error);
        res.status(401).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * Verify token
 * GET /api/auth/verify
 */
app.get('/api/auth/verify', authManager.authMiddleware, (req, res) => {
    try {
        const user = authManager.getUserById(req.user.id);
        
        res.json({
            success: true,
            user: user
        });
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }
});

/**
 * Get all users (admin only)
 * GET /api/auth/users
 */
app.get('/api/auth/users', authManager.authMiddleware, authManager.adminMiddleware, (req, res) => {
    try {
        const users = authManager.getAllUsers();
        
        res.json({
            success: true,
            users: users
        });
    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get users'
        });
    }
});

/**
 * Delete user (admin only)
 * DELETE /api/auth/users/:id
 */
app.delete('/api/auth/users/:id', authManager.authMiddleware, authManager.adminMiddleware, (req, res) => {
    try {
        const userId = req.params.id;
        authManager.deleteUser(userId);
        
        res.json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(400).json({
            success: false,
            message: error.message
        });
    }
});

// Start Server
const httpServer = server.listen(PORT, () => {
    console.log('=================================');
    console.log('🎮 Minecraft Server Manager');
    console.log('=================================');
    console.log(`Server läuft auf: http://localhost:${PORT}`);
    console.log(`API Endpoint: http://localhost:${PORT}/api`);
    console.log(`WebSocket: Active`);
    console.log('=================================');
    
    // Initialize proxy monitoring
    proxyMonitor.setWebSocket(io);
    
    // Start monitoring for running proxy servers
    const servers = serverManager.getAllServers();
    servers.forEach(server => {
        if ((server.type === 'bungeecord' || server.type === 'waterfall') && server.status === 'running') {
            proxyMonitor.startMonitoring(server);
        }
    });
});

// Graceful Shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down gracefully...');
    
    // Stop all running Minecraft servers
    try {
        console.log('⏳ Stopping all Minecraft servers...');
        await serverManager.stopAllServers();
        console.log('✓ All Minecraft servers stopped');
    } catch (error) {
        console.error('❌ Error stopping servers:', error.message);
    }
    
    // Stop all resource monitoring
    try {
        resourceMonitor.stopAllMonitoring();
        console.log('✓ Resource monitoring stopped');
    } catch (error) {
        console.error('❌ Error stopping resource monitoring:', error.message);
    }
    
    // Stop all scheduled tasks
    try {
        taskScheduler.stopAll();
        console.log('✓ Task scheduler stopped');
    } catch (error) {
        console.error('❌ Error stopping task scheduler:', error.message);
    }
    
    // Close RCON connection
    if (rconClient) {
        try {
            await rconClient.end();
            console.log('✓ RCON connection closed');
        } catch (error) {
            console.error('❌ Error closing RCON:', error.message);
        }
    }
    
    console.log('✓ Shutdown complete');
    process.exit(0);
});

// Handle SIGTERM (for production deployments)
process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down...');
    
    // Stop all running Minecraft servers
    try {
        console.log('⏳ Stopping all Minecraft servers...');
        await serverManager.stopAllServers();
        console.log('✓ All Minecraft servers stopped');
    } catch (error) {
        console.error('❌ Error stopping servers:', error.message);
    }
    
    // Close RCON connection
    if (rconClient) {
        try {
            await rconClient.end();
            console.log('✓ RCON connection closed');
        } catch (error) {
            console.error('❌ Error closing RCON:', error.message);
        }
    }
    
    console.log('✓ Shutdown complete');
    process.exit(0);
});