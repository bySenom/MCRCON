# TODO - Minecraft Server Manager

## Phase 1: Setup (Jetzt machen!)
- [ ] Dependencies installieren: `npm install`
- [ ] `.env` Datei erstellen: `cp .env.example .env`
- [ ] `.env` mit deinen Minecraft Server-Daten ausfüllen
- [ ] Server starten: `npm run dev`

## Phase 2: Server Management System (In Entwicklung)
- [ ] Server Storage System (JSON-basiert)
- [ ] Server Creation API (POST /api/servers/create)
- [ ] Server Control API (start/stop/restart/delete)
- [ ] Server Type Downloads (Vanilla, Spigot, Paper, Forge, Fabric)
- [ ] Server Process Management (child_process spawn)
- [ ] Server List UI (Dashboard)
- [ ] Server Creation Wizard UI

## Phase 3: Plugin/Mod Manager
- [ ] Plugin API Integration (Spigot, Modrinth)
- [ ] Plugin Upload/Download
- [ ] Mod Support (Forge/Fabric)
- [ ] Version Compatibility Check
- [ ] One-Click Install UI

## Nächste Features (Optional)
- [ ] Multi-Server Support (mehrere Server gleichzeitig verwalten)
- [ ] Befehlshistorie speichern (LocalStorage)
- [ ] Auto-Reconnect bei Verbindungsabbruch
- [ ] Server-Favoriten speichern
- [ ] Spieler-Kick/Ban UI
- [ ] Server Performance Monitoring (TPS, RAM)
- [ ] Dark/Light Theme Toggle
- [ ] Export von Logs
- [ ] WebSocket für Live-Updates (Chat, Joins/Leaves)
- [ ] Admin-Dashboard mit Statistiken

## Verbesserungen
- [ ] Input Validierung (IP-Format, Port-Range)
- [ ] Rate Limiting für Commands
- [ ] Verschlüsselte Passwort-Speicherung
- [ ] Authentifizierung für Web-Interface
- [ ] Docker Container Setup
- [ ] Unit Tests hinzufügen
- [ ] API Dokumentation (Swagger/OpenAPI)

## Bekannte Issues
- ESLint Warnungen in `app.js` (forEach vs for...of, getAttribute vs dataset)
- Keine Persistenz bei Server-Neustart
- Ein Server pro RCON-Verbindung Limit
