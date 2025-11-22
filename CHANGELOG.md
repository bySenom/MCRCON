# Changelog

All notable changes to the Minecraft Server Manager will be documented in this file.

## [v3.16.0] - Host/IP Configuration - 2025-11-22

### Added
- **Host/IP Configuration System**: Configure custom IP addresses or domain names for servers
  - New `host` field in server object (default: `0.0.0.0`)
  - `server-ip` configuration in server.properties
  - Configurable bind address for proxy servers (Velocity/BungeeCord/Waterfall)
  - Automatic host propagation from proxy to backend servers
  - Frontend UI field for host/IP configuration in server creation
  - Database migration for existing servers
- **GitHub Pages Documentation**: Complete project documentation website
  - Feature overview with 16+ key features
  - Installation guide with requirements
  - Usage guide for common tasks
  - API reference
  - Technology stack details
  - Responsive design with dark gradient theme

### Changed
- Backend server addresses now use proxy's configured host instead of hardcoded `localhost`
- Improved placeholder server detection in Velocity proxy configuration

### Fixed
- Backend servers in proxy networks now correctly inherit proxy's IP address while maintaining their own ports

## [v3.15.0] - Velocity Proxy Support - 2025-11-20

### Added
- **Velocity Proxy Support**: Full support for Velocity modern proxy servers
  - Automatic download from PaperMC API
  - Modern player-info-forwarding-mode configuration
  - Paper native Velocity forwarding support
  - Automatic forwarding secret synchronization between proxy and backend servers
  - Auto-start backend servers when proxy starts
  - Create & Add functionality for backend servers
  - Version selection dropdown for backend servers
  - Smart try[] list management (first server auto-added, others manual)
- **Backend Server Management**: Comprehensive proxy backend server features
  - TOML/YAML dual configuration support
  - Automatic proxy compatibility configuration (paper-global.yml)
  - Online-mode=false for backend servers (proxy handles auth)
  - Placeholder server ("lobby") to prevent Velocity startup crashes
  - Backend server address propagation
  - Forwarding secret sync with 3-second delay for proper generation

### Changed
- Updated Velocity configuration to use modern forwarding mode instead of legacy
- Backend servers automatically configured for proxy compatibility during creation
- Velocity config includes "lobby" placeholder to prevent "Fallback server not registered" error

### Fixed
- Velocity proxy no longer crashes when no backend servers exist
- Forwarding secret mismatch between Velocity and Paper servers resolved
- Backend servers now properly connect through Velocity proxy
- Player authentication works correctly through Velocity

## [v3.14.0] - BungeeCord/Waterfall Proxy Support - 2025-11-18

### Added
- **BungeeCord/Waterfall Proxy Support**: Complete proxy server support
  - Automatic downloads from Jenkins CI (BungeeCord) and PaperMC API (Waterfall)
  - Proxy-specific config.yml generation with default listeners
  - Default port 25577 for proxies (distinguishes from game servers)
  - Visual proxy indicators (🌐 icon) in UI
  - Network configuration templates
  - Backend server management interface
  - Proxy settings editor
  - priorities list management for default servers

## [v3.8.0] - Theme Customization - 2025-01-XX

### Added
- **Theme System**: Complete light/dark mode toggle functionality
  - CSS custom properties for theme variables (backgrounds, text, borders, shadows)
  - Light theme with bright, high-contrast colors
  - Dark theme with comfortable low-light colors
  - Smooth transitions between themes (0.3s ease)
  - LocalStorage persistence (theme saved across sessions)
  - Theme toggle button with sun/moon icons
  - Support for both header button and floating action button styles
  - Comprehensive color variables: `--bg-primary/secondary/tertiary`, `--text-primary/secondary/muted`, `--border-color`, `--shadow-sm/md/lg`
  - Alpha color variants for transparency effects

### Technical Details
- **Frontend**: `public/js/theme.js` (126 lines)
  - `initTheme()`: Load saved theme on page load
  - `toggleTheme()`: Switch between light/dark modes
  - `applyTheme(theme)`: Apply theme to document
  - `createThemeToggle()`: Create toggle button UI
  - `updateToggleIcon(theme)`: Update sun/moon icon
  - Exported API: `window.themeManager`
