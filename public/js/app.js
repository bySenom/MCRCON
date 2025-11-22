// RCON Console (legacy) - wrapped in IIFE to avoid conflicts
(function() {
    'use strict';
    
    // API Base URL
    const API_URL = 'http://localhost:3000/api';

    // State Management
    let isConnected = false;
    let currentServer = null;

    // Initialize RCON Console when DOM is ready
    document.addEventListener('DOMContentLoaded', initRconConsole);

    function initRconConsole() {
        
        // DOM Elements
        const connectBtn = document.getElementById('connectBtn');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const serverHost = document.getElementById('serverHost');
        const rconPort = document.getElementById('rconPort');
        const serverPassword = document.getElementById('serverPassword');
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.getElementById('statusText');
        const consoleElement = document.getElementById('console');
        const commandInput = document.getElementById('commandInput');
        const sendCommandBtn = document.getElementById('sendCommandBtn');
        const quickActionButtons = document.querySelectorAll('.btn-action');
        const serverInfo = document.getElementById('serverInfo');

        // Check if elements exist (they might not be on this page)
        if (!connectBtn || !consoleElement) {
            return;
        }

        // Event Listeners
        connectBtn.addEventListener('click', connectToServer);
        disconnectBtn.addEventListener('click', disconnectFromServer);
        sendCommandBtn.addEventListener('click', sendCommand);
        commandInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendCommand();
        });

        for (const btn of quickActionButtons) {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                executeCommand(command);
            });
        }

        // Initialize console
        addConsoleMessage('Konsole bereit. Verbinde dich mit einem Server um zu starten.', 'success');
    }

    // Connect to Minecraft Server
    async function connectToServer() {
        const serverHost = document.getElementById('serverHost');
        const rconPort = document.getElementById('rconPort');
        const serverPassword = document.getElementById('serverPassword');
        const connectBtn = document.getElementById('connectBtn');
        
        const host = serverHost.value.trim();
        const port = rconPort.value.trim();
        const password = serverPassword.value.trim();

        if (!host || !port || !password) {
            addConsoleMessage('Bitte alle Felder ausfüllen!', 'error');
            return;
        }

        try {
            connectBtn.disabled = true;
            addConsoleMessage(`Verbinde mit ${host}:${port}...`, 'command');

            const response = await fetch(`${API_URL}/connect`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ host, port: Number.parseInt(port, 10), password })
            });

            const data = await response.json();

            if (data.success) {
                isConnected = true;
                currentServer = { host, port };
                updateConnectionStatus(true);
                addConsoleMessage('✓ Erfolgreich verbunden!', 'success');
                await fetchServerInfo();
            } else {
                throw new Error(data.message || 'Verbindung fehlgeschlagen');
            }
        } catch (error) {
            addConsoleMessage(`✗ Fehler: ${error.message}`, 'error');
            updateConnectionStatus(false);
        } finally {
            connectBtn.disabled = false;
        }
    }

    // Disconnect from Server
    async function disconnectFromServer() {
        try {
            const response = await fetch(`${API_URL}/disconnect`, {
                method: 'POST'
            });

            const data = await response.json();

            if (data.success) {
                isConnected = false;
                currentServer = null;
                updateConnectionStatus(false);
                addConsoleMessage('Verbindung getrennt', 'success');
                const serverInfo = document.getElementById('serverInfo');
                if (serverInfo) {
                    serverInfo.innerHTML = '<p>Verbinde dich mit einem Server um Informationen zu sehen...</p>';
                }
            }
        } catch (error) {
            addConsoleMessage(`Fehler beim Trennen: ${error.message}`, 'error');
        }
    }

    // Send Command to Server
    async function sendCommand() {
        const commandInput = document.getElementById('commandInput');
        const command = commandInput.value.trim();
        if (!command) return;

        await executeCommand(command);
        commandInput.value = '';
    }

    // Execute RCON Command
    async function executeCommand(command) {
        if (!isConnected) {
            addConsoleMessage('Nicht mit Server verbunden!', 'error');
            return;
        }

        try {
            addConsoleMessage(`> ${command}`, 'command');

            const response = await fetch(`${API_URL}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command })
            });

            const data = await response.json();

            if (data.success) {
                addConsoleMessage(data.response || 'Befehl ausgeführt', 'success');
            } else {
                throw new Error(data.message || 'Befehl fehlgeschlagen');
            }
        } catch (error) {
            addConsoleMessage(`✗ Fehler: ${error.message}`, 'error');
        }
    }

    // Fetch Server Information
    async function fetchServerInfo() {
        try {
            // Get player list
            const listResponse = await fetch(`${API_URL}/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ command: 'list' })
            });

            const listData = await listResponse.json();

            if (listData.success) {
                displayServerInfo(listData.response);
            }
        } catch (error) {
        }
    }

    // Display Server Information
    function displayServerInfo(listResponse) {
        const serverInfo = document.getElementById('serverInfo');
        if (!serverInfo || !currentServer) return;
        
        serverInfo.innerHTML = `
            <div class="info-row">
                <span class="info-label">Server:</span>
                <span class="info-value">${currentServer.host}:${currentServer.port}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">Online</span>
            </div>
            <div class="info-row">
                <span class="info-label">Spieler Info:</span>
                <span class="info-value">${listResponse || 'Keine Daten'}</span>
            </div>
        `;
    }

    // Add Message to Console
    function addConsoleMessage(message, type = '') {
        const consoleElement = document.getElementById('console');
        if (!consoleElement) return;
        
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        consoleElement.appendChild(line);
        consoleElement.scrollTop = consoleElement.scrollHeight;
    }

    // Update Connection Status UI
    function updateConnectionStatus(connected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.getElementById('statusText');
        const disconnectBtn = document.getElementById('disconnectBtn');
        const commandInput = document.getElementById('commandInput');
        const sendCommandBtn = document.getElementById('sendCommandBtn');
        const quickActionButtons = document.querySelectorAll('.btn-action');
        
        if (connected) {
            statusDot.classList.remove('offline');
            statusDot.classList.add('online');
            statusText.textContent = 'Verbunden';
            disconnectBtn.disabled = false;
            commandInput.disabled = false;
            sendCommandBtn.disabled = false;
            for (const btn of quickActionButtons) {
                btn.disabled = false;
            }
        } else {
            statusDot.classList.remove('online');
            statusDot.classList.add('offline');
            statusText.textContent = 'Nicht verbunden';
            disconnectBtn.disabled = true;
            commandInput.disabled = true;
            sendCommandBtn.disabled = true;
            for (const btn of quickActionButtons) {
                btn.disabled = true;
            }
        }
    }

})(); // End of IIFE
