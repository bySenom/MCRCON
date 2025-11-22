# Minecraft Server Manager - AI Coding Agent Instructions

## Project Overview
Full-featured Minecraft Server Management Platform. Web-based tool for creating, managing, and controlling Minecraft servers with support for Vanilla, Paper, Fabric, Forge, and Spigot. Includes RCON console, plugin/mod management with Modrinth and Spigot integration, and server lifecycle control.

## Tech Stack
- **Frontend**: HTML5, CSS3, Vanilla JavaScript (no framework), multi-tab SPA
- **Backend**: Node.js, Express.js, child_process for server spawning
- **RCON Client**: `rcon-client` npm package (NOT modern-rcon)
- **Server Downloads**: axios for fetching JARs from official APIs
- **Plugin/Mod APIs**: Modrinth API v2, Spiget API v2
- **Storage**: JSON file-based database (`data/servers.json`)
- **Server Files**: Stored in `minecraft_servers/<server-id>/`
- **Dev Tools**: nodemon for auto-reload

## Architecture

### Backend (`server/`)
- **`index.js`** - Main Express server with REST API
  - RCON endpoints (legacy, kept for console tab)
  - Server management endpoints (`/api/servers/*`)
  - Plugin/mod management endpoints (`/api/plugins/*`)
  - Static file serving from `public/`
  
- **`serverManager.js`** - Core server lifecycle management
  - Create/delete/start/stop/restart servers
  - Process management via `child_process.spawn`
  - JSON database persistence
  - Single Map-based in-memory cache of servers
  - Each server runs as separate Java process

