# 🎮 Minecraft Server Manager

**Full-featured Minecraft Server Management Platform** - Create, manage, and monitor multiple Minecraft servers with a modern web interface.

[![Node.js](https://img.shields.io/badge/Node.js-16%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-3.16.0-orange.svg)](package.json)
[![GitHub Pages](https://img.shields.io/badge/Docs-GitHub%20Pages-blue.svg)](https://bySenom.github.io/MCRCON/)

> 🚀 **Production-Ready** - Complete with authentication, rate limiting, security headers, and deployment guides.

---

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/bySenom/MCRCON.git
cd MCRCON

# Install dependencies
npm install

# Start server
npm start

# Open browser: http://localhost:3000
```

📖 **[Full Documentation](https://bySenom.github.io/MCRCON/)** - Installation guides for all platforms

---

## ✨ Features

### 🎯 Core Features
- 🏗️ **Multi-Server Management** - Create and manage unlimited Minecraft servers
- 🎮 **Server Types** - Vanilla, Paper, Fabric, Forge, Spigot, BungeeCord, Waterfall, **Velocity**
- 🚀 **One-Click Actions** - Start, stop, restart, delete servers instantly
- 🖥️ **Real-Time Console** - Live server output with WebSocket streaming
- 📊 **Resource Monitoring** - CPU, RAM, TPS tracking with live charts
- 🔌 **Plugin/Mod Browser** - Install from Modrinth & Spigot APIs
- 📁 **File Explorer** - Edit server files directly in browser
- ⚙️ **Configuration Editor** - Manage server.properties with form UI
- 🌐 **Host/IP Configuration** - Custom IP/domain for online hosting

### 🔐 Security & Authentication
- 🔒 **Multi-User System** - JWT-based authentication with bcrypt
- 👥 **Role-Based Access** - Viewer, Operator, Admin roles
- 🛡️ **Rate Limiting** - Protect API from abuse (100 req/15min)
- 🔐 **Security Headers** - Helmet.js with CSP, XSS protection
- 🌐 **CORS Protection** - Environment-based origin whitelisting

### 🌍 Advanced Features
- 📦 **Backup System** - Create, restore, download server backups as ZIP
- 🌐 **Proxy Support** - BungeeCord, Waterfall & **Velocity** network management
- 🎯 **Create & Add** - Create backend servers directly in proxy interface
- 🔑 **Auto-Configuration** - Automatic forwarding secret sync for Velocity
- 🗺️ **Network Topology** - Interactive drag-drop visualization
- 🎨 **Server Templates** - 8+ pre-configured server presets
- 🌍 **World Management** - Download, reset, gamerules, world border
- 👤 **Player Management** - 11 actions + statistics viewer with Crafatar avatars
- 📋 **Log Viewer** - Filter, search, export server logs
- ⏰ **Task Scheduler** - Cron-based automation (backup, restart, commands)
- 🔔 **Webhooks** - Discord notifications for 7 server events
- 🎨 **Theme Toggle** - Light/Dark mode with custom CSS properties
- 📈 **System Dashboard** - Live CPU/RAM/Disk monitoring
- 🎓 **First-Time Tutorial** - Interactive walkthrough for new users (NEW v3.16.0)

### ✨ UX Enhancements
- 🔔 **Toast Notifications** - Modern animated notifications with auto-dismiss
- ⌨️ **Keyboard Shortcuts** - Power-user features (Ctrl+N, Ctrl+R, Ctrl+S, etc.)
- 💾 **Unsaved Changes Warning** - Prevents data loss with auto-detection
- 🎯 **Quick Actions** - Ctrl+1-7 for instant tab switching
- 🖱️ **Context Menus** - Right-click server cards for quick actions
- 🎯 **Bulk Operations** - Start/stop/restart multiple servers at once
- 📋 **Command Palette** - Ctrl+K for quick navigation

### 🚀 Power Features (NEW v3.13.0)
- 🖱️ **Context Menu** - Right-click on server cards for quick actions
- 📋 **Clipboard Manager** - Copy server IPs, RCON passwords, configs
- 🔍 **Command Palette** - Fuzzy search with `Ctrl+K` for instant navigation
- 🏷️ **Server Tags** - Organize servers with custom tags (production, dev, test, etc.)
- ⭐ **Favorites System** - Star your favorite servers for quick access
- ☑️ **Bulk Operations** - Multi-select servers for batch actions (start/stop/backup/delete)
- 🎯 **Tag Filters** - Filter dashboard by tags or favorites
- 📋 **Command History** - Track and reuse RCON commands

### 📊 Dashboard Upgrade (NEW v3.13.0)
- 🎨 **Customizable Widgets** - Drag & drop grid layout for dashboard
- 📊 **System Stats Widget** - Real-time CPU, RAM, Disk usage
- 🖥️ **Server Overview Widget** - Quick status of all servers
- ⚡ **Quick Actions Widget** - One-click shortcuts
- 📝 **Activity Feed** - Timeline of all actions and events
- 🔄 **Auto-Refresh** - Widgets update automatically
- 💾 **Layout Persistence** - Saves your customization

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 16+ (v18+ recommended)
- **Java** 17+ (for Minecraft servers)
- **4GB RAM** minimum (8GB+ recommended)

### Installation

1. **Clone repository:**
```bash
git clone https://github.com/yourusername/minecraft-server-manager.git
cd minecraft-server-manager
```

2. **Install dependencies:**
```bash
npm install
```

3. **Configure environment:**
```bash
cp .env.example .env
nano .env  # Edit with your settings
```

4. **Start server:**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

5. **Open in browser:**
```
http://localhost:3000
```

### First-Time Setup

1. Register admin account at `/register.html`
2. Login at `/login.html`
3. Create your first server via "Create Server" tab
4. Select server type, version, RAM, ports
5. Click "Create" - server JAR auto-downloads
6. Start server and connect!

---

## 📦 Tech Stack

| Component | Technology |
|-----------|------------|
| **Backend** | Node.js, Express.js |
| **Frontend** | HTML5, CSS3, Vanilla JavaScript |
| **WebSocket** | Socket.IO |
| **Authentication** | JWT + Bcrypt |
| **Security** | Helmet.js, express-rate-limit |
| **RCON** | rcon-client |
| **Charts** | Chart.js |
| **Server APIs** | Mojang, PaperMC, FabricMC, Modrinth, Spigot |
| **Database** | JSON files (data/servers.json, users.json) |

---

## 📖 Documentation

- **[Deployment Guide](DEPLOYMENT.md)** - Production setup with Nginx, PM2, SSL
- **[Copilot Instructions](.github/copilot-instructions.md)** - Complete project documentation
- **[Environment Variables](.env.example)** - All configuration options

---

## 🔧 Configuration

### Environment Variables

Key settings in `.env`:

```env
# Server
PORT=3000
NODE_ENV=production

# Security
JWT_SECRET=your_secret_here
ALLOWED_ORIGINS=https://yourdomain.com
RATE_LIMIT_MAX=100

# Monitoring
MONITORING_INTERVAL=5000
PROXY_MONITORING_INTERVAL=30000
```

See [.env.example](.env.example) for all options.

---

## 🌐 Server Types Supported

| Type | Auto-Download | Plugin Support | Description |
|------|--------------|----------------|-------------|
| **Vanilla** | ✅ | ❌ | Official Minecraft server |
| **Paper** | ✅ | ✅ | High-performance, Spigot-compatible |
| **Fabric** | ✅ | ✅ | Lightweight mod loader |
| **Forge** | ⚠️ Manual | ✅ | Popular mod loader |
| **Spigot** | ⚠️ BuildTools | ✅ | Classic plugin platform |
| **BungeeCord** | ✅ | ✅ | Proxy for multi-server networks |
| **Waterfall** | ✅ | ✅ | Modern BungeeCord fork |

---

## 🛡️ Security Features

### Production Hardening

✅ **Completed:**
- Zero console statements in production code
- No duplicate HTML IDs
- Dead code removed (4 unused functions)
- Empty catch blocks handled
- Helmet.js security headers (CSP, X-Frame-Options, XSS protection)
- Express rate limiting (API: 100 req/15min, Auth: 5 req/15min)
- Environment-based CORS whitelisting
- JWT token authentication with bcrypt passwords

### Recommended Production Setup

```bash
# 1. Use HTTPS with Nginx/Caddy reverse proxy
# 2. Set strong JWT_SECRET (openssl rand -base64 32)
# 3. Configure ALLOWED_ORIGINS with your domain
# 4. Enable firewall (UFW) with restricted ports
# 5. Use PM2 for process management
# 6. Set up automated backups
# 7. Enable Fail2Ban for brute-force protection
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete guide.

---

## ⌨️ Keyboard Shortcuts

Power-user features for faster workflow:

| Shortcut | Action |
|----------|--------|
| `?` | Show keyboard shortcuts help |
| `Ctrl+K` | **Open Command Palette** (fuzzy search) |
| `Ctrl+W` | **Toggle Widget Editor** (customize dashboard) |
| `Ctrl+N` | Create new server |
| `Ctrl+R` | Refresh server list |
| `Ctrl+S` | Save settings |
| `Ctrl+A` | Select all servers (bulk mode) |
| `Ctrl+1-7` | Switch between tabs |
| `ESC` | Close modals |

Press `?` or click the ⌨️ icon in the header to see the complete list!

---

## 🖱️ Context Menu

Right-click on any server card for quick actions:
- ▶️ Start/Stop/Restart Server
- 📋 Copy Server IP & RCON Password
- 📦 Create Backup
- 📄 Export Config / Share as JSON
- 🔗 Open in Details
- 🗑️ Delete Server

---

## 🏷️ Server Tags & Favorites

Organize your servers:
- **Tags**: Custom labels like `production`, `development`, `test`, `pvp`
- **Favorites**: Star important servers (⭐ button)
- **Filters**: Click tags to filter dashboard view
- **Suggestions**: Popular tags with one click

---

## ☑️ Bulk Operations

Multi-select servers for batch actions:
1. Click checkboxes on server cards
2. Select multiple servers
3. Use bulk action bar at bottom:
   - ▶️ **Start All** selected servers
   - ⏹️ **Stop All** selected servers
   - 🔄 **Restart All** selected servers
   - 📦 **Backup All** selected servers
   - 🗑️ **Delete All** selected servers (with confirmation)

**Tip**: Use `Ctrl+A` to select all servers at once!

---

## 📊 Customizable Dashboard

Personalize your dashboard with widgets:

### Widget Types:
1. **🖥️ Server Overview** - Total/Running/Stopped count
2. **📊 System Resources** - CPU, RAM, Disk usage with progress bars
3. **📝 Recent Activity** - Timeline of actions
4. **⚡ Quick Actions** - One-click shortcuts (Start All, Stop All, Search, etc.)

### Customization:
- **Drag & Drop**: Grab widget handle (⋮⋮) to rearrange
- **Refresh**: Click 🔄 icon to update widget data
- **Editor**: Press `Ctrl+W` or click customize button
- **Reset**: Restore default layout anytime

**Layout is saved automatically!**

---

## 📝 Activity Feed

Track everything that happens:
- 📊 **Filter by Type**: Server actions, backups, plugins, players
- 🖥️ **Filter by Server**: See activity for specific server
- ⏱️ **Timestamps**: Human-readable time ago ("5m ago")
- 👤 **User Tracking**: See who performed each action
- 🔄 **Auto-Refresh**: Updates every 30 seconds

**Activity Types:**
- ▶️ Server Start/Stop/Restart
- ➕ Server Create/Delete
- 📦 Backup Create/Restore
- 🔌 Plugin Install/Remove
- ⚙️ Config Changes
- 👤 Player Join/Leave

---

## 🔔 Toast Notifications

Modern notification system with:
- ✅ Animated slide-in/out effects
- ⏱️ Auto-dismiss after 5 seconds
- 📚 Stackable notifications
- 🎨 Color-coded by type (success/error/warning/info)
- ✖️ Manual dismiss button

All user actions now show beautiful toast notifications instead of old-style alerts!

---

## 💾 Unsaved Changes Protection

Never lose your work:
- 🚨 Automatic detection of unsaved changes
- ⚠️ Warning indicator when changes detected
- 🛡️ Browser warning before closing tab
- 📝 Works for all configuration forms

---

## 📊 API Endpoints

### Core Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | ❌ | Register new user |
| `/api/auth/login` | POST | ❌ | Login with JWT |
| `/api/servers` | GET | ✅ | List all servers |
| `/api/servers` | POST | ✅ | Create new server |
| `/api/servers/:id/start` | POST | ✅ | Start server |
| `/api/servers/:id/stop` | POST | ✅ | Stop server |
| `/api/servers/:id/command` | POST | ✅ | Send RCON command |

### Advanced Endpoints

- **Backups**: `GET/POST/DELETE /api/servers/:id/backups`
- **Plugins**: `GET/POST/DELETE /api/servers/:id/plugins`
- **World**: `GET/POST /api/servers/:id/world/*`
- **Players**: `GET/POST /api/servers/:id/players/*`
- **Logs**: `GET /api/servers/:id/logs`
- **Tasks**: `GET/POST/PUT/DELETE /api/tasks`
- **Webhooks**: `GET/POST/PUT/DELETE /api/webhooks`
- **Proxy**: `GET/POST/DELETE /api/servers/:id/proxy/*`

---

## 🎨 Screenshots

### Dashboard
- Server cards with real-time status
- System monitoring (CPU/RAM/Disk)
- One-click server actions

### Server Details
- Live console with auto-scroll
- Resource charts (CPU/RAM/TPS)
- 4 sub-tabs: Overview, Settings, Plugins, Files

### Plugin Browser
- Search Modrinth & Spigot
- Version selection
- One-click install

### Network Topology
- Interactive canvas visualization
- Drag & drop nodes
- Real-time status updates

---

## 🚀 Production Deployment

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server/index.js --name mcmanager

# Save PM2 process list
pm2 save

# Enable startup script
pm2 startup systemd

# Monitor
pm2 monit
```

### Using Docker (Coming Soon)

```bash
docker-compose up -d
```

### Using Systemd

```bash
sudo nano /etc/systemd/system/mcmanager.service
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete instructions.

---

## 🧪 Development

### File Structure

```
minecraft-server-manager/
├── server/                 # Backend
│   ├── index.js           # Express server
│   ├── serverManager.js   # Server lifecycle
│   ├── proxyManager.js    # Proxy management
│   ├── authManager.js     # Authentication
│   ├── backupManager.js   # Backup system
│   └── ...                # Other managers
├── public/                # Frontend
│   ├── dashboard.html     # Main UI
│   ├── js/
│   │   ├── dashboard.js   # Dashboard logic
│   │   ├── serverDetails.js
│   │   ├── proxy.js       # Proxy UI
│   │   └── ...
│   └── css/
│       ├── style.css      # Base styles
│       └── dashboard.css  # Dashboard styles
├── data/                  # JSON database
│   ├── servers.json
│   ├── users.json
│   └── webhooks.json
├── minecraft_servers/     # Server instances
└── backups/               # Backup storage
```

### Adding Features

1. Backend: Add endpoint in `server/index.js`
2. Frontend: Add UI in `public/dashboard.html`
3. Logic: Add JavaScript in `public/js/`
4. Styles: Add CSS in `public/css/`

---

## 🐛 Troubleshooting

### Server won't start
```bash
# Check port availability
netstat -tulpn | grep 3000

# Verify Node.js version
node --version  # Should be 16+

# Check logs
npm run dev
```

### WebSocket errors
```bash
# Allow WebSocket in firewall
sudo ufw allow 3000/tcp

# Check CORS settings in .env
ALLOWED_ORIGINS=http://localhost:3000
```

### Java not found
```bash
# Install Java 17+
sudo apt install openjdk-17-jre-headless

# Verify
java -version
```

---

## 📝 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📧 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/minecraft-server-manager/issues)
- **Documentation**: [Copilot Instructions](.github/copilot-instructions.md)
- **Deployment**: [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🎯 Roadmap

- [ ] Docker support
- [ ] Database migration (SQLite/PostgreSQL)
- [ ] Multi-language support (i18n)
- [ ] Mobile-responsive UI improvements
- [ ] Grafana/Prometheus integration
- [ ] Automated server performance optimization

---

## 🌟 Credits

Built with ❤️ by the Minecraft community.

**Key Dependencies:**
- Express.js - Web framework
- Socket.IO - WebSocket library
- Chart.js - Data visualization
- Helmet.js - Security middleware
- rcon-client - RCON protocol
- bcrypt - Password hashing

---

**Version:** 3.13.0  
**Last Updated:** November 2025  
**Status:** Production Ready 🚀

**New in v3.13.0 - Power Features & Dashboard Upgrade:**
- 🖱️ Context Menu System (Right-click)
- 📋 Clipboard Manager with Command History
- 🔍 Command Palette (Ctrl+K)
- 🏷️ Server Tags & Favorites
- ☑️ Bulk Operations
- 📊 Dashboard Widgets (Customizable Grid)
- 📝 Activity Feed (Timeline)
- 📈 System Stats Widget

**New in v3.12.0 - UX Quick Wins:**
- 🔔 Toast Notification System
- ⌨️ Keyboard Shortcuts
- 💾 Unsaved Changes Warning
- ❓ Interactive Help Modal
