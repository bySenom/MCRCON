# GitHub Setup & Release Instructions

## 1. GitHub Repository erstellen

1. Gehe zu [github.com](https://github.com) und logge dich ein
2. Klicke auf das "+" Icon oben rechts → "New repository"
3. Repository Name: `MCRCON` oder `minecraft-server-manager`
4. Description: `Full-featured Minecraft Server Management Platform with web interface`
5. Wähle "Public" für GitHub Pages Support
6. **NICHT** "Initialize with README" auswählen (haben wir schon)
7. Klicke "Create repository"

## 2. Repository verbinden und pushen

```powershell
# Remote hinzufügen (ersetze USERNAME mit deinem GitHub Username)
git remote add origin https://github.com/USERNAME/MCRCON.git

# Branch umbenennen zu main (falls master)
git branch -M main

# Pushen mit Tags
git push -u origin main --tags
```

## 3. GitHub Pages aktivieren

1. Gehe zu deinem Repository auf GitHub
2. Klicke auf "Settings" → "Pages" (linke Sidebar)
3. Source: "Deploy from a branch"
4. Branch: `main`
5. Folder: `/docs`
6. Klicke "Save"
7. Nach 1-2 Minuten ist deine Seite live unter: `https://USERNAME.github.io/MCRCON/`

## 4. GitHub Release erstellen

### Option A: Über GitHub Web Interface

1. Gehe zu deinem Repository → "Releases" → "Create a new release"
2. Tag: `v3.16.0` (automatisch erkannt)
3. Release title: `v3.16.0 - Host/IP Configuration & First-Time Tutorial`
4. Kopiere die Release Notes unten in das Description-Feld
5. Markiere als "Latest release"
6. Klicke "Publish release"

### Option B: Über GitHub CLI (gh)

```powershell
# GitHub CLI installieren falls noch nicht vorhanden
winget install --id GitHub.cli

# Authentifizieren
gh auth login

# Release erstellen
gh release create v3.16.0 --title "v3.16.0 - Host/IP Configuration & First-Time Tutorial" --notes-file RELEASE_NOTES.md
```

---

## Release Notes v3.16.0

### 🎉 What's New

This release focuses on enabling online hosting with custom domains and improving the first-time user experience!

### ✨ Major Features

#### 🌐 Host/IP Configuration System
Configure custom IP addresses or domain names for your servers to enable online hosting!

- **Custom Host Field**: New `host` configuration (default: `0.0.0.0`)
- **Server Properties**: Automatic `server-ip` configuration
- **Proxy Bind Address**: Configurable bind addresses for Velocity/BungeeCord/Waterfall
- **Automatic Propagation**: Backend servers inherit proxy's host IP
- **Frontend UI**: New input field in server creation form
- **Database Migration**: Existing servers automatically updated

**Example Usage:**
```
Proxy: play.example.com:25565
Backend Server 1: play.example.com:25566 (inherits host)
Backend Server 2: play.example.com:25567 (inherits host)
```

#### 🎓 First-Time Tutorial System
New users get an interactive walkthrough on first visit!

- **10-Step Guide**: Covers all main features
- **Auto-Detection**: Shows automatically for new users
- **Keyboard Shortcuts**: Press ESC to skip
- **Visual Highlights**: Pulsing animations guide attention
- **Can be Reset**: `Tutorial.reset()` in browser console

#### 📖 GitHub Pages Documentation
Complete project documentation website with:

- Feature overview (16+ features)
- Installation guide
- Usage guide for common tasks
- API reference
- Technology stack details
- Responsive dark-themed design

### 🔧 Changes

- Backend server addresses now use proxy's configured host instead of `localhost`
- Improved Velocity placeholder server detection

### 🐛 Bug Fixes

- Backend servers in proxy networks correctly inherit IP addresses
- Proxy host configuration properly propagates to all backend servers

### 📦 Installation

```bash
git clone https://github.com/USERNAME/MCRCON.git
cd MCRCON
npm install
cp .env.example .env
npm start
```

Visit `http://localhost:3000` and follow the tutorial!

### 🔗 Links

- **Documentation**: https://USERNAME.github.io/MCRCON/
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Previous Release**: [v3.15.0](https://github.com/USERNAME/MCRCON/releases/tag/v3.15.0)

### 📸 Screenshots

*(Add screenshots here after uploading to GitHub)*

### 🙏 Credits

Made with ❤️ for the Minecraft community

---

**Full Changelog**: https://github.com/USERNAME/MCRCON/compare/v3.15.0...v3.16.0

---

## 5. README Links aktualisieren

Ersetze in `README.md` und `docs/index.html` alle Vorkommen von:
- `yourusername` → Dein GitHub Username
- `USERNAME` → Dein GitHub Username

```powershell
# PowerShell command (ersetze DEIN_USERNAME)
$files = @('README.md', 'docs/index.html', 'CHANGELOG.md')
foreach ($file in $files) {
    (Get-Content $file) -replace 'yourusername', 'DEIN_USERNAME' -replace 'USERNAME', 'DEIN_USERNAME' | Set-Content $file
}

# Änderungen committen
git add README.md docs/index.html CHANGELOG.md
git commit -m "Update GitHub username in documentation links"
git push
```

## 6. Weitere Optimierungen (Optional)

### Repository Topics hinzufügen
Gehe zu GitHub Repository → "About" (⚙️) → Topics hinzufügen:
- `minecraft`
- `server-manager`
- `nodejs`
- `express`
- `websocket`
- `rcon`
- `proxy`
- `velocity`
- `bungeecord`
- `paper`

### Social Preview erstellen
1. Repository → Settings → Social preview
2. Upload ein Screenshot des Dashboards (1280x640px)

### Branch Protection einrichten (für Teams)
1. Settings → Branches → "Add rule"
2. Branch name pattern: `main`
3. Aktiviere: "Require a pull request before merging"

---

## Fertig! 🎉

Dein Minecraft Server Manager ist jetzt auf GitHub veröffentlicht und dokumentiert!

**Nächste Schritte:**
1. Teile den Link mit der Community
2. Füge Screenshots zum README hinzu
3. Erstelle ein Demo-Video
4. Poste auf r/admincraft oder spigotmc.org