- **`serverDownloader.js`** - Automated server JAR downloads
  - Vanilla: Mojang version manifest API
  - Paper: PaperMC API v2 (https://api.papermc.io/v2)
  - Fabric: FabricMC Meta API
  - Spigot/Forge: Manual (BuildTools/installer complexity)
  - Auto-accepts EULA on creation

- **`pluginManager.js`** - Plugin/Mod discovery and management
  - Modrinth API integration (search with facets, version filtering)
  - Spigot/Spiget API integration (resource search, details)
  - Download and install to server plugins/ or mods/ folders
  - List installed plugins/mods
  - Uninstall functionality

### Frontend (`public/`)
- **`dashboard.html`** - Main UI (use this, not index.html)
  - Five tabs: Dashboard, Create Server, Server Details (dynamic), Plugins/Mods, RCON Console
  - Tab-based navigation without page reload
  - Server Details tab appears when server is selected
  
- **`js/dashboard.js`** - Dashboard logic
  - Server list rendering with real-time status
  - Server cards are clickable to open details view
  - Server creation wizard with type/version selection
  - Control actions (start/stop/restart/delete)
  - Modal for server details

- **`js/serverDetails.js`** - Server details management
  - Four sub-tabs: Overview, Settings, Plugins/Mods, Files
  - Server information display
  - Server.properties editor with form fields
  - Per-server plugin browser and installer
  - File explorer with directory navigation and file editing
  - Server control buttons (start/stop/restart)

- **`js/plugins.js`** - Plugin/Mod browser logic (global view)
  - Search interface with filters (source, loader type, MC version)
  - Plugin results grid with card-based UI
  - Version selection modal
  - Install/uninstall actions
  - Installed plugins list per server

- **`js/app.js`** - RCON console logic (legacy, used in RCON tab)
  - Direct RCON connections for manual command execution
  - Quick action buttons for common commands
  - Wrapped in IIFE to prevent global variable conflicts

- **`css/dashboard.css`** - Dashboard-specific styling
  - Server cards with status badges and hover effects
  - Plugin cards with hover effects
  - Sub-tab navigation styles
  - Tab navigation styles
  - Modal system

- **`css/style.css`** - Base styling (dark theme, variables)

## Key Workflows

### Development Setup
```powershell
# Install dependencies (includes axios, uuid, archiver, etc.)
npm install

# Copy environment template
cp .env.example .env

# Edit .env with any defaults (optional)

# Start with auto-reload
npm run dev

# Production start
npm start
```

### Server Creation Flow
1. User selects type (Vanilla/Paper/Fabric/Forge/Spigot)
2. Frontend fetches available versions from `/api/versions/:type`
3. User submits form with name, version, port, RCON config, RAM
4. Backend creates server entry in database with UUID
5. `serverDownloader` fetches JAR from official API
6. Server directory created at `minecraft_servers/<uuid>/`
7. EULA auto-accepted
8. Server ready to start

### Server Lifecycle
- **Start**: Spawn Java process with `-Xmx<memory>` args, pipe stdout/stderr
- **Stop**: Send `stop\n` to stdin, wait max 30s, SIGTERM fallback
- **Restart**: Stop → 2s delay → Start
- **Delete**: Stop if running → rm server directory → remove from database
- **Command**: Write to process stdin (requires server running)

## Project Conventions

### Database Structure
- `data/servers.json` - Array of server objects
- Server object schema:
  ```json
  {
    "id": "uuid-v4",
    "name": "string",
    "type": "vanilla|paper|spigot|fabric|forge",
    "version": "string",
    "port": 25565,
    "rconPort": 25575,
    "rconPassword": "string",
    "memory": "2G",
    "status": "running|stopped",
    "createdAt": "ISO8601",
    "startedAt": "ISO8601",
    "path": "absolute/path"
  }
  ```

### API Response Format
All endpoints return:
```json
{
  "success": true/false,
  "message": "optional error/success message",
  "...data": "additional fields"
}
```

### Process Management
- ServerManager keeps Map of `serverId → childProcess`
- Processes auto-update server status on exit
- Stdout/stderr logged to console with server name prefix
- Servers run with `nogui` flag

### Error Handling
- Try/catch on all async operations
- Frontend shows status messages (success/error/loading states)
- Server creation failures clean up partial state
- Graceful shutdown on SIGINT

### Styling
- Dark theme with CSS variables
- Status badges: green (running), red (stopped)
- Server type badges: blue
- Card-based UI with hover effects
- Responsive grid for server cards

## Critical Files
- `server/index.js` - Express API with WebSocket, authentication, server/plugin/config/log/world endpoints
- `server/serverManager.js` - Server lifecycle, process management, WebSocket event emission, notification triggers
- `server/authManager.js` - JWT authentication, bcrypt password hashing, role-based access
- `server/serverDownloader.js` - JAR download integrations (api.papermc.io/v2)
- `server/pluginManager.js` - Plugin/Mod search, download, install/uninstall
- `server/logManager.js` - Log file reading, parsing, filtering, export (v3.5.0)
- `server/worldManager.js` - World management operations (download, reset, gamerules, world border) (v3.6.0)
- `server/backupManager.js` - ZIP backup creation, restore, list, delete
- `server/resourceMonitor.js` - CPU/RAM/TPS monitoring with WebSocket streaming
- `server/taskScheduler.js` - Cron-based task scheduler with 5 task types, execution logging
- `server/notificationManager.js` - Webhook notification delivery (Discord embeds, generic webhooks)
- `public/dashboard.html` - Main UI with 7 tabs (PRIMARY ENTRY POINT)
- `public/js/dashboard.js` - Dashboard state management, WebSocket initialization, system monitoring
- `public/js/serverDetails.js` - Per-server management with real-time console, WebSocket subscriptions
- `public/js/world.js` - World management UI with download, reset, gamerules, world border (v3.6.0)
- `public/js/tasks.js` - Task management UI with CRUD operations, execution log
- `public/js/webhooks.js` - Webhook management UI with event selection, test functionality
- `public/js/logs.js` - Log viewer UI with filtering, search, auto-refresh, export (v3.5.0)
- `public/js/plugins.js` - Plugin browser UI and API interactions (global view)
- `public/login.html` / `public/register.html` - Authentication UI
- `data/servers.json` - Server database
- `data/users.json` - User database (bcrypt hashed passwords)
- `minecraft_servers/` - Server instance directories

## API Endpoints

### Server Management
- `GET /api/servers` - List all servers
- `POST /api/servers` - Create new server
- `GET /api/servers/:id` - Get server details
- `DELETE /api/servers/:id` - Delete server
- `POST /api/servers/:id/start` - Start server
- `POST /api/servers/:id/stop` - Stop server
- `POST /api/servers/:id/restart` - Restart server
- `POST /api/servers/:id/command` - Send command to server
- `GET /api/versions/:type` - Get available versions for server type

### System Stats
- `GET /api/system/stats` - Get system-wide CPU, RAM, disk usage statistics

### Scheduled Tasks
- `GET /api/tasks` - Get all scheduled tasks (filtered by user permissions)
- `GET /api/tasks/log` - Get task execution log (limit parameter)
- `POST /api/tasks` - Create new scheduled task
- `PUT /api/tasks/:id` - Update scheduled task
- `POST /api/tasks/:id/toggle` - Toggle task enabled/disabled
- `DELETE /api/tasks/:id` - Delete scheduled task
- `POST /api/tasks/:id/execute` - Execute task immediately (manual trigger)

### Webhooks/Notifications
- `GET /api/webhooks` - Get all webhooks
- `POST /api/webhooks` - Create new webhook
- `GET /api/webhooks/:id` - Get webhook details
- `PUT /api/webhooks/:id` - Update webhook
- `POST /api/webhooks/:id/toggle` - Toggle webhook enabled/disabled
- `DELETE /api/webhooks/:id` - Delete webhook
- `POST /api/webhooks/:id/test` - Send test notification

### Logs Viewer
- `GET /api/servers/:id/logs?lines=100&logType=latest&level=INFO&search=text` - Get server logs with filtering
- `GET /api/servers/:id/logs/files` - Get available log files
- `GET /api/servers/:id/logs/stats` - Get log statistics (size, lines, level counts)
- `GET /api/servers/:id/logs/export?logType=latest&level=INFO&search=text` - Export logs to text file

### World Management
- `GET /api/servers/:id/world/info` - Get world information and list all worlds
- `GET /api/servers/:id/world/download?world=name` - Download world as ZIP with streaming
- `POST /api/servers/:id/world/reset` - Reset world (requires stopped server) (body: {world})
- `GET /api/servers/:id/world/gamerules` - Get all gamerules (35 defaults)
- `POST /api/servers/:id/world/gamerules` - Set gamerule (requires running server) (body: {rule, value})
- `GET /api/servers/:id/world/border` - Get world border settings
- `POST /api/servers/:id/world/border` - Set world border (requires running server) (body: {size, centerX, centerZ})

### Server Configuration
- `GET /api/servers/:id/config/:filename` - Get config file (server.properties, ops.json, whitelist.json, banned-players.json)
- `POST /api/servers/:id/config/:filename` - Update config file (body: {content} or {properties} for server.properties)

### File Explorer
- `GET /api/servers/:id/files?path=some/path` - List files and directories in server path
- `GET /api/servers/:id/files/read?path=file.txt` - Read file content
- `POST /api/servers/:id/files/write` - Write file content (body: {path, content})

### Plugin/Mod Management
- `GET /api/plugins/search?q=query&type=loader&version=mc&source=modrinth` - Search plugins/mods
- `GET /api/plugins/:source/:id/versions?mcVersion=1.20.4` - Get plugin versions
- `POST /api/servers/:id/plugins/install` - Install plugin/mod (body: {url, filename})
- `GET /api/servers/:id/plugins` - List installed plugins/mods
- `DELETE /api/servers/:id/plugins/:filename` - Uninstall plugin/mod

### RCON (Legacy)
- `POST /api/connect` - Connect to RCON
- `POST /api/disconnect` - Disconnect from RCON
- `POST /api/command` - Execute RCON command

## Common Commands
```bash
npm install              # Install dependencies
npm start               # Start server (production)
npm run dev            # Start with nodemon (development)
```

## Server Type Details
- **Vanilla**: Pure Minecraft, downloaded from Mojang
- **Paper**: High-performance, Spigot-compatible, supports plugins
- **Fabric**: Mod loader, lightweight, good mod compatibility
- **Forge**: Heavy mod loader, requires manual installer download
- **Spigot**: Requires BuildTools compilation, recommend Paper instead
- **BungeeCord**: Proxy server for connecting multiple Minecraft servers into a network (Jenkins CI)
- **Waterfall**: Modern BungeeCord fork with performance improvements and bug fixes (PaperMC API)

## Gotchas
- **Java Required**: Server start fails without Java in PATH
- **Port Conflicts**: Multiple servers can't use same port
- **Server Creation Slow**: Downloads can take minutes, user must wait
- **RCON Separate**: Old RCON endpoints still exist for console tab
- **Process Cleanup**: Always stop servers before delete
- **Memory Format**: Use "2G" style strings, not integers
- **Forge/Spigot**: Not auto-downloadable, throw errors with instructions
- **Database**: Not transactional, race conditions possible on concurrent writes
- **No Auth**: Web interface has no authentication (add before production!)
- **RCON Library**: Use `rcon-client`, NOT `modern-rcon` (changed during implementation)
- **PaperMC API**: Use https://api.papermc.io/v2 (NOT papermc.io/api/v2)
- **Script Loading Order**: dashboard.js must load before app.js to prevent conflicts
- **IIFE Wrapping**: app.js wrapped in IIFE to prevent global variable conflicts with dashboard.js
- **Nodemon Config**: Ignores minecraft_servers/** and data/** to prevent restart loops during downloads

## Implemented Features
- ✅ **WebSocket Real-Time Console**: Live server output streaming with Socket.IO
- ✅ **Server Templates/Presets**: Quick server creation from predefined configurations
- ✅ **Backup/Restore System**: Create, restore, delete, and download server backups
- ✅ **Multi-User Authentication**: JWT-based auth with role-based access control
- ✅ **File Explorer**: Browse, edit, and manage server files with web interface
- ✅ **Resource Monitoring**: Real-time CPU, RAM, TPS tracking (WebSocket-based)
- ✅ **Resource Monitoring Dashboard**: System-wide CPU/RAM/Disk monitoring with live charts, 30s history, color-coded progress bars, and threshold-based visual warnings
- ✅ **Scheduled Tasks & Automation**: Cron-based task scheduler with 5 task types (backup, restart, start, stop, command), execution logging, and manual triggering
- ✅ **Discord/Webhook Notifications**: Webhook delivery system with Discord embeds, 7 event types (start, stop, crash, player_join, player_leave, backup_complete, backup_failed), player event parsing from console logs
- ✅ **Live Logs Viewer**: Advanced log viewer with server selection, level filtering (INFO/WARN/ERROR/FATAL/DEBUG), text search, log file selection, statistics (file size, line count, level distribution), auto-refresh (5s), auto-scroll, and export to text file
- ✅ **World Management Tools**: Complete world management system with world download as ZIP (all 3 dimensions: Overworld, Nether, The End), world reset with automatic backup, gamerule editor (35 Minecraft gamerules), world border configuration (size + center coordinates), world information display (size, files, modified date), ZIP streaming for large worlds, multi-dimension support
- ✅ **Player Management Panel**: Comprehensive player management system with player list (online/offline/banned/whitelisted/ops), 11 player actions (kick, ban, pardon, op, deop, whitelist add/remove, gamemode, teleport, give item, clear inventory), player statistics viewer (10 stats from Minecraft stats files), Crafatar avatar integration, role-based authorization (viewer/operator/admin), search and filter functionality
- ✅ **Theme Customization**: Light/dark mode toggle with CSS custom properties, localStorage persistence, smooth transitions, sun/moon icon toggle button, comprehensive color variables for backgrounds/text/borders/shadows, supports both header button and floating action button styles
- ✅ **BungeeCord/Waterfall Proxy Support**: Complete proxy server support with automatic downloads from Jenkins CI (BungeeCord) and PaperMC API (Waterfall), proxy-specific config.yml generation, default port 25577, visual proxy indicators (🌐 icon), network configuration templates

## Next Features (Not Yet Implemented)
None - All planned features have been implemented!

