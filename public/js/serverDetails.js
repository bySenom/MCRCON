/**
 * Server Details Management
 */

const ServerDetails = (function() {
    const API_URL = 'http://localhost:3000/api';
    
    let currentServer = null;
    let currentPath = '';
    let openEditors = new Map(); // Track multiple editor windows
    let editorCounter = 0;
    let highestZIndex = 1000;
    let socket = null; // WebSocket connection
    let subscribedServerId = null; // Currently subscribed server

    // Helper to get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Initialize WebSocket connection
    function initializeWebSocket() {
        if (socket?.connected) return socket;

        socket = io('http://localhost:3000');

        socket.on('connect', () => {
            
            // Authenticate WebSocket connection
            const token = localStorage.getItem('auth_token');
            if (token) {
                socket.emit('authenticate', token);
            }
            
            // Re-subscribe to current server if any
            if (subscribedServerId) {
                socket.emit('subscribe-server', subscribedServerId);
            }
        });

        socket.on('authenticated', (data) => {
            if (!data.success) {
                showMessage('WebSocket authentication failed', 'error');
            }
        });

        socket.on('disconnect', () => {
            // WebSocket disconnected - will auto-reconnect
        });
        
        socket.on('subscription-error', (data) => {
            showMessage(data.message, 'error');
        });

        // Handle real-time console logs
        socket.on('console-log', (data) => {
            if (data.serverId === currentServer?.id) {
                addConsoleLog(data.type, data.message, data.timestamp);
            }
        });

        // Handle server status changes
        socket.on('server-status', (data) => {
            if (data.serverId === currentServer?.id) {
                handleServerStatusUpdate(data);
            }
        });

        // Handle resource stats updates
        socket.on('resource-stats', (data) => {
            if (data.serverId === currentServer?.id) {
                updateResourceStats(data.stats);
            }
        });

        return socket;
    }

    // Subscribe to server events
    function subscribeToServer(serverId) {
        if (!socket) {
            initializeWebSocket();
        }

        // Unsubscribe from previous server
        if (subscribedServerId && subscribedServerId !== serverId) {
            socket.emit('unsubscribe-server', subscribedServerId);
        }

        // Subscribe to new server
        subscribedServerId = serverId;
        socket.emit('subscribe-server', serverId);
    }

    // Initialize
    let listenersSetup = false; // Track if listeners are already set up
    
    function init() {
        if (!listenersSetup) {
            setupEventListeners();
            listenersSetup = true;
        }
    }

    function setupEventListeners() {
        // Back button
        const backBtn = document.getElementById('backToDashboard');
        if (backBtn) {
            backBtn.removeEventListener('click', handleBackClick); // Remove old listener
            backBtn.addEventListener('click', handleBackClick);
        }

        // Server control buttons - remove old listeners first
        const startBtn = document.getElementById('serverDetailsStart');
        const stopBtn = document.getElementById('serverDetailsStop');
        const restartBtn = document.getElementById('serverDetailsRestart');
        const deleteBtn = document.getElementById('serverDetailsDelete');
        
        if (startBtn) {
            startBtn.removeEventListener('click', handleStartClick);
            startBtn.addEventListener('click', handleStartClick);
        }
        if (stopBtn) {
            stopBtn.removeEventListener('click', handleStopClick);
            stopBtn.addEventListener('click', handleStopClick);
        }
        if (restartBtn) {
            restartBtn.removeEventListener('click', handleRestartClick);
            restartBtn.addEventListener('click', handleRestartClick);
        }
        if (deleteBtn) {
            deleteBtn.removeEventListener('click', handleDeleteClick);
            deleteBtn.addEventListener('click', handleDeleteClick);
        }

        // Sub-tab switching
        const subTabs = document.querySelectorAll('.server-sub-tab');
        subTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                switchSubTab(tab.dataset.subtab);
            });
        });

        // Settings form
        const propsForm = document.getElementById('serverPropertiesForm');
        if (propsForm) {
            propsForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await saveServerProperties();
            });
        }

        // Reload properties
        document.getElementById('reloadProperties')?.addEventListener('click', () => {
            if (currentServer) {
                loadServerProperties(currentServer.id);
            }
        });

        // Plugin search in details
        document.getElementById('detailSearchPlugins')?.addEventListener('click', () => searchPluginsForServer());
        document.getElementById('detailPluginSearch')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchPluginsForServer();
        });

        // Refresh plugins
        document.getElementById('refreshServerPlugins')?.addEventListener('click', () => {
            if (currentServer) {
                loadServerPlugins(currentServer.id);
            }
        });

        // File explorer
        document.getElementById('refreshFiles')?.addEventListener('click', () => {
            if (currentServer) {
                loadFiles(currentServer.id, currentPath);
            }
        });

        document.getElementById('goUpDirectory')?.addEventListener('click', () => {
            if (currentPath) {
                const parts = currentPath.split('/').filter(p => p);
                parts.pop();
                currentPath = parts.join('/');
                if (currentServer) {
                    loadFiles(currentServer.id, currentPath);
                }
            }
        });

        // Backup management
        document.getElementById('createBackupBtn')?.addEventListener('click', () => createBackup());
        
        // Console command input
        const consoleInput = document.getElementById('consoleCommand');
        if (consoleInput) {
            consoleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendCommand();
                }
            });
        }
        
        // Quick command buttons
        document.getElementById('quickCmdStop')?.addEventListener('click', () => sendQuickCommand('stop'));
        document.getElementById('quickCmdSay')?.addEventListener('click', () => {
            const msg = prompt('Nachricht an Spieler:');
            if (msg) sendQuickCommand(`say ${msg}`);
        });
        document.getElementById('quickCmdList')?.addEventListener('click', () => sendQuickCommand('list'));
        document.getElementById('quickCmdSave')?.addEventListener('click', () => sendQuickCommand('save-all'));
        
        // Clear console button
        document.getElementById('clearConsole')?.addEventListener('click', () => clearConsole());
    }

    // Show server details
    async function showServer(serverId) {
        try {
            const response = await fetch(`${API_URL}/servers/${serverId}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success || !data.server) {
                showMessage('Server nicht gefunden', 'error');
                return;
            }

            currentServer = data.server;
            renderServerDetails(currentServer);
            
            // Reset charts and resource history for new server
            resetChartsForNewServer();
            
            // Initialize WebSocket and subscribe to this server
            initializeWebSocket();
            subscribeToServer(currentServer.id);
            
            // Clear console for new server
            clearConsole();
            
            // Update plugin manager with current server
            if (typeof PluginManager !== 'undefined') {
                PluginManager.setSelectedServer(currentServer.id);
            }
            
            switchTab('server-details');
            switchSubTab('overview');
            
            // Load initial data
            await loadServerProperties(serverId);
            await loadServerPlugins(serverId);
        } catch (error) {
            showMessage('Fehler beim Laden der Server-Details', 'error');
        }
    }

    // Render server details
    function renderServerDetails(server) {
        // Header
        document.getElementById('serverDetailsName').textContent = server.name;
        document.getElementById('serverDetailsInfo').textContent = `${server.type} - ${server.version}`;

        // Control buttons
        const startBtn = document.getElementById('serverDetailsStart');
        const stopBtn = document.getElementById('serverDetailsStop');
        const restartBtn = document.getElementById('serverDetailsRestart');

        if (server.status === 'running') {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'block';
            restartBtn.style.display = 'block';
        } else {
            startBtn.style.display = 'block';
            stopBtn.style.display = 'none';
            restartBtn.style.display = 'none';
        }

        // Show/hide tabs based on server type
        const isProxy = server.type === 'bungeecord' || server.type === 'waterfall' || server.type === 'velocity';
        
        // Network tab: Only for proxy servers
        const networkTab = document.querySelector('[data-subtab="network"]');
        if (networkTab) {
            networkTab.style.display = isProxy ? 'inline-block' : 'none';
        }
        
        // World tab: Hide for proxy servers
        const worldTab = document.querySelector('[data-subtab="world"]');
        if (worldTab) {
            worldTab.style.display = isProxy ? 'none' : 'inline-block';
        }
        
        // Proxy settings section in Settings tab: Only for proxy servers
        const proxySettingsSection = document.querySelector('#proxySettingsForm')?.closest('div[style*="background: var(--bg-secondary)"]');
        if (proxySettingsSection) {
            proxySettingsSection.style.display = isProxy ? 'block' : 'none';
        }
        
        // Gamerules section in Settings tab: Hide for proxy servers
        const gamerarulesSection = document.querySelector('#gamerules-list')?.closest('div[style*="background: var(--bg-secondary)"]');
        if (gamerarulesSection) {
            gamerarulesSection.style.display = isProxy ? 'none' : 'block';
        }
        
        // World Border section in Settings tab: Hide for proxy servers
        const worldBorderSection = document.querySelector('#world-border-config')?.closest('div[style*="background: var(--bg-secondary)"]');
        if (worldBorderSection) {
            worldBorderSection.style.display = isProxy ? 'none' : 'block';
        }
        
        // Plugins tab: Always show, but content will be filtered
        // (Proxy plugins vs server plugins)

        // Overview
        document.getElementById('detailStatus').textContent = server.status === 'running' ? '🟢 Online' : '🔴 Offline';
        document.getElementById('detailStatus').style.color = server.status === 'running' ? 'var(--success)' : 'var(--error)';
        document.getElementById('detailType').textContent = server.type.toUpperCase();
        document.getElementById('detailVersion').textContent = server.version;
        document.getElementById('detailPort').textContent = server.port;
        document.getElementById('detailRconPort').textContent = server.rconPort;
        document.getElementById('detailMemory').textContent = server.memory;
        document.getElementById('detailCreated').textContent = new Date(server.createdAt).toLocaleString('de-DE');
        document.getElementById('detailPath').textContent = server.path;

        // Set plugin version search
        const versionInput = document.getElementById('detailPluginVersion');
        if (versionInput) {
            versionInput.value = server.version;
        }
        
        // Subscribe to WebSocket updates for this server
        if (typeof WebSocketManager !== 'undefined') {
            WebSocketManager.subscribeToServer(server.id);
        }
        
        // Listen for console logs
        document.addEventListener('server-console-log', handleConsoleLog);
        document.addEventListener('server-status-change', handleStatusChange);
        document.addEventListener('server-resource-update', handleResourceUpdate);
        
        // Initialize charts if server is running
        if (server.status === 'running') {
            initializeCharts();
        }
    }
    
    // Add console log directly (used by WebSocket)
    function addConsoleLog(type, message, timestamp) {
        const consoleEl = document.getElementById('liveConsole');
        if (!consoleEl) return;
        
        const logLine = document.createElement('div');
        logLine.style.marginBottom = '2px';
        
        // Color based on type
        if (type === 'stderr') {
            logLine.style.color = '#ff5555';
        } else if (message.includes('INFO')) {
            logLine.style.color = '#50fa7b';
        } else if (message.includes('WARN')) {
            logLine.style.color = '#f1fa8c';
        } else if (message.includes('ERROR')) {
            logLine.style.color = '#ff5555';
        }
        
        // Format message
        const time = new Date(timestamp).toLocaleTimeString('de-DE');
        logLine.textContent = `[${time}] ${message.trim()}`;
        
        consoleEl.appendChild(logLine);
        
        // Auto-scroll if enabled
        const autoScroll = document.getElementById('autoScrollCheckbox');
        if (autoScroll && autoScroll.checked) {
            consoleEl.scrollTop = consoleEl.scrollHeight;
        }
        
        // Limit console to last 500 lines
        while (consoleEl.children.length > 500) {
            consoleEl.firstChild.remove();
        }
    }
    
    function handleConsoleLog(event) {
        const { serverId, type, message, timestamp } = event.detail;
        
        if (!currentServer || currentServer.id !== serverId) return;
        
        addConsoleLog(type, message, timestamp);
    }
    
    // Handle server status updates from WebSocket
    function handleServerStatusUpdate(data) {
        const { status, exitCode } = data;
        
        // Update server status in memory
        currentServer.status = status;
        
        // Update UI
        const statusEl = document.getElementById('detailStatus');
        if (statusEl) {
            statusEl.textContent = status === 'running' ? '🟢 Online' : '🔴 Offline';
            statusEl.style.color = status === 'running' ? 'var(--success)' : 'var(--error)';
        }
        
        // Update buttons
        updateControlButtons(status);
        
        // Show notification
        if (status === 'stopped') {
            const message = exitCode === 0 
                ? 'Server wurde gestoppt' 
                : `Server ist abgestürzt (Exit Code: ${exitCode})`;
            showMessage(message, exitCode === 0 ? 'info' : 'error');
        }
        
        // Handle charts on status change
        if (status === 'running') {
            initializeCharts();
        } else {
            destroyCharts();
        }
    }
    
    function handleStatusChange(event) {
        const { serverId, status } = event.detail;
        
        if (!currentServer || currentServer.id !== serverId) return;
        
        // Update server status in memory
        currentServer.status = status;
        
        // Update UI
        const statusEl = document.getElementById('detailStatus');
        if (statusEl) {
            statusEl.textContent = status === 'running' ? '🟢 Online' : '🔴 Offline';
            statusEl.style.color = status === 'running' ? 'var(--success)' : 'var(--error)';
        }
        
        // Update buttons
        updateControlButtons(status);
        
        // Handle charts on status change
        if (status === 'running') {
            initializeCharts();
        } else {
            destroyCharts();
        }
    }
    
    function updateControlButtons(status) {
        const startBtn = document.getElementById('serverDetailsStart');
        const stopBtn = document.getElementById('serverDetailsStop');
        const restartBtn = document.getElementById('serverDetailsRestart');
        
        if (status === 'running') {
            startBtn.style.display = 'none';
            stopBtn.style.display = 'inline-block';
            restartBtn.style.display = 'inline-block';
        } else {
            startBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            restartBtn.style.display = 'none';
        }
    }
    
    function clearConsole() {
        const consoleEl = document.getElementById('liveConsole');
        if (consoleEl) {
            consoleEl.innerHTML = '';
        }
    }
    
    async function sendCommand() {
        if (!currentServer) return;
        
        const input = document.getElementById('consoleCommand');
        const command = input.value.trim();
        
        if (!command) return;
        
        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/command`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ command })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Add command to console
                const consoleEl = document.getElementById('liveConsole');
                if (consoleEl) {
                    const logLine = document.createElement('div');
                    logLine.style.color = '#8be9fd';
                    logLine.style.marginBottom = '2px';
                    logLine.textContent = `> ${command}`;
                    consoleEl.appendChild(logLine);
                    consoleEl.scrollTop = consoleEl.scrollHeight;
                }
                
                // Clear input
                input.value = '';
            } else {
                showMessage(data.message || 'Fehler beim Senden', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Senden des Befehls', 'error');
        }
    }
    
    function sendQuickCommand(command) {
        const input = document.getElementById('consoleCommand');
        input.value = command;
        sendCommand();
    }
    
    // Update resource stats from WebSocket
    function updateResourceStats(stats) {
        // Update text displays
        const cpuEl = document.getElementById('cpuUsage');
        const ramEl = document.getElementById('ramUsage');
        const tpsEl = document.getElementById('tpsValue');
        
        if (cpuEl && stats.cpu !== undefined) {
            cpuEl.textContent = `${stats.cpu.toFixed(1)}%`;
        }
        
        if (ramEl && stats.memory !== undefined) {
            const ramMB = stats.memory / 1024 / 1024;
            ramEl.textContent = `${ramMB.toFixed(0)} MB`;
        }
        
        if (tpsEl && stats.tps !== undefined) {
            tpsEl.textContent = stats.tps.toFixed(2);
            // Color based on TPS
            if (stats.tps >= 19.5) {
                tpsEl.style.color = 'var(--success-color)';
            } else if (stats.tps >= 15) {
                tpsEl.style.color = 'var(--warning-color)';
            } else {
                tpsEl.style.color = 'var(--danger-color)';
            }
        }
        
        // Update charts if they exist
        if (cpuChart || ramChart || tpsChart) {
            updateCharts(stats);
        }
    }

    // Chart.js instances
    let cpuChart = null;
    let ramChart = null;
    let tpsChart = null;
    let cpuCores = 1; // Track CPU core count for scaling
    let resourceHistory = {
        labels: [],
        cpuData: [],
        ramData: [],
        tpsData: [],
        maxDataPoints: 30
    };
    
    function resetChartsForNewServer() {
        
        // Clear resource history
        resourceHistory.labels = [];
        resourceHistory.cpuData = [];
        resourceHistory.ramData = [];
        resourceHistory.tpsData = [];
        
        // Reset CPU cores
        cpuCores = 1;
        
        // Update charts if they exist
        if (cpuChart) {
            cpuChart.data.labels = [];
            cpuChart.data.datasets[0].data = [];
            cpuChart.data.datasets[0].label = 'CPU Auslastung (%)';
            cpuChart.update();
        }
        
        if (ramChart) {
            ramChart.data.labels = [];
            ramChart.data.datasets[0].data = [];
            ramChart.update();
        }
        
        if (tpsChart) {
            tpsChart.data.labels = [];
            tpsChart.data.datasets[0].data = [];
            tpsChart.update();
        }
        
    }
    
    function initializeCharts() {
        
        // Show resource monitoring section
        const monitoringSection = document.getElementById('resourceMonitoring');
        if (monitoringSection) {
            monitoringSection.style.display = 'block';
        } else {
        }
        
        // CPU Chart
        const cpuCtx = document.getElementById('cpuChart');
        if (cpuCtx && !cpuChart) {
            cpuChart = new Chart(cpuCtx, {
                type: 'line',
                data: {
                    labels: resourceHistory.labels,
                    datasets: [{
                        label: `CPU Auslastung (% - ${cpuCores} Cores)`,
                        data: resourceHistory.cpuData,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#e0e0e0' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { 
                                color: '#e0e0e0',
                                callback: function(value) {
                                    return value.toFixed(0) + '%';
                                }
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            display: true,
                            ticks: { 
                                color: '#e0e0e0',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 10
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    }
                }
            });
        }
        
        // RAM Chart
        const ramCtx = document.getElementById('ramChart');
        if (ramCtx && !ramChart) {
            ramChart = new Chart(ramCtx, {
                type: 'line',
                data: {
                    labels: resourceHistory.labels,
                    datasets: [{
                        label: 'RAM Auslastung (MB)',
                        data: resourceHistory.ramData,
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#e0e0e0' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { 
                                color: '#e0e0e0',
                                callback: function(value) {
                                    return value.toFixed(0) + ' MB';
                                }
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            display: true,
                            ticks: { 
                                color: '#e0e0e0',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 10
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    }
                }
            });
        }
        
        // TPS Chart
        const tpsCtx = document.getElementById('tpsChart');
        if (tpsCtx && !tpsChart) {
            tpsChart = new Chart(tpsCtx, {
                type: 'line',
                data: {
                    labels: resourceHistory.labels,
                    datasets: [{
                        label: 'TPS (Ticks per Second)',
                        data: resourceHistory.tpsData,
                        borderColor: 'rgb(153, 102, 255)',
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: {
                        duration: 750,
                        easing: 'easeInOutQuart'
                    },
                    plugins: {
                        legend: {
                            display: true,
                            labels: { color: '#e0e0e0' }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 20,
                            ticks: { 
                                color: '#e0e0e0',
                                callback: function(value) {
                                    return value.toFixed(1);
                                }
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            display: true,
                            ticks: { 
                                color: '#e0e0e0',
                                maxRotation: 0,
                                autoSkip: true,
                                maxTicksLimit: 10
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    }
                }
            });
        }
        
    }
    
    function destroyCharts() {
        // Hide resource monitoring section
        const monitoringSection = document.getElementById('resourceMonitoring');
        if (monitoringSection) {
            monitoringSection.style.display = 'none';
        }
        
        // Destroy chart instances
        if (cpuChart) {
            cpuChart.destroy();
            cpuChart = null;
        }
        if (ramChart) {
            ramChart.destroy();
            ramChart = null;
        }
        if (tpsChart) {
            tpsChart.destroy();
            tpsChart = null;
        }
        
        // Clear history
        resourceHistory = {
            labels: [],
            cpuData: [],
            ramData: [],
            tpsData: [],
            maxDataPoints: 30
        };
    }
    
    function handleResourceUpdate(event) {
        const { serverId, process: processStats, tps } = event.detail;
        
        
        if (!currentServer || currentServer.id !== serverId) {
            return;
        }
        if (!processStats) {
            return;
        }
        
        // Update CPU core count if available
        if (processStats.cpuCores && processStats.cpuCores !== cpuCores) {
            cpuCores = processStats.cpuCores;
            // Update chart label if chart exists
            if (cpuChart) {
                cpuChart.data.datasets[0].label = `CPU Auslastung (% - ${cpuCores} Cores)`;
            }
        }
        
        // Add new data point
        const timeLabel = new Date().toLocaleTimeString('de-DE', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        resourceHistory.labels.push(timeLabel);
        resourceHistory.cpuData.push(Number(processStats.cpu.toFixed(2)));
        resourceHistory.ramData.push(Number((processStats.memory.used / 1024 / 1024).toFixed(2))); // Convert to MB
        resourceHistory.tpsData.push(tps ? Number(tps.toFixed(2)) : 20);
        
        
        // Keep only last N data points
        if (resourceHistory.labels.length > resourceHistory.maxDataPoints) {
            resourceHistory.labels.shift();
            resourceHistory.cpuData.shift();
            resourceHistory.ramData.shift();
            resourceHistory.tpsData.shift();
        }
        
        // Sync chart data with resource history
        if (cpuChart) {
            cpuChart.data.labels = [...resourceHistory.labels];
            cpuChart.data.datasets[0].data = [...resourceHistory.cpuData];
            cpuChart.update('active');
        }
        if (ramChart) {
            ramChart.data.labels = [...resourceHistory.labels];
            ramChart.data.datasets[0].data = [...resourceHistory.ramData];
            ramChart.update('active');
        }
        if (tpsChart) {
            tpsChart.data.labels = [...resourceHistory.labels];
            tpsChart.data.datasets[0].data = [...resourceHistory.tpsData];
            tpsChart.update('active');
        }
    }

    // Switch sub-tab
    function switchSubTab(subtabName) {
        
        // Update buttons
        document.querySelectorAll('.server-sub-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-subtab="${subtabName}"]`)?.classList.add('active');

        // Update content
        document.querySelectorAll('.server-subtab-content').forEach(content => {
            content.classList.remove('active');
        });
        const subtabElement = document.getElementById(`${subtabName}-subtab`);
        subtabElement?.classList.add('active');

        // Load data when switching tabs
        if (currentServer) {
            if (subtabName === 'files') {
                currentPath = '';
                loadFiles(currentServer.id, currentPath);
            } else if (subtabName === 'plugins') {
                loadServerPlugins(currentServer.id);
            } else if (subtabName === 'backups') {
                loadBackups();
            } else if (subtabName === 'settings') {
                // Load gamerules and world border for settings tab
                if (typeof WorldManager !== 'undefined') {
                    WorldManager.init(currentServer.id);
                }
                // Load proxy settings if this is a proxy server
                const isProxy = currentServer.type === 'bungeecord' || currentServer.type === 'waterfall' || currentServer.type === 'velocity';
                if (isProxy && typeof loadProxySettings !== 'undefined') {
                    loadProxySettings();
                }
            } else if (subtabName === 'world') {
                if (typeof WorldManager !== 'undefined') {
                    WorldManager.init(currentServer.id);
                }
            } else if (subtabName === 'players') {
                initializePlayerManagement(currentServer.id);
            } else if (subtabName === 'network') {
                if (typeof initializeProxyManagement !== 'undefined') {
                    initializeProxyManagement(currentServer.id, currentServer.name);
                }
            }
        }
    }

    // Server control actions
    // Handler functions for buttons
    function handleBackClick() {
        switchTab('dashboard');
    }
    
    function handleStartClick() {
        startServer();
    }
    
    function handleStopClick() {
        stopServer();
    }
    
    function handleRestartClick() {
        restartServer();
    }
    
    function handleDeleteClick() {
        deleteServer();
    }

    async function startServer() {
        if (!currentServer) return;
        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/start`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                showMessage('Server wird gestartet...', 'success');
                setTimeout(() => showServer(currentServer.id), 2000);
            } else {
                showMessage(data.message || 'Fehler beim Starten', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Starten des Servers', 'error');
        }
    }

    async function stopServer() {
        if (!currentServer) return;
        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/stop`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                showMessage('Server wird gestoppt...', 'success');
                setTimeout(() => showServer(currentServer.id), 2000);
            } else {
                showMessage(data.message || 'Fehler beim Stoppen', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Stoppen des Servers', 'error');
        }
    }

    async function restartServer() {
        if (!currentServer) return;
        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/restart`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                showMessage('Server wird neugestartet...', 'success');
                setTimeout(() => showServer(currentServer.id), 3000);
            } else {
                showMessage(data.message || 'Fehler beim Neustart', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Neustart des Servers', 'error');
        }
    }

    async function deleteServer() {
        if (!currentServer) return;
        
        // Confirm deletion
        const confirmMsg = `Server "${currentServer.name}" wirklich löschen?\n\nAlle Serverdaten (Welten, Konfigurationen, Plugins) werden unwiderruflich gelöscht!`;
        if (!confirm(confirmMsg)) return;
        
        // Second confirmation for extra safety
        const doubleConfirm = `Bist du dir ABSOLUT SICHER?\n\nDieser Vorgang kann nicht rückgängig gemacht werden!`;
        if (!confirm(doubleConfirm)) return;
        
        try {
            showMessage('Server wird gelöscht...', 'info');
            
            const response = await fetch(`${API_URL}/servers/${currentServer.id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                showMessage(`Server "${currentServer.name}" wurde erfolgreich gelöscht`, 'success');
                
                // Unsubscribe from WebSocket events
                if (socket && subscribedServerId === currentServer.id) {
                    socket.emit('unsubscribe-server', currentServer.id);
                    subscribedServerId = null;
                }
                
                // Reset current server
                currentServer = null;
                
                // Go back to dashboard and reload servers
                setTimeout(() => {
                    switchTab('dashboard');
                    if (window.loadServers) {
                        window.loadServers();
                    }
                }, 1000);
            } else {
                showMessage(data.message || 'Fehler beim Löschen', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Löschen des Servers', 'error');
        }
    }

    // Load server properties
    async function loadServerProperties(serverId) {
        try {
            const response = await fetch(`${API_URL}/servers/${serverId}/config/server.properties`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.success && data.properties) {
                const props = data.properties;
                document.getElementById('propMotd').value = props.motd || '';
                document.getElementById('propMaxPlayers').value = props['max-players'] || 20;
                document.getElementById('propDifficulty').value = props.difficulty || 'normal';
                document.getElementById('propGamemode').value = props.gamemode || 'survival';
                document.getElementById('propViewDistance').value = props['view-distance'] || 10;
                document.getElementById('propPvp').checked = props.pvp === 'true';
                document.getElementById('propWhitelist').checked = props['white-list'] === 'true';
                document.getElementById('propOnlineMode').checked = props['online-mode'] === 'true';
                document.getElementById('propCommandBlocks').checked = props['enable-command-block'] === 'true';
            }
        } catch (error) {
        }
    }

    // Save server properties
    async function saveServerProperties() {
        if (!currentServer) return;

        const properties = {
            'motd': document.getElementById('propMotd').value,
            'max-players': document.getElementById('propMaxPlayers').value,
            'difficulty': document.getElementById('propDifficulty').value,
            'gamemode': document.getElementById('propGamemode').value,
            'view-distance': document.getElementById('propViewDistance').value,
            'pvp': document.getElementById('propPvp').checked.toString(),
            'white-list': document.getElementById('propWhitelist').checked.toString(),
            'online-mode': document.getElementById('propOnlineMode').checked.toString(),
            'enable-command-block': document.getElementById('propCommandBlocks').checked.toString()
        };

        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/config/server.properties`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ properties })
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Einstellungen gespeichert! Server neustarten, um Änderungen anzuwenden.', 'success');
                // Mark changes as saved
                if (window.UnsavedChanges) {
                    UnsavedChanges.markAsSaved();
                }
            } else {
                showMessage(data.message || 'Fehler beim Speichern', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Speichern der Einstellungen', 'error');
        }
    }

    // Plugin management for specific server
    async function searchPluginsForServer() {
        if (!currentServer) return;

        const query = document.getElementById('detailPluginSearch').value.trim();
        const source = document.getElementById('detailPluginSource').value;
        const mcVersion = document.getElementById('detailPluginVersion').value.trim();
        const resultsContainer = document.getElementById('detailPluginResults');

        if (!query) {
            showMessage('Bitte gib einen Suchbegriff ein', 'error');
            return;
        }

        resultsContainer.innerHTML = '<div class="loading" style="grid-column: 1 / -1; text-align: center;">Suche läuft...</div>';

        try {
            const params = new URLSearchParams({ q: query });
            if (source) params.append('source', source);
            
            // Auto-determine type based on server type
            if (currentServer.type === 'bungeecord' || currentServer.type === 'waterfall') {
                // BungeeCord/Waterfall plugins (use 'bungeecord' type for search)
                params.append('type', 'bungeecord');
            } else if (currentServer.type === 'velocity') {
                // Velocity plugins
                params.append('type', 'velocity');
            } else if (currentServer.type === 'paper' || currentServer.type === 'spigot') {
                params.append('type', 'paper');
            } else if (currentServer.type === 'fabric') {
                params.append('type', 'fabric');
            } else if (currentServer.type === 'forge') {
                params.append('type', 'forge');
            }
            
            if (mcVersion) params.append('version', mcVersion);

            const response = await fetch(`${API_URL}/plugins/search?${params}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Suche fehlgeschlagen');
            }

            renderPluginResults(data.results, resultsContainer);
        } catch (error) {
            resultsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--error);">Fehler bei der Suche: ${error.message}</div>`;
        }
    }

    function renderPluginResults(plugins, container) {
        if (!plugins || plugins.length === 0) {
            container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Keine Ergebnisse gefunden</div>';
            return;
        }

        container.innerHTML = plugins.map(plugin => `
            <div class="plugin-card" style="background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 8px; padding: 1rem;">
                <div style="display: flex; align-items: start; gap: 1rem; margin-bottom: 0.75rem;">
                    ${plugin.icon ? `<img src="${plugin.icon}" alt="${escapeHtml(plugin.name)}" style="width: 40px; height: 40px; border-radius: 6px;">` : '<div style="width: 40px; height: 40px; background: var(--primary); border-radius: 6px; display: flex; align-items: center; justify-content: center;">📦</div>'}
                    <div style="flex: 1; min-width: 0;">
                        <h4 style="margin: 0 0 0.25rem 0; font-size: 1rem;">${escapeHtml(plugin.name)}</h4>
                        <span style="background: var(--primary); color: white; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${plugin.source}</span>
                    </div>
                </div>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0 0 0.75rem 0; line-height: 1.4;">${escapeHtml((plugin.description || 'Keine Beschreibung').substring(0, 100))}...</p>
                <button class="btn btn-primary btn-sm" onclick="ServerDetails.installPluginToServer('${plugin.id}', '${plugin.source}', '${escapeHtml(plugin.name)}')" style="width: 100%; padding: 0.5rem;">
                    Installieren
                </button>
            </div>
        `).join('');
    }

    async function installPluginToServer(pluginId, source, pluginName) {
        if (!currentServer) return;

        const modal = document.getElementById('serverModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `${pluginName} installieren`;
        modalBody.innerHTML = '<div class="loading">Lade Versionen...</div>';
        modal.style.display = 'flex';

        try {
            const mcVersion = document.getElementById('detailPluginVersion').value.trim();
            const params = mcVersion ? `?mcVersion=${mcVersion}` : '';
            
            const response = await fetch(`${API_URL}/plugins/${source}/${pluginId}/versions${params}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success || !data.versions || data.versions.length === 0) {
                modalBody.innerHTML = '<p style="color: var(--error);">Keine Versionen gefunden</p>';
                return;
            }

            modalBody.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Version wählen:</label>
                    <select id="versionSelect" style="width: 100%; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px;">
                        ${data.versions.map((v, i) => `
                            <option value="${i}" data-url="${v.url}" data-filename="${v.filename}">
                                ${v.name || v.version_number || v.filename} ${v.game_versions ? `(MC ${v.game_versions.join(', ')})` : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="ServerDetails.confirmPluginInstall()">
                        Installieren
                    </button>
                    <button class="btn btn-secondary" onclick="ServerDetails.closeModal()">
                        Abbrechen
                    </button>
                </div>
            `;
        } catch (error) {
            modalBody.innerHTML = `<p style="color: var(--error);">Fehler beim Laden der Versionen: ${error.message}</p>`;
        }
    }

    async function confirmPluginInstall() {
        if (!currentServer) return;

        const versionSelect = document.getElementById('versionSelect');
        if (!versionSelect) return;

        const selectedOption = versionSelect.options[versionSelect.selectedIndex];
        const url = selectedOption.getAttribute('data-url');
        const filename = selectedOption.getAttribute('data-filename');

        if (!url || !filename) {
            showMessage('Ungültige Version ausgewählt', 'error');
            return;
        }

        try {
            showMessage('Installation läuft...', 'info');
            
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/plugins/install`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ url, filename })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Installation fehlgeschlagen');
            }

            showMessage(`${filename} erfolgreich installiert!`, 'success');
            closeModal();
            loadServerPlugins(currentServer.id);
        } catch (error) {
            showMessage(`Installation fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    async function loadServerPlugins(serverId) {
        const container = document.getElementById('serverPluginsList');
        container.innerHTML = '<div class="loading">Lade Plugins...</div>';

        try {
            const response = await fetch(`${API_URL}/servers/${serverId}/plugins`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Fehler beim Laden');
            }

            if (!data.plugins || data.plugins.length === 0) {
                container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Keine Plugins/Mods installiert</p>';
                return;
            }

            container.innerHTML = `
                <div style="display: grid; gap: 0.75rem;">
                    ${data.plugins.map(plugin => `
                        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <span style="font-size: 1.5rem;">📦</span>
                                <div>
                                    <div style="font-weight: 500;">${escapeHtml(plugin.name)}</div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">${formatBytes(plugin.size)}</div>
                                </div>
                            </div>
                            <button class="btn btn-danger" onclick="ServerDetails.uninstallPlugin('${escapeHtml(plugin.name)}')" style="padding: 0.5rem 1rem;">
                                Deinstallieren
                            </button>
                        </div>
                    `).join('')}
                </div>
            `;
        } catch (error) {
            container.innerHTML = `<p style="color: var(--error); text-align: center; padding: 2rem;">Fehler: ${error.message}</p>`;
        }
    }

    async function uninstallPlugin(filename) {
        if (!currentServer || !confirm(`Möchtest du ${filename} wirklich deinstallieren?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/plugins/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Deinstallation fehlgeschlagen');
            }

            showMessage(`${filename} wurde deinstalliert`, 'success');
            loadServerPlugins(currentServer.id);
        } catch (error) {
            showMessage(`Deinstallation fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    // File Explorer
    async function loadFiles(serverId, path = '') {
        const browser = document.getElementById('fileBrowser');
        const pathDisplay = document.getElementById('pathDisplay');
        const goUpBtn = document.getElementById('goUpDirectory');

        browser.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Lade Dateien...</div>';
        
        if (path) {
            pathDisplay.textContent = path;
            goUpBtn.style.display = 'block';
        } else {
            pathDisplay.textContent = 'Server Root';
            goUpBtn.style.display = 'none';
        }

        try {
            const response = await fetch(`${API_URL}/servers/${serverId}/files?path=${encodeURIComponent(path)}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Fehler beim Laden');
            }

            renderFiles(data.files, data.directories);
        } catch (error) {
            browser.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--error);">Fehler: ${error.message}</div>`;
        }
    }

    function renderFiles(files, directories) {
        const browser = document.getElementById('fileBrowser');

        if ((!files || files.length === 0) && (!directories || directories.length === 0)) {
            browser.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Keine Dateien vorhanden</div>';
            return;
        }

        let html = '<div style="display: flex; flex-direction: column;">';

        // Directories first
        if (directories && directories.length > 0) {
            directories.forEach(dir => {
                html += `
                    <div class="file-item" onclick="ServerDetails.navigateToDirectory('${escapeHtml(dir.name)}')" 
                         style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s;"
                         onmouseover="this.style.background='var(--bg-secondary)'" 
                         onmouseout="this.style.background='transparent'">
                        <span style="font-size: 1.5rem;">📁</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${escapeHtml(dir.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">Ordner</div>
                        </div>
                        <span style="color: var(--text-secondary); font-size: 0.875rem;">→</span>
                    </div>
                `;
            });
        }

        // Files
        if (files && files.length > 0) {
            files.forEach(file => {
                const icon = getFileIcon(file.name);
                const isEditable = isEditableFile(file.name);
                
                html += `
                    <div class="file-item" style="display: flex; align-items: center; gap: 1rem; padding: 0.75rem 1rem; border-bottom: 1px solid var(--border); transition: background 0.2s;"
                         onmouseover="this.style.background='var(--bg-secondary)'" 
                         onmouseout="this.style.background='transparent'">
                        <span style="font-size: 1.5rem;">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-weight: 500;">${escapeHtml(file.name)}</div>
                            <div style="font-size: 0.75rem; color: var(--text-secondary);">${formatBytes(file.size)} • ${new Date(file.modified).toLocaleString('de-DE')}</div>
                        </div>
                        ${isEditable ? `
                            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); ServerDetails.openFile('${escapeHtml(file.name)}')" style="padding: 0.375rem 0.75rem;">
                                📝 Bearbeiten
                            </button>
                        ` : ''}
                    </div>
                `;
            });
        }

        html += '</div>';
        browser.innerHTML = html;
    }

    function getFileIcon(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'properties': '⚙️',
            'json': '📋',
            'yml': '📄',
            'yaml': '📄',
            'txt': '📄',
            'log': '📜',
            'jar': '☕',
            'zip': '📦',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'dat': '💾',
            'mca': '🗺️',
            'toml': '📄',
            'conf': '⚙️',
            'cfg': '⚙️'
        };
        return iconMap[ext] || '📄';
    }

    function isEditableFile(filename) {
        const ext = filename.split('.').pop().toLowerCase();
        const editableExts = [
            'properties', 'json', 'yml', 'yaml', 'txt', 'log', 
            'toml', 'conf', 'cfg', 'ini', 'xml', 'md', 'sh', 
            'bat', 'ps1', 'gradle', 'kts', 'gitignore'
        ];
        
        // Special cases: files without extension
        const specialFiles = ['eula', 'dockerfile', 'readme', 'license', 'changelog'];
        const nameLower = filename.toLowerCase();
        if (specialFiles.some(name => nameLower.includes(name))) {
            return true;
        }
        
        return editableExts.includes(ext);
    }

    function navigateToDirectory(dirName) {
        if (!currentServer) return;
        currentPath = currentPath ? `${currentPath}/${dirName}` : dirName;
        loadFiles(currentServer.id, currentPath);
    }

    async function openFile(filename) {
        if (!currentServer) return;

        const fullPath = currentPath ? `${currentPath}/${filename}` : filename;
        const editorId = `editor-${++editorCounter}`;
        
        // Create editor window
        const container = document.getElementById('fileEditorContainer');
        const editorWindow = document.createElement('div');
        editorWindow.id = editorId;
        editorWindow.className = 'file-editor-window focused';
        editorWindow.style.top = `${50 + (editorCounter * 30)}px`;
        editorWindow.style.left = `${100 + (editorCounter * 30)}px`;
        
        editorWindow.innerHTML = `
            <div class="file-editor-header">
                <div>
                    <h3 style="margin: 0; font-size: 1rem;">${filename}</h3>
                    <p style="margin: 0.25rem 0 0 0; color: var(--text-secondary); font-size: 0.75rem; font-family: monospace;">${fullPath}</p>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="ServerDetails.closeEditor('${editorId}')" style="padding: 0.25rem 0.5rem;">✖</button>
            </div>
            <div class="file-editor-content">
                <textarea class="file-editor-textarea">Lade...</textarea>
            </div>
            <div class="file-editor-footer">
                <button class="btn btn-primary" onclick="ServerDetails.saveEditor('${editorId}')">💾 Speichern</button>
                <button class="btn btn-secondary" onclick="ServerDetails.closeEditor('${editorId}')">Abbrechen</button>
            </div>
        `;
        
        container.appendChild(editorWindow);
        
        // Store editor info
        openEditors.set(editorId, {
            serverId: currentServer.id,
            filePath: fullPath,
            element: editorWindow
        });
        
        // Make draggable
        makeDraggable(editorWindow);
        
        // Focus on click
        editorWindow.addEventListener('mousedown', () => focusEditor(editorId));
        
        // Load file content
        const textarea = editorWindow.querySelector('.file-editor-textarea');
        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/files/read?path=${encodeURIComponent(fullPath)}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                textarea.value = data.content || '';
            } else {
                textarea.value = `Fehler beim Laden: ${data.message}`;
            }
        } catch (error) {
            textarea.value = `Fehler beim Laden: ${error.message}`;
        }
        
        focusEditor(editorId);
    }

    function focusEditor(editorId) {
        // Remove focus from all editors
        document.querySelectorAll('.file-editor-window').forEach(win => {
            win.classList.remove('focused');
        });
        
        // Focus this editor
        const editor = openEditors.get(editorId);
        if (editor) {
            editor.element.classList.add('focused');
            editor.element.style.zIndex = ++highestZIndex;
        }
    }

    async function saveEditor(editorId) {
        const editor = openEditors.get(editorId);
        if (!editor) return;

        const textarea = editor.element.querySelector('.file-editor-textarea');
        const content = textarea.value;

        try {
            const response = await fetch(`${API_URL}/servers/${editor.serverId}/files/write`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    path: editor.filePath,
                    content: content
                })
            });

            const data = await response.json();
            if (data.success) {
                showMessage('Datei gespeichert!', 'success');
            } else {
                showMessage(data.message || 'Fehler beim Speichern', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Speichern der Datei', 'error');
        }
    }

    function closeEditor(editorId) {
        const editor = openEditors.get(editorId);
        if (editor) {
            editor.element.remove();
            openEditors.delete(editorId);
        }
    }

    function makeDraggable(element) {
        const header = element.querySelector('.file-editor-header');
        let isDragging = false;
        let currentX = 0;
        let currentY = 0;
        let initialX = 0;
        let initialY = 0;
        let rafId = null;

        header.addEventListener('mousedown', dragStart);

        function dragStart(e) {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) {
                return;
            }

            const rect = element.getBoundingClientRect();
            currentX = rect.left;
            currentY = rect.top;

            initialX = e.clientX - currentX;
            initialY = e.clientY - currentY;
            isDragging = true;

            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', dragEnd);
        }

        function drag(e) {
            if (isDragging) {
                e.preventDefault();
                
                const newX = e.clientX - initialX;
                const newY = e.clientY - initialY;

                // Use requestAnimationFrame for smooth dragging
                if (rafId) {
                    cancelAnimationFrame(rafId);
                }

                rafId = requestAnimationFrame(() => {
                    element.style.left = `${newX}px`;
                    element.style.top = `${newY}px`;
                    currentX = newX;
                    currentY = newY;
                });
            }
        }

        function dragEnd() {
            isDragging = false;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            document.removeEventListener('mousemove', drag);
            document.removeEventListener('mouseup', dragEnd);
        }
    }

    function closeModal() {
        const modal = document.getElementById('serverModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Helper functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function showMessage(message, type = 'info') {
        // Use modern Toast system if available
        if (window.Toast) {
            switch(type) {
                case 'success':
                    Toast.success(message);
                    break;
                case 'error':
                    Toast.error(message);
                    break;
                case 'warning':
                    Toast.warning(message);
                    break;
                default:
                    Toast.info(message);
            }
            return;
        }

        // Fallback to old system
        let statusEl = document.getElementById('serverDetailStatus');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'serverDetailStatus';
            statusEl.style.cssText = 'position: fixed; top: 20px; right: 20px; padding: 1rem 1.5rem; border-radius: 8px; z-index: 10000; font-weight: 500; box-shadow: 0 4px 6px rgba(0,0,0,0.3);';
            document.body.appendChild(statusEl);
        }

        const colors = {
            success: 'var(--success)',
            error: 'var(--error)',
            info: 'var(--primary)'
        };

        statusEl.textContent = message;
        statusEl.style.background = colors[type] || colors.info;
        statusEl.style.color = 'white';
        statusEl.style.display = 'block';

        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 4000);
    }

    // Get current server (for plugin manager)
    function getCurrentServer() {
        return currentServer;
    }

    // ==========================================
    // BACKUP MANAGEMENT
    // ==========================================

    async function loadBackups() {
        if (!currentServer) {
            return;
        }

        const backupsList = document.getElementById('backupsList');
        
        if (!backupsList) {
            return;
        }
        
        backupsList.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Lade Backups...</div>';

        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/backups`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            if (data.backups.length === 0) {
                backupsList.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">
                        <p style="font-size: 3rem; margin: 0;">💾</p>
                        <p style="margin: 0.5rem 0 0 0;">Keine Backups vorhanden</p>
                    </div>
                `;
                return;
            }

            backupsList.innerHTML = data.backups.map(backup => {
                const date = new Date(backup.timestamp);
                const formattedDate = date.toLocaleDateString('de-DE', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const size = formatFileSize(backup.size);

                return `
                    <div style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--text-primary);">📦 ${backup.name}</h4>
                            <div style="display: flex; gap: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
                                <span>🕐 ${formattedDate}</span>
                                <span>💾 ${size}</span>
                            </div>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="ServerDetails.downloadBackup('${backup.id}')" class="btn btn-secondary" title="Backup herunterladen">
                                ⬇️ Download
                            </button>
                            <button onclick="ServerDetails.restoreBackup('${backup.id}', '${backup.name}')" class="btn btn-primary" title="Backup wiederherstellen">
                                ♻️ Wiederherstellen
                            </button>
                            <button onclick="ServerDetails.deleteBackup('${backup.id}', '${backup.name}')" class="btn btn-danger" title="Backup löschen">
                                🗑️
                            </button>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            backupsList.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--danger-color); background: var(--bg-tertiary); border-radius: 8px;">
                    Fehler beim Laden der Backups: ${error.message}
                </div>
            `;
        }
    }

    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
    }

    async function createBackup() {
        if (!currentServer) return;

        const name = prompt('Backup Name (optional):');
        if (name === null) return; // User cancelled

        const createBtn = document.getElementById('createBackupBtn');
        const originalText = createBtn.innerHTML;
        createBtn.disabled = true;
        createBtn.innerHTML = '⏳ Erstelle Backup...';

        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/backup`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name: name || undefined })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            alert('✅ Backup erfolgreich erstellt!');
            await loadBackups();

        } catch (error) {
            alert('❌ Fehler beim Erstellen: ' + error.message);
        } finally {
            createBtn.disabled = false;
            createBtn.innerHTML = originalText;
        }
    }

    async function restoreBackup(backupId, backupName) {
        if (!currentServer) return;

        const confirmed = confirm(
            `⚠️ ACHTUNG: Das Wiederherstellen überschreibt alle aktuellen Server-Daten!\n\n` +
            `Backup: ${backupName}\n\n` +
            `Der Server wird gestoppt und alle Dateien werden ersetzt.\n` +
            `Möchtest du fortfahren?`
        );

        if (!confirmed) return;


        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/restore/${backupId}`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            alert('✅ Backup erfolgreich wiederhergestellt!');
            
            // Refresh server details
            setTimeout(() => {
                showServer(currentServer.id);
            }, 1000);

        } catch (error) {
            alert('❌ Fehler beim Wiederherstellen: ' + error.message);
        }
    }

    async function deleteBackup(backupId, backupName) {
        if (!currentServer) return;

        const confirmed = confirm(`Backup "${backupName}" wirklich löschen?`);
        if (!confirmed) return;

        try {
            const response = await fetch(`${API_URL}/servers/${currentServer.id}/backups/${backupId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            alert('✅ Backup gelöscht');
            await loadBackups();

        } catch (error) {
            alert('❌ Fehler beim Löschen: ' + error.message);
        }
    }

    function downloadBackup(backupId) {
        if (!currentServer) return;
        window.open(`${API_URL}/servers/${currentServer.id}/backups/${backupId}/download`, '_blank');
    }

    // Public API
    return {
        init,
        showServer,
        getCurrentServer,
        installPluginToServer,
        confirmPluginInstall,
        uninstallPlugin,
        navigateToDirectory,
        openFile,
        saveEditor,
        closeEditor,
        closeModal,
        clearConsole,
        sendCommand,
        sendQuickCommand,
        loadBackups,
        createBackup,
        restoreBackup,
        deleteBackup,
        downloadBackup
    };
})();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    ServerDetails.init();
});