- **Styling**: `public/css/style.css`
  - `:root`: Dark theme variables (default)
  - `[data-theme="light"]`: Light theme colors
  - `[data-theme="dark"]`: Explicit dark theme
  - `.theme-toggle`: Header button styles
  - `.theme-toggle-floating`: Floating action button styles
  - Smooth transitions on all elements

### Integration
- Theme script loads early in `dashboard.html` to prevent flash of wrong theme
- Theme persists across page reloads via localStorage
- All UI components support both themes (tabs, modals, cards, buttons, forms)

---

## [v3.7.0] - Player Management Panel - 2025-01-XX

### Added
- **Player Management System**: Comprehensive player control and statistics
  - Player list with online/offline/banned/whitelisted/ops status
  - 11 player actions: kick, ban, pardon, op, deop, whitelist add/remove, gamemode, teleport, give item, clear inventory
  - Player statistics viewer with 10 Minecraft stats (play time, deaths, kills, blocks broken, distance traveled, etc.)
  - Crafatar avatar integration for player heads
  - Search and filter functionality
  - Role-based authorization (viewer/operator/admin)

### Technical Details
- **Backend**: `server/playerManager.js` (415 lines)
  - `getAllPlayers()`: Aggregate data from 5 sources (usercache, whitelist, ops, banned-players, stats)
  - `getPlayerStats(serverId, uuid)`: Parse Minecraft stats files
  - 11 action methods for player management
  - Data sources: usercache.json, whitelist.json, ops.json, banned-players.json, stats/*.json
- **API**: 8 new REST endpoints
  - `GET /api/servers/:id/players`: List all players
  - `GET /api/servers/:id/players/:uuid/stats`: Get player statistics
  - `POST /api/servers/:id/players/kick`: Kick player
  - `POST /api/servers/:id/players/ban`: Ban player
  - `POST /api/servers/:id/players/pardon`: Unban player
  - `POST /api/servers/:id/players/op`: Grant operator status
  - `POST /api/servers/:id/players/deop`: Revoke operator status
  - `POST /api/servers/:id/players/whitelist`: Add to whitelist
  - `DELETE /api/servers/:id/players/whitelist/:username`: Remove from whitelist
- **Frontend**: `public/js/players.js` (555 lines, IIFE pattern)
  - Player list rendering with status badges
  - Player action menus with dropdown
  - Player statistics modal
  - Search and filter UI
- **UI**: New "Players" sub-tab in Server Details
  - Player cards with Crafatar avatars
  - Action dropdown menus (kick, ban, pardon, etc.)
  - Player stats modal with 10 statistics
  - Search bar and status filter buttons
- **Styling**: `public/css/dashboard.css` (+227 lines)
  - Player card styles with hover effects
  - Player menu dropdown
  - Stats modal layout
  - Responsive design

### Authorization
- **Viewer**: Can view player list and stats
- **Operator**: Can kick players, view stats
- **Admin**: Full access to all player actions

---

## [v3.6.0] - World Management Tools - 2025-01-XX

### Added
- **World Management**: Complete world administration system
  - World download as ZIP (includes all 3 dimensions: Overworld, Nether, The End)
  - World reset with automatic backup
  - Gamerule editor (35 Minecraft gamerules)
  - World border configuration (size + center coordinates)
  - World information display (size, files, modified date)
  - ZIP streaming for large worlds

### Technical Details
- **Backend**: `server/worldManager.js`
- **API**: 5 new REST endpoints
- **Frontend**: `public/js/world.js`
- **UI**: New "World" sub-tab in Server Details

---

## [v3.5.0] - Live Logs Viewer - 2025-01-XX

### Added
- **Log Viewer**: Advanced server log viewer
  - Server selection dropdown
  - Log level filtering (INFO/WARN/ERROR/FATAL/DEBUG)
  - Text search functionality
  - Log file selection (latest.log, debug logs, dated logs)
  - Statistics (file size, line count, level distribution)
  - Auto-refresh (5 second interval)
  - Auto-scroll option
  - Export logs to text file

### Technical Details
- **Backend**: `server/logManager.js`
- **API**: 3 new REST endpoints
- **Frontend**: `public/js/logs.js`
- **UI**: New "Logs" tab in dashboard

---

## [v3.4.0] - Discord/Webhook Notifications - 2025-01-XX

### Added
- **Webhook System**: Notification delivery with Discord support
  - 7 event types: start, stop, crash, player_join, player_leave, backup_complete, backup_failed
  - Discord embeds with rich formatting
  - Generic webhook support (JSON payload)
  - Player event parsing from console logs
  - Enable/disable toggle per webhook
  - Test webhook functionality

### Technical Details
- **Backend**: `server/notificationManager.js`
- **API**: 6 new REST endpoints
- **Frontend**: `public/js/webhooks.js`
- **UI**: New "Webhooks" tab in dashboard

---

## [v3.3.0] - Scheduled Tasks & Automation - 2025-01-XX

### Added
- **Task Scheduler**: Cron-based automation system
  - 5 task types: backup, restart, start, stop, command
  - Cron expression scheduling
  - Execution logging with timestamps
  - Manual triggering
  - Enable/disable toggle per task

### Technical Details
- **Backend**: `server/taskScheduler.js`
- **API**: 6 new REST endpoints
- **Frontend**: `public/js/tasks.js`
- **UI**: New "Tasks" tab in dashboard

---

## [v3.2.0] - Resource Monitoring Dashboard - 2025-01-XX

### Added
- **System Monitoring**: Real-time resource tracking
  - System-wide CPU, RAM, disk usage
  - Live Chart.js graphs with 30s history
  - Color-coded progress bars
  - Threshold-based visual warnings
  - WebSocket streaming for real-time updates

### Technical Details
- **Backend**: `server/resourceMonitor.js`
- **API**: `GET /api/system/stats`
- **Frontend**: Real-time Chart.js integration in dashboard
- **WebSocket Events**: `systemStats` event every 2 seconds

---

## [v3.1.0] - Backup/Restore System - 2025-01-XX

### Added
- **Backup Manager**: Server backup and restore
  - Create server backups (ZIP archives)
  - Restore from backup
  - List all backups
  - Delete backups
  - Download backups

### Technical Details
- **Backend**: `server/backupManager.js`
- **API**: 5 REST endpoints
- **Storage**: `backups/<server-id>/` directory

---

## [v3.0.0] - Multi-User Authentication - 2025-01-XX

### Added
- **Authentication System**: JWT-based auth with roles
  - User registration and login
  - Password hashing with bcrypt
  - Role-based access control (viewer/operator/admin)
  - JWT token management
  - Protected API endpoints

### Technical Details
- **Backend**: `server/authManager.js`
- **API**: Login, register, logout, verify endpoints
- **Storage**: `data/users.json` with bcrypt hashed passwords

---

## [v2.2.0] - File Explorer - 2025-01-XX

### Added
- **File Management**: Web-based file explorer
  - Browse server directories
  - Read file contents
  - Edit text files
  - Create new files
  - Delete files

### Technical Details
- **API**: 3 REST endpoints for file operations
- **UI**: New "Files" sub-tab in Server Details

---

## [v2.1.0] - WebSocket Real-Time Console - 2025-01-XX

### Added
- **Live Console**: Real-time server output streaming
  - Socket.IO integration
  - Live server log output
  - Console command input
  - Auto-scroll functionality

### Technical Details
- **Backend**: WebSocket event emission from `serverManager.js`
- **Frontend**: Socket.IO client in `serverDetails.js`
- **Events**: `serverLog`, `serverStatusChange`

---

## [v2.0.0] - Server Templates/Presets - 2025-01-XX

### Added
- **Quick Server Creation**: Predefined server configurations
  - Vanilla templates
  - Paper templates
  - Fabric templates
  - Preset memory configurations
  - Preset port ranges

---

## [v1.0.0] - Initial Release - 2025-01-XX

### Added
- **Server Management**: Create, start, stop, restart, delete Minecraft servers
- **Server Types**: Vanilla, Paper, Fabric support
- **Server Downloader**: Automatic JAR downloads from official APIs
- **Plugin Manager**: Modrinth and Spigot integration
- **RCON Console**: Direct server command execution
- **Dashboard UI**: Web-based management interface
- **Configuration Editor**: server.properties editing
- **Database**: JSON file-based storage

### Technical Details
- **Backend**: Node.js + Express
- **Frontend**: Vanilla JavaScript
- **Server Types**: Vanilla (Mojang API), Paper (PaperMC API v2), Fabric (FabricMC Meta API)
- **Plugin APIs**: Modrinth API v2, Spiget API v2
- **RCON**: rcon-client npm package
