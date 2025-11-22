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
                console.log('[ProxyStatus] Loaded backend status:', data.backends);
                updateBackendServerStatus(data.backends);
            } else {
                console.error('[ProxyStatus] Failed to load:', data.message);
            }
        } catch (error) {
            console.error('[ProxyStatus] Error loading status:', error);
        }
    }

    /**
     * Update backend server status in UI
     */
    function updateBackendServerStatus(backends) {
        console.log('[ProxyStatus] Updating UI with backends:', backends);
        
        backends.forEach(backend => {
            const card = document.querySelector(`[data-server-name="${backend.name}"]`);
            console.log(`[ProxyStatus] Looking for card with name: ${backend.name}`, card ? 'Found' : 'Not found');
            
            if (card) {
                // Update status indicator
                const statusEl = card.querySelector('.server-status');
                if (statusEl) {
                    statusEl.textContent = backend.online ? '🟢' : '🔴';
                    statusEl.title = backend.online ? 'Online' : 'Offline';
                    console.log(`[ProxyStatus] Updated ${backend.name} status:`, backend.online ? 'Online' : 'Offline');
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

    /**
     * Switch tabs in backend server modal
     */
    function switchBackendModalTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.backend-modal-tab').forEach(btn => {
            if (btn.dataset.tab === tabName) {
                btn.style.borderBottom = '3px solid var(--primary)';
                btn.style.color = 'var(--primary)';
            } else {
                btn.style.borderBottom = '3px solid transparent';
                btn.style.color = 'var(--text-secondary)';
            }
        });

        // Update tab content
        document.querySelectorAll('.backend-modal-tab-content').forEach(content => {
            content.style.display = 'none';
        });

        const targetTab = document.getElementById(`backend-${tabName}-tab`);
        if (targetTab) {
            targetTab.style.display = 'block';
        }

        // Load data if needed
        if (currentEditingServer) {
            if (tabName === 'gamerules') {
                loadBackendGamerules(currentEditingServer);
            } else if (tabName === 'worldborder') {
                loadBackendWorldBorder(currentEditingServer);
            }
        }
    }

    /**
     * Load gamerules for backend server
     */
    async function loadBackendGamerules(serverName) {
        const container = document.getElementById('backend-gamerules-list');
        
        if (!serverName) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">Wähle einen Backend-Server zum Bearbeiten aus</div>';
            return;
        }

        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Lade Gamerules...</div>';

        try {
            // Parse server address to get the actual server ID
            const backendAddress = document.getElementById('backendServerAddress').value;
            const [host, port] = backendAddress.split(':');
            
            // Try to find the corresponding managed server
            const token = localStorage.getItem('auth_token');
            const serversResponse = await fetch(`${API_URL}/servers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const serversData = await serversResponse.json();
            
            // Find server by port
            const matchingServer = serversData.servers?.find(s => s.port === parseInt(port));
            
            if (!matchingServer) {
                container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">Backend-Server nicht als verwalteter Server gefunden. Gamerules können nur für Server in der Server-Liste verwaltet werden.</div>';
                return;
            }

            // Load gamerules from the actual server
            const response = await fetch(`${API_URL}/servers/${matchingServer.id}/world/gamerules`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success && data.gamerules) {
                renderBackendGamerules(data.gamerules, matchingServer.id);
            } else {
                container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">${data.message || 'Konnte Gamerules nicht laden'}</div>`;
            }
        } catch (error) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--danger); background: var(--bg-tertiary); border-radius: 8px;">Fehler beim Laden der Gamerules</div>';
        }
    }

    /**
     * Render backend server gamerules
     */
    function renderBackendGamerules(gamerules, serverId) {
        const container = document.getElementById('backend-gamerules-list');
        
        const html = `
            <div style="display: grid; gap: 1rem;">
                ${Object.entries(gamerules).map(([rule, value]) => `
                    <div class="gamerule-item" data-rule="${rule}" style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong style="color: var(--text-primary);">${rule}</strong>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                                ${getGameruleDescription(rule)}
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                            ${typeof value === 'boolean' 
                                ? `<label style="display: flex; align-items: center; gap: 0.5rem;">
                                       <input type="checkbox" ${value ? 'checked' : ''} onchange="setBackendGamerule('${serverId}', '${rule}', this.checked)">
                                       <span style="font-size: 0.9rem;">${value ? 'An' : 'Aus'}</span>
                                   </label>`
                                : `<input type="number" value="${value}" style="width: 100px; padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-secondary);" onchange="setBackendGamerule('${serverId}', '${rule}', this.value)">`
                            }
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        
        container.innerHTML = html;
    }

    /**
     * Get gamerule description
     */
    function getGameruleDescription(rule) {
        const descriptions = {
            'announceAdvancements': 'Zeigt Fortschritte im Chat an',
            'commandBlockOutput': 'Zeigt Command Block Ausgaben an',
            'disableElytraMovementCheck': 'Deaktiviert Elytra-Bewegungsprüfung',
            'doDaylightCycle': 'Tag/Nacht-Zyklus',
            'doEntityDrops': 'Entities droppen Items',
            'doFireTick': 'Feuer breitet sich aus',
            'doImmediateRespawn': 'Sofortiges Respawnen',
            'doInsomnia': 'Phantome spawnen',
            'doLimitedCrafting': 'Nur freigeschaltete Rezepte',
            'doMobLoot': 'Mobs droppen Loot',
            'doMobSpawning': 'Mobs spawnen',
            'doPatrolSpawning': 'Patrouillen spawnen',
            'doTileDrops': 'Blöcke droppen Items',
            'doTraderSpawning': 'Wandernde Händler spawnen',
            'doWeatherCycle': 'Wetter ändert sich',
            'drowningDamage': 'Ertrinken verursacht Schaden',
            'fallDamage': 'Fallschaden',
            'fireDamage': 'Feuerschaden',
            'forgiveDeadPlayers': 'Mobs vergessen tote Spieler',
            'freezeDamage': 'Gefrierschaden',
            'keepInventory': 'Inventar behalten beim Tod',
            'logAdminCommands': 'Admin-Befehle loggen',
            'maxCommandChainLength': 'Max. Command Chain Länge',
            'maxEntityCramming': 'Max. Entity Cramming',
            'mobGriefing': 'Mobs können Blöcke zerstören',
            'naturalRegeneration': 'Natürliche Regeneration',
            'playersSleepingPercentage': 'Prozent schlafender Spieler für Nacht-Skip',
            'randomTickSpeed': 'Random Tick Speed',
            'reducedDebugInfo': 'Reduzierte Debug-Infos',
            'sendCommandFeedback': 'Befehlsfeedback anzeigen',
            'showDeathMessages': 'Todesnachrichten anzeigen',
            'spawnRadius': 'Spawn-Radius',
            'spectatorsGenerateChunks': 'Zuschauer generieren Chunks',
            'universalAnger': 'Universelle Wut (Piglin etc.)'
        };
        return descriptions[rule] || 'Keine Beschreibung verfügbar';
    }

    /**
     * Set backend server gamerule
     */
    async function setBackendGamerule(serverId, rule, value) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${serverId}/world/gamerules`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ rule, value })
            });

            const data = await response.json();
            if (data.success) {
                console.log(`Gamerule ${rule} erfolgreich gesetzt`);
            } else {
                alert(data.message || 'Fehler beim Setzen der Gamerule');
            }
        } catch (error) {
            alert('Fehler beim Setzen der Gamerule');
        }
    }

    /**
     * Filter gamerules
     */
    function filterBackendGamerules() {
        const search = document.getElementById('backendGameruleSearch').value.toLowerCase();
        const items = document.querySelectorAll('.gamerule-item');
        
        items.forEach(item => {
            const rule = item.dataset.rule.toLowerCase();
            item.style.display = rule.includes(search) ? 'flex' : 'none';
        });
    }

    /**
     * Load world border for backend server
     */
    async function loadBackendWorldBorder(serverName) {
        const container = document.getElementById('backend-world-border-config');
        
        if (!serverName) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">Wähle einen Backend-Server zum Bearbeiten aus</div>';
            return;
        }

        container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary);">Lade World Border...</div>';

        try {
            const backendAddress = document.getElementById('backendServerAddress').value;
            const [host, port] = backendAddress.split(':');
            
            const token = localStorage.getItem('auth_token');
            const serversResponse = await fetch(`${API_URL}/servers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const serversData = await serversResponse.json();
            
            const matchingServer = serversData.servers?.find(s => s.port === parseInt(port));
            
            if (!matchingServer) {
                container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">Backend-Server nicht als verwalteter Server gefunden.</div>';
                return;
            }

            const response = await fetch(`${API_URL}/servers/${matchingServer.id}/world/border`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();

            if (data.success) {
                renderBackendWorldBorder(data.border, matchingServer.id);
            } else {
                container.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-secondary); background: var(--bg-tertiary); border-radius: 8px;">${data.message || 'Konnte World Border nicht laden'}</div>`;
            }
        } catch (error) {
            container.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--danger); background: var(--bg-tertiary); border-radius: 8px;">Fehler beim Laden der World Border</div>';
        }
    }

    /**
     * Render backend world border
     */
    function renderBackendWorldBorder(border, serverId) {
        const container = document.getElementById('backend-world-border-config');
        
        const html = `
            <form onsubmit="setBackendWorldBorder(event, '${serverId}')" style="display: grid; gap: 1rem; background: var(--bg-tertiary); padding: 1.5rem; border-radius: 8px;">
                <div class="form-group">
                    <label>Aktuelle Größe: <strong>${border.size || 'Unbekannt'}</strong> Blöcke</label>
                </div>
                <div class="form-group">
                    <label for="backendBorderSize">Neue Größe (Blöcke):</label>
                    <input type="number" id="backendBorderSize" value="${border.size || 59999968}" min="1" max="59999968" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary);">
                    <small class="help-text">Standard: 59999968 Blöcke (Maximum)</small>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label for="backendBorderCenterX">Zentrum X:</label>
                        <input type="number" id="backendBorderCenterX" value="${border.centerX || 0}" step="0.1" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary);">
                    </div>
                    <div class="form-group">
                        <label for="backendBorderCenterZ">Zentrum Z:</label>
                        <input type="number" id="backendBorderCenterZ" value="${border.centerZ || 0}" step="0.1" style="width: 100%; padding: 0.75rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary);">
                    </div>
                </div>
                <button type="submit" class="btn btn-primary" style="width: 100%;">🌐 World Border setzen</button>
            </form>
        `;
        
        container.innerHTML = html;
    }

    /**
     * Set backend world border
     */
    async function setBackendWorldBorder(event, serverId) {
        event.preventDefault();
        
        const size = parseInt(document.getElementById('backendBorderSize').value);
        const centerX = parseFloat(document.getElementById('backendBorderCenterX').value);
        const centerZ = parseFloat(document.getElementById('backendBorderCenterZ').value);
        
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${API_URL}/servers/${serverId}/world/border`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ size, centerX, centerZ })
            });

            const data = await response.json();
            if (data.success) {
                alert('World Border erfolgreich gesetzt!');
            } else {
                alert(data.message || 'Fehler beim Setzen der World Border');
            }
        } catch (error) {
            alert('Fehler beim Setzen der World Border');
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
    window.switchBackendModalTab = switchBackendModalTab;
    window.filterBackendGamerules = filterBackendGamerules;
    window.loadBackendGamerules = loadBackendGamerules;
    window.loadBackendWorldBorder = loadBackendWorldBorder;
    window.setBackendGamerule = setBackendGamerule;
    window.setBackendWorldBorder = setBackendWorldBorder;

})();
