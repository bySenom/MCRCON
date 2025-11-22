# 🚀 Installation

## Windows Installation (Empfohlen)

### Schritt 1: Voraussetzungen installieren

1. **Node.js herunterladen und installieren**
   - Download: https://nodejs.org/ (LTS Version)
   - Während der Installation: "Add to PATH" aktivieren

2. **Java installieren** (für Minecraft Server)
   - Download: https://adoptium.net/
   - Java 17 oder höher empfohlen

### Schritt 2: Minecraft Server Manager installieren

1. **Repository herunterladen**
   ```bash
   git clone https://github.com/bySenom/MCRCON.git
   cd MCRCON
   ```

2. **Installer ausführen**
   - Doppelklick auf `install.bat`
   - Der Installer:
     - Prüft Node.js Installation
     - Installiert alle Dependencies
     - Erstellt `.env` Datei mit Standardeinstellungen

### Schritt 3: Server starten

**Option A: Mit Batch-Datei (Einfach)**
- Doppelklick auf `start.bat`

**Option B: Manuell**
```bash
npm start
```

### Schritt 4: Setup durchführen

1. Browser öffnet sich automatisch oder gehe zu: `http://localhost:3000`
2. Wirst automatisch zum Setup-Wizard weitergeleitet
3. Folge den 4 Schritten:
   - **Schritt 1:** Administrator-Konto erstellen
   - **Schritt 2:** Server-Einstellungen konfigurieren
   - **Schritt 3:** Features-Übersicht
   - **Schritt 4:** Setup abschließen

4. Nach dem Setup → Automatische Weiterleitung zum Dashboard!

---

## Linux/Mac Installation

### Voraussetzungen
```bash
# Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt-get install -y nodejs

# Java
sudo apt install openjdk-17-jdk
```

### Installation
```bash
# Repository klonen
git clone https://github.com/bySenom/MCRCON.git
cd MCRCON

# Dependencies installieren
npm install

# .env Datei erstellen
cp .env.example .env

# Server starten
npm start
```

### Setup durchführen
1. Browser öffnen: `http://localhost:3000`
2. Setup-Wizard folgen
3. Fertig! 🎉

---

## Docker Installation

```bash
# Image bauen
docker build -t minecraft-server-manager .

# Container starten
docker run -d \
  -p 3000:3000 \
  -p 25565:25565 \
  -v $(pwd)/minecraft_servers:/app/minecraft_servers \
  -v $(pwd)/data:/app/data \
  --name mc-manager \
  minecraft-server-manager
```

Setup: `http://localhost:3000`

---

## Konfiguration

### Umgebungsvariablen (.env)

```env
# Server Port
PORT=3000

# Environment
NODE_ENV=production

# JWT Secret (wird automatisch generiert)
JWT_SECRET=your-secret-key-here

# Allowed Origins (für CORS)
ALLOWED_ORIGINS=http://localhost:3000
```

### Standard-Einstellungen

Nach dem Setup werden folgende Standardwerte verwendet:

- **Port:** 3000
- **Standard RAM:** 2GB pro Server
- **Auto-Backups:** Aktiviert (täglich 3:00 Uhr)
- **Auto-Updates:** Aktiviert
- **Server-Verzeichnis:** `./minecraft_servers/`
- **Daten-Verzeichnis:** `./data/`

---

## Erste Schritte nach Installation

### 1. Ersten Server erstellen
1. Im Dashboard: "Server erstellen" Tab öffnen
2. Template wählen oder Custom konfigurieren
3. Server-Typ auswählen (Vanilla, Paper, Fabric, etc.)
4. Version auswählen
5. "Server erstellen" klicken

### 2. Server starten
1. Server aus der Liste auswählen
2. "Start" Button klicken
3. Live-Console öffnet sich automatisch

### 3. Plugins installieren
1. "Plugins & Mods" Tab öffnen
2. Nach Plugin suchen (z.B. "EssentialsX")
3. Version auswählen und installieren

### 4. Backup erstellen
1. Server Details öffnen
2. "Backups" Tab
3. "Backup erstellen" klicken

---

## Troubleshooting

### "Node.js ist nicht installiert"
- Node.js von https://nodejs.org/ installieren
- Terminal/CMD neu starten

### "Port 3000 bereits in Verwendung"
```bash
# In .env Datei ändern:
PORT=3001
```

### "ENOENT: no such file or directory, open 'data/servers.json'"
```bash
# Daten-Ordner erstellen
mkdir data
echo [] > data/servers.json
```

### Server startet nicht
1. Java-Version prüfen: `java -version` (Min. Java 17)
2. RAM ausreichend? (Min. 2GB frei)
3. Port frei? (Standard: 25565)
4. EULA akzeptiert? (wird automatisch gemacht)

---

## Deinstallation

### Windows
```bash
# Server stoppen
# Dann Ordner löschen:
rmdir /s MCRCON
```

### Linux/Mac
```bash
# Server stoppen
# Dann Ordner löschen:
rm -rf MCRCON
```

---

## Support

- **GitHub Issues:** https://github.com/bySenom/MCRCON/issues
- **Dokumentation:** https://bysenom.github.io/MCRCON/
- **Discord:** [Coming Soon]

---

## Nächste Schritte

📖 Lies die [vollständige Dokumentation](https://bysenom.github.io/MCRCON/)
🎮 Erstelle deinen ersten Server
🔌 Installiere Plugins
💾 Richte automatische Backups ein
🌐 Erstelle ein Proxy-Netzwerk
