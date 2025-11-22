/**
 * Proxy Network Management (BungeeCord/Waterfall/Velocity)
 */

(function() {
    'use strict';

    const API_URL = window.location.origin + '/api';
    let currentServerId = null;
    let currentServerName = null;
    let currentEditingServer = null;
    let statusUpdateInterval = null;
    let currentView = 'list';

    /**
     * Initialize proxy management for a server
     */
    function initializeProxyManagement(serverId, serverName) {
        currentServerId = serverId;
        currentServerName = serverName || 'BungeeCord';
        loadBackendServers();
        loadProxySettings();
        renderQuickAddServer(); // Load quick add dropdown
        setupEventListeners();
        startStatusUpdates();
        setupWebSocketListeners();
        
        // Initialize topology if in topology view
        if (currentView === 'topology') {
            setTimeout(() => {
                if (typeof NetworkTopology !== 'undefined') {
                    NetworkTopology.initialize(currentServerId, currentServerName);
                }
            }, 100);
        }
    }

    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        const form = document.getElementById('backendServerForm');
        const settingsForm = document.getElementById('proxySettingsForm');
        const templateForm = document.getElementById('templateServerForm');

        if (form) {
            form.removeEventListener('submit', handleBackendServerSubmit);
            form.addEventListener('submit', handleBackendServerSubmit);
        }

        if (settingsForm) {
            settingsForm.removeEventListener('submit', handleProxySettingsSubmit);
            settingsForm.addEventListener('submit', handleProxySettingsSubmit);
        }

        if (templateForm) {
            templateForm.removeEventListener('submit', handleTemplateServerSubmit);
            templateForm.addEventListener('submit', handleTemplateServerSubmit);
        }
    }

    /**
     * Setup WebSocket listeners for real-time updates
     */
    function setupWebSocketListeners() {
        if (typeof io === 'undefined') return;

        const socket = io();

        socket.on('proxy-backend-status', (data) => {
            if (data.proxyId === currentServerId) {
                updateBackendServerStatus(data.backends);
            }
        });
    }

    /**
     * Start automatic status updates
     */
    function startStatusUpdates() {
        // Initial load
        loadBackendStatus();

        // Update every 30 seconds
        if (statusUpdateInterval) {
            clearInterval(statusUpdateInterval);
        }

        statusUpdateInterval = setInterval(() => {
            loadBackendStatus();
        }, 30000);
    }

    /**
     * Stop status updates
     */
    function stopStatusUpdates() {
        if (statusUpdateInterval) {
            clearInterval(statusUpdateInterval);
            statusUpdateInterval = null;
        }
    }

    /**
     * Load backend server status
     */
    async function loadBackendStatus() {
        if (!currentServerId) return;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                updateBackendServerStatus(data.backends);
            }
        } catch (error) {
        }
    }

    /**
     * Update backend server status in UI
     */
    function updateBackendServerStatus(backends) {
        backends.forEach(backend => {
            const card = document.querySelector(`[data-server-name="${backend.name}"]`);
            if (card) {
                // Update status indicator
                const statusEl = card.querySelector('.server-status');
                if (statusEl) {
                    statusEl.textContent = backend.online ? '🟢' : '🔴';
                    statusEl.title = backend.online ? 'Online' : 'Offline';
                }

                // Update player count
                const playerCountEl = card.querySelector('.server-players');
                if (playerCountEl) {
                    playerCountEl.textContent = `👥 ${backend.playerCount}/${backend.maxPlayers}`;
                }

                // Update TPS
                const tpsEl = card.querySelector('.server-tps');
                if (tpsEl && backend.tps > 0) {
                    tpsEl.textContent = `⚡ TPS: ${backend.tps.toFixed(1)}`;
                    tpsEl.style.color = backend.tps >= 19 ? 'var(--success-color)' : 
                                       backend.tps >= 15 ? 'var(--warning-color)' : 
                                       'var(--danger-color)';
                }

                // Update latency
                const latencyEl = card.querySelector('.server-latency');
                if (latencyEl && backend.latency > 0) {
                    latencyEl.textContent = `🌐 ${backend.latency}ms`;
                }
            }
        });
    }

    /**
     * Load backend servers from proxy config
     */
    async function loadBackendServers() {
        if (!currentServerId) return;

        const listContainer = document.getElementById('backendServerList');
        if (!listContainer) return;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/servers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                renderBackendServers(data.servers || []);
            } else {
                listContainer.innerHTML = `
                    <div style="padding: 2rem; text-align: center; color: var(--danger-color);">
                        ${data.message || 'Fehler beim Laden der Backend-Server'}
                    </div>
                `;
            }
        } catch (error) {
            listContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--danger-color);">
                    Fehler beim Laden der Backend-Server
                </div>
            `;
        }
    }

    /**
     * Load and render quick add server dropdown
     */
    async function renderQuickAddServer() {
        const container = document.getElementById('quickAddServerContainer');
        if (!container) return;

        // Always show the create & add form
        container.innerHTML = `
            <div style="padding: 1rem; background: var(--bg-secondary); border-radius: 8px; border: 1px solid var(--border);">
                <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem;">
                    <span style="font-size: 1.5rem;">🛠️</span>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.25rem 0;">Neuen Server erstellen & hinzufügen</h4>
                        <p style="margin: 0; font-size: 0.9rem; color: var(--text-secondary);">Erstelle einen neuen Backend-Server und füge ihn automatisch zum Proxy hinzu</p>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr auto; gap: 0.5rem; align-items: end;">
                    <div>
                        <label style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Server Name</label>
                        <input type="text" id="newServerName" placeholder="z.B. Survival" style="width: 100%; padding: 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary);">
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Server Typ</label>
                        <select id="newServerType" onchange="loadServerVersions()" style="width: 100%; padding: 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary);">
                            <option value="paper">Paper</option>
                            <option value="vanilla">Vanilla</option>
                            <option value="fabric">Fabric</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Version</label>
                        <select id="newServerVersion" style="width: 100%; padding: 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary);">
                            <option value="">Lädt...</option>
                        </select>
                    </div>
                    <div>
                        <label style="display: block; font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.25rem;">Port</label>
                        <input type="number" id="newServerPort" value="25566" min="25566" max="65535" style="width: 100%; padding: 0.5rem; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary);">
                    </div>
                    <button class="btn btn-primary" onclick="createAndAddServer()" style="white-space: nowrap; padding: 0.5rem 1rem;">
                        ➕ Erstellen & Hinzufügen
                    </button>
                </div>
            </div>
        `;

        // Load initial versions for Paper
        loadServerVersions();
    }

    /**
     * Load available versions for selected server type
     */
    async function loadServerVersions() {
        const typeSelect = document.getElementById('newServerType');
        const versionSelect = document.getElementById('newServerVersion');
        
        if (!typeSelect || !versionSelect) return;

        const type = typeSelect.value;
        versionSelect.innerHTML = '<option value="">Lädt...</option>';

        try {
            const response = await fetch(`${API_URL}/versions/${type}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.success && data.versions && data.versions.length > 0) {
                versionSelect.innerHTML = data.versions.map((version, index) => 
                    `<option value="${version}">${version}${index === 0 ? ' (Neueste)' : ''}</option>`
                ).join('');
            } else {
                versionSelect.innerHTML = '<option value="">Keine Versionen verfügbar</option>';
            }
        } catch (error) {
            console.error('Error loading versions:', error);
            versionSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
        }
    }

    /**
     * Quick add selected server (deprecated - not used anymore)
     */
    async function quickAddServer() {
        const select = document.getElementById('quickAddServerSelect');
        if (!select || !select.value) {
            if (typeof Toast !== 'undefined') {
                Toast.warning('Bitte wähle einen Server aus');
            }
            return;
        }

        const serverId = select.value;

        try {
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/add-server`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ serverId })
            });

            const data = await response.json();

            if (data.success) {
                if (typeof Toast !== 'undefined') {
                    Toast.success(data.message);
                }
                // Reload backend servers and quick add
                loadBackendServers();
                renderQuickAddServer();
            } else {
                if (typeof Toast !== 'undefined') {
                    Toast.error(data.message);
                }
            }
        } catch (error) {
            console.error('Error adding server:', error);
            if (typeof Toast !== 'undefined') {
                Toast.error('Fehler beim Hinzufügen des Servers');
            }
        }
    }

    /**
     * Create new server and add to proxy
     */
    async function createAndAddServer() {
        const nameInput = document.getElementById('newServerName');
        const typeSelect = document.getElementById('newServerType');
        const versionSelect = document.getElementById('newServerVersion');
        const portInput = document.getElementById('newServerPort');

        const name = nameInput?.value?.trim();
        const type = typeSelect?.value;
        const version = versionSelect?.value;
        const port = parseInt(portInput?.value);

        if (!name) {
            if (typeof Toast !== 'undefined') {
                Toast.warning('Bitte gib einen Server-Namen ein');
            }
            return;
        }

        if (!version) {
            if (typeof Toast !== 'undefined') {
                Toast.warning('Bitte wähle eine Version aus');
            }
            return;
        }

        if (!port || port < 1024 || port > 65535) {
            if (typeof Toast !== 'undefined') {
                Toast.warning('Bitte gib einen gültigen Port (1024-65535) ein');
            }
            return;
        }

        try {
            if (typeof Toast !== 'undefined') {
                Toast.info('Server wird erstellt und heruntergeladen...');
            }

            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/create-and-add`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ name, type, version, port })
            });

            const data = await response.json();

            if (data.success) {
                if (typeof Toast !== 'undefined') {
                    Toast.success(data.message);
                }
                // Clear inputs
                nameInput.value = '';
                portInput.value = parseInt(portInput.value) + 1;
                
                // Reload backend servers and quick add
                loadBackendServers();
                renderQuickAddServer();
            } else {
                if (typeof Toast !== 'undefined') {
                    Toast.error(data.message);
                }
            }
        } catch (error) {
            console.error('Error creating and adding server:', error);
            if (typeof Toast !== 'undefined') {
                Toast.error('Fehler beim Erstellen des Servers');
            }
        }
    }

    /**
     * Render backend servers list
     */
    function renderBackendServers(servers) {
        const listContainer = document.getElementById('backendServerList');
        if (!listContainer) return;

        if (servers.length === 0) {
            listContainer.innerHTML = `
                <div style="padding: 2rem; text-align: center; color: var(--text-secondary);">
                    <p>Keine Backend-Server konfiguriert</p>
                    <p style="font-size: 0.9rem; margin-top: 0.5rem;">Füge Backend-Server hinzu, um dein Netzwerk aufzubauen</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = servers.map(server => `
            <div class="backend-server-card" data-server-name="${server.name}" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; border: 1px solid var(--border); margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                            <span class="server-status">🔴</span>
                            <h4 style="margin: 0; font-size: 1.1rem;">${server.name}</h4>
                            ${server.restricted ? '<span style="background: var(--warning-color); color: white; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">RESTRICTED</span>' : ''}
                        </div>
                        <p style="margin: 0.25rem 0; color: var(--text-secondary); font-size: 0.9rem;">
                            📍 ${server.address}
                        </p>
                        ${server.motd ? `<p style="margin: 0.25rem 0; color: var(--text-muted); font-size: 0.85rem;">${server.motd}</p>` : ''}
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
                            <span class="server-players">👥 -/-</span>
                            <span class="server-tps" style="display: none;">⚡ TPS: -</span>
                            <span class="server-latency" style="display: none;">🌐 -ms</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary btn-sm" onclick="setDefaultBackendServer('${server.name}')" title="Als Standard setzen">
                            ⭐
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="editBackendServer('${server.name}')" title="Bearbeiten">
                            ✏️
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteBackendServer('${server.name}')" title="Löschen">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        // Load status after rendering
        setTimeout(() => loadBackendStatus(), 500);
    }

    /**
     * Load proxy settings
     */
    async function loadProxySettings() {
        if (!currentServerId) return;

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/settings`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success && data.settings) {
                document.getElementById('proxyMotd').value = data.settings.motd || '';
                document.getElementById('proxyMaxPlayers').value = data.settings.maxPlayers || 100;
                document.getElementById('proxyForceDefault').checked = data.settings.forceDefaultServer || false;
            }
        } catch (error) {
        }
    }

    /**
     * Show add backend server modal
     */
    function showAddBackendServerModal() {
        currentEditingServer = null;
        document.getElementById('backendServerModalTitle').textContent = 'Backend-Server hinzufügen';
        document.getElementById('backendServerForm').reset();
        document.getElementById('backendServerModal').classList.add('active');
    }

    /**
     * Show edit backend server modal
     */
    async function editBackendServer(serverName) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/servers`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                const server = data.servers.find(s => s.name === serverName);
                if (server) {
                    currentEditingServer = serverName;
                    document.getElementById('backendServerModalTitle').textContent = 'Backend-Server bearbeiten';
                    document.getElementById('backendServerName').value = server.name;
                    document.getElementById('backendServerAddress').value = server.address;
                    document.getElementById('backendServerMotd').value = server.motd || '';
                    document.getElementById('backendServerRestricted').checked = server.restricted || false;
                    document.getElementById('backendServerModal').classList.add('active');
                }
            }
        } catch (error) {
            alert('Fehler beim Laden des Servers');
        }
    }

    /**
     * Close backend server modal
     */
    function closeBackendServerModal() {
        document.getElementById('backendServerModal').classList.remove('active');
        currentEditingServer = null;
    }

    /**
     * Show template server modal
     */
    async function showTemplateServerModal() {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/proxy/templates`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                renderTemplates(data.templates);
                document.getElementById('templateServerModal').classList.add('active');
            }
        } catch (error) {
            alert('Fehler beim Laden der Vorlagen');
        }
    }

    /**
     * Close template server modal
     */
    function closeTemplateServerModal() {
        document.getElementById('templateServerModal').classList.remove('active');
        document.getElementById('templateDetailsForm').style.display = 'none';
        document.getElementById('templateServerForm').reset();
    }

    /**
     * Render templates
     */
    function renderTemplates(templates) {
        const container = document.getElementById('templatesList');
        
        container.innerHTML = templates.map(template => `
            <div class="template-card" onclick="selectTemplate('${template.id}')" style="background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px; border: 2px solid var(--border); cursor: pointer; transition: all 0.2s;">
                <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">${template.icon}</div>
                <h4 style="margin: 0 0 0.5rem 0; text-align: center;">${template.name}</h4>
                <p style="margin: 0; font-size: 0.85rem; color: var(--text-secondary); text-align: center;">${template.description}</p>
                <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); font-size: 0.8rem; color: var(--text-muted); text-align: center;">
                    ${template.type.toUpperCase()} • ${template.memory}
                </div>
            </div>
        `).join('');

        // Add hover effect with CSS
        const style = document.createElement('style');
        style.textContent = `.template-card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }`;
        document.head.appendChild(style);
    }

    /**
     * Select template
     */
    function selectTemplate(templateId) {
        document.getElementById('selectedTemplateId').value = templateId;
        document.getElementById('templateDetailsForm').style.display = 'block';
        
        // Scroll to form
        document.getElementById('templateDetailsForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /**
     * Handle template server form submit
     */
    async function handleTemplateServerSubmit(e) {
        e.preventDefault();

        const formData = {
            templateId: document.getElementById('selectedTemplateId').value,
            serverName: document.getElementById('templateServerName').value,
            customSettings: {
                memory: document.getElementById('templateMemory').value,
                proxyName: document.getElementById('templateProxyName').value
            }
        };

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/servers/from-template`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert(`Server "${data.server.name}" erfolgreich erstellt!\n\nDer Server ist jetzt als "${data.proxyName}" im Proxy verfügbar.\n\nTemplate: ${data.template}`);
                closeTemplateServerModal();
                await loadBackendServers();
            } else {
                alert(data.message || 'Fehler beim Erstellen des Servers');
            }
        } catch (error) {
            alert('Fehler beim Erstellen des Servers');
        }
    }

    /**
     * Switch network view (list/topology)
     */
    function switchNetworkView(view) {
        currentView = view;

        // Update tab buttons
        document.querySelectorAll('.network-view-tab').forEach(tab => {
            const tabView = tab.getAttribute('data-view');
            if (tabView === view) {
                tab.classList.add('active');
                tab.style.borderBottomColor = 'var(--primary)';
                tab.style.color = 'var(--primary)';
            } else {
                tab.classList.remove('active');
                tab.style.borderBottomColor = 'transparent';
                tab.style.color = 'var(--text-secondary)';
            }
        });

        // Update view visibility
        document.getElementById('network-list-view').style.display = view === 'list' ? 'block' : 'none';
        document.getElementById('network-topology-view').style.display = view === 'topology' ? 'block' : 'none';

        // Initialize topology if switching to it
        if (view === 'topology' && typeof NetworkTopology !== 'undefined') {
            setTimeout(() => {
                NetworkTopology.initialize(currentServerId, currentServerName);
            }, 100);
        } else if (view === 'list' && typeof NetworkTopology !== 'undefined') {
            NetworkTopology.cleanup();
        }
    }

    /**
     * Handle backend server form submit
     */
    async function handleBackendServerSubmit(e) {
        e.preventDefault();

        const formData = {
            name: document.getElementById('backendServerName').value,
            address: document.getElementById('backendServerAddress').value,
            motd: document.getElementById('backendServerMotd').value,
            restricted: document.getElementById('backendServerRestricted').checked,
            default: document.getElementById('backendServerDefault').checked
        };

        try {
            const token = localStorage.getItem('auth_token');
            const url = currentEditingServer 
                ? `${API_URL}/servers/${currentServerId}/proxy/servers/${currentEditingServer}`
                : `${API_URL}/servers/${currentServerId}/proxy/servers`;
            const method = currentEditingServer ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message || 'Backend-Server erfolgreich gespeichert');
                closeBackendServerModal();
                await loadBackendServers();
            } else {
                alert(data.message || 'Fehler beim Speichern');
            }
        } catch (error) {
            alert('Fehler beim Speichern des Backend-Servers');
        }
    }

    /**
     * Delete backend server
     */
    async function deleteBackendServer(serverName) {
        if (!confirm(`Backend-Server '${serverName}' wirklich löschen?`)) {
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/servers/${serverName}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message || 'Backend-Server erfolgreich gelöscht');
                await loadBackendServers();
            } else {
                alert(data.message || 'Fehler beim Löschen');
            }
        } catch (error) {
            alert('Fehler beim Löschen des Backend-Servers');
        }
    }

    /**
     * Set default backend server
     */
    async function setDefaultBackendServer(serverName) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/servers/${serverName}/default`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (data.success) {
                alert(data.message || 'Standard-Server gesetzt');
                await loadBackendServers();
            } else {
                alert(data.message || 'Fehler beim Setzen des Standard-Servers');
            }
        } catch (error) {
            alert('Fehler beim Setzen des Standard-Servers');
        }
    }

    /**
     * Handle proxy settings form submit
     */
    async function handleProxySettingsSubmit(e) {
        e.preventDefault();

        const settings = {
            motd: document.getElementById('proxyMotd').value,
            maxPlayers: parseInt(document.getElementById('proxyMaxPlayers').value, 10),
            forceDefaultServer: document.getElementById('proxyForceDefault').checked
        };

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${currentServerId}/proxy/settings`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            const data = await response.json();

            if (data.success) {
                alert('Proxy-Einstellungen erfolgreich gespeichert');
            } else {
                alert(data.message || 'Fehler beim Speichern');
            }
        } catch (error) {
            alert('Fehler beim Speichern der Proxy-Einstellungen');
        }
    }

    // Export functions to global scope
    window.initializeProxyManagement = initializeProxyManagement;
    window.showAddBackendServerModal = showAddBackendServerModal;
    window.closeBackendServerModal = closeBackendServerModal;
    window.editBackendServer = editBackendServer;
    window.deleteBackendServer = deleteBackendServer;
    window.setDefaultBackendServer = setDefaultBackendServer;
    window.stopProxyStatusUpdates = stopStatusUpdates;
    window.showTemplateServerModal = showTemplateServerModal;
    window.closeTemplateServerModal = closeTemplateServerModal;
    window.selectTemplate = selectTemplate;
    window.switchNetworkView = switchNetworkView;
    window.quickAddServer = quickAddServer;
    window.createAndAddServer = createAndAddServer;
    window.loadServerVersions = loadServerVersions;

})();
