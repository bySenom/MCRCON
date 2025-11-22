/**
 * Plugin/Mod Management UI
 */

const PluginManager = (function() {
    const API_URL = 'http://localhost:3000/api';
    
    let selectedServer = null;

    // Helper to get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Initialize plugin manager
    function init() {
        setupEventListeners();
        loadServerList();
    }

    function setupEventListeners() {
        const searchBtn = document.getElementById('searchPluginsBtn');
        const searchInput = document.getElementById('pluginSearch');
        const serverSelect = document.getElementById('pluginServerSelect');
        const refreshBtn = document.getElementById('refreshPluginsBtn');

        if (searchBtn) {
            searchBtn.addEventListener('click', searchPlugins);
        }

        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    searchPlugins();
                }
            });
        }

        if (serverSelect) {
            serverSelect.addEventListener('change', (e) => {
                selectedServer = e.target.value;
                if (selectedServer) {
                    loadInstalledPlugins(selectedServer);
                }
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (selectedServer) {
                    loadInstalledPlugins(selectedServer);
                }
            });
        }
    }

    // Load server list for plugin installation
    async function loadServerList() {
        try {
            const response = await fetch(`${API_URL}/servers`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            const serverSelect = document.getElementById('pluginServerSelect');
            if (!serverSelect) return;

            serverSelect.innerHTML = '<option value="">Server wählen...</option>';
            
            if (data.servers && data.servers.length > 0) {
                data.servers.forEach(server => {
                    const option = document.createElement('option');
                    option.value = server.id;
                    option.textContent = `${server.name} (${server.type})`;
                    serverSelect.appendChild(option);
                });
            }
        } catch (error) {
        }
    }

    // Search for plugins
    async function searchPlugins() {
        const query = document.getElementById('pluginSearch').value.trim();
        const source = document.getElementById('pluginSource').value;
        const loaderType = document.getElementById('pluginLoaderType').value;
        const mcVersion = document.getElementById('pluginMcVersion').value.trim();
        const resultsContainer = document.getElementById('pluginResults');

        if (!query) {
            showMessage('Bitte gib einen Suchbegriff ein', 'error');
            return;
        }

        resultsContainer.innerHTML = '<div class="loading" style="grid-column: 1 / -1; text-align: center;">Suche läuft...</div>';

        try {
            const params = new URLSearchParams({ q: query });
            if (source) params.append('source', source);
            if (loaderType) params.append('type', loaderType);
            if (mcVersion) params.append('version', mcVersion);

            const response = await fetch(`${API_URL}/plugins/search?${params}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Suche fehlgeschlagen');
            }

            renderPluginResults(data.results);
        } catch (error) {
            resultsContainer.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--error);">Fehler bei der Suche: ${error.message}</div>`;
        }
    }

    // Render search results
    function renderPluginResults(plugins) {
        const resultsContainer = document.getElementById('pluginResults');

        if (!plugins || plugins.length === 0) {
            resultsContainer.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-secondary);">Keine Ergebnisse gefunden</div>';
            return;
        }

        resultsContainer.innerHTML = plugins.map(plugin => `
            <div class="plugin-card" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; transition: transform 0.2s;">
                <div style="display: flex; align-items: start; gap: 1rem; margin-bottom: 1rem;">
                    ${plugin.icon ? `<img src="${plugin.icon}" alt="${plugin.name}" style="width: 48px; height: 48px; border-radius: 8px;">` : '<div style="width: 48px; height: 48px; background: var(--primary); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">📦</div>'}
                    <div style="flex: 1; min-width: 0;">
                        <h3 style="margin: 0 0 0.25rem 0; font-size: 1.125rem;">${plugin.name}</h3>
                        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
                            <span style="background: var(--primary); color: white; padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${plugin.source}</span>
                            ${plugin.categories ? plugin.categories.slice(0, 2).map(cat => `<span style="background: var(--bg-tertiary); padding: 0.125rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${cat}</span>`).join('') : ''}
                        </div>
                    </div>
                </div>
                
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0 0 1rem 0; line-height: 1.5;">${plugin.description || 'Keine Beschreibung verfügbar'}</p>
                
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; font-size: 0.875rem; color: var(--text-secondary);">
                    ${plugin.downloads ? `<span>⬇️ ${formatNumber(plugin.downloads)}</span>` : ''}
                    ${plugin.author ? `<span>👤 ${plugin.author}</span>` : ''}
                </div>
                
                <button class="btn btn-primary" onclick="PluginManager.showInstallModal('${plugin.id}', '${plugin.source}', '${escapeHtml(plugin.name)}')" style="width: 100%;">
                    Installieren
                </button>
            </div>
        `).join('');
    }

    // Get current server for installation
    function getCurrentServerForInstall() {
        // First check if server is selected in plugin tab
        if (selectedServer) {
            return selectedServer;
        }
        // Otherwise check if a server is open in ServerDetails
        if (typeof ServerDetails !== 'undefined') {
            const current = ServerDetails.getCurrentServer();
            if (current && current.id) {
                return current.id;
            }
        }
        return null;
    }

    // Show install modal with version selection
    async function showInstallModal(pluginId, source, pluginName) {
        const serverId = getCurrentServerForInstall();
        if (!serverId) {
            showMessage('Bitte wähle zuerst einen Server aus', 'error');
            return;
        }

        const modal = document.getElementById('serverModal');
        const modalTitle = document.getElementById('modalTitle');
        const modalBody = document.getElementById('modalBody');

        modalTitle.textContent = `${pluginName} installieren`;
        modalBody.innerHTML = '<div class="loading">Lade Versionen...</div>';
        modal.style.display = 'flex';

        try {
            const mcVersion = document.getElementById('pluginMcVersion').value.trim();
            const params = mcVersion ? `?mcVersion=${mcVersion}` : '';
            
            const response = await fetch(`${API_URL}/plugins/${source}/${pluginId}/versions${params}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (!data.success || !data.versions || data.versions.length === 0) {
                modalBody.innerHTML = '<p style="color: var(--error);">Keine Versionen gefunden</p>';
                return;
            }

            // Process versions - extract first file from files array for Modrinth
            const processedVersions = data.versions.map(v => {
                if (v.files && v.files.length > 0) {
                    // Modrinth format - has files array
                    const primaryFile = v.files.find(f => f.primary) || v.files[0];
                    return {
                        name: v.name || v.version,
                        version: v.version,
                        mcVersions: v.mcVersions || v.game_versions || [],
                        url: primaryFile.url,
                        filename: primaryFile.filename
                    };
                } else {
                    // Spigot format - direct url/filename
                    return {
                        name: v.name,
                        url: v.url || v.downloadUrl,
                        filename: v.filename || `plugin-${v.id}.jar`
                    };
                }
            });

            modalBody.innerHTML = `
                <div style="margin-bottom: 1rem;">
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text-primary);">Version wählen:</label>
                    <select id="versionSelect" style="width: 100%; padding: 0.75rem; background: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px; font-size: 0.95rem;">
                        ${processedVersions.map((v, i) => `
                            <option value="${i}" data-url="${v.url || ''}" data-filename="${v.filename || ''}" style="background: var(--bg-secondary); color: var(--text-primary);">
                                ${v.name || v.version || v.filename} ${v.mcVersions && v.mcVersions.length > 0 ? `(MC ${v.mcVersions.join(', ')})` : ''}
                            </option>
                        `).join('')}
                    </select>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <button class="btn btn-primary" onclick="PluginManager.installPlugin()">
                        Installieren
                    </button>
                    <button class="btn btn-secondary" onclick="PluginManager.closeModal()">
                        Abbrechen
                    </button>
                </div>
            `;
        } catch (error) {
            modalBody.innerHTML = `<p style="color: var(--error);">Fehler beim Laden der Versionen: ${error.message}</p>`;
        }
    }

    // Install selected plugin version
    async function installPlugin() {
        const serverId = getCurrentServerForInstall();
        const versionSelect = document.getElementById('versionSelect');
        if (!versionSelect || !serverId) {
            return;
        }

        const selectedOption = versionSelect.options[versionSelect.selectedIndex];
        const url = selectedOption.getAttribute('data-url');
        const filename = selectedOption.getAttribute('data-filename');


        if (!url || !filename) {
            showMessage('Ungültige Version ausgewählt', 'error');
            return;
        }

        try {
            showMessage('Installation läuft...', 'info');
            
            
            const response = await fetch(`${API_URL}/servers/${serverId}/plugins/install`, {
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
            loadInstalledPlugins(serverId);
        } catch (error) {
            showMessage(`Installation fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    // Load installed plugins for a server
    async function loadInstalledPlugins(serverId) {
        const container = document.getElementById('installedPluginsList');
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
                        <div style="display: flex; align-items: center; justify-content: space-between; background: var(--bg-secondary); padding: 1rem; border-radius: 8px; border: 1px solid var(--border);">
                            <div style="display: flex; align-items: center; gap: 1rem;">
                                <span style="font-size: 1.5rem;">📦</span>
                                <div>
                                    <div style="font-weight: 500;">${plugin.name}</div>
                                    <div style="font-size: 0.875rem; color: var(--text-secondary);">${formatBytes(plugin.size)}</div>
                                </div>
                            </div>
                            <button class="btn btn-danger" onclick="PluginManager.uninstallPlugin('${serverId}', '${plugin.name}')" style="padding: 0.5rem 1rem;">
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

    // Uninstall plugin
    async function uninstallPlugin(serverId, filename) {
        if (!confirm(`Möchtest du ${filename} wirklich deinstallieren?`)) {
            return;
        }

        try {
            const response = await fetch(`${API_URL}/servers/${serverId}/plugins/${encodeURIComponent(filename)}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Deinstallation fehlgeschlagen');
            }

            showMessage(`${filename} wurde deinstalliert`, 'success');
            loadInstalledPlugins(serverId);
        } catch (error) {
            showMessage(`Deinstallation fehlgeschlagen: ${error.message}`, 'error');
        }
    }

    function closeModal() {
        const modal = document.getElementById('serverModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Helper functions
    function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    function formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function showMessage(message, type = 'info') {
        // Create or update status message
        let statusEl = document.getElementById('pluginStatus');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'pluginStatus';
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

    // Set selected server (called from ServerDetails)
    function setSelectedServer(serverId) {
        selectedServer = serverId;
        const serverSelect = document.getElementById('pluginServerSelect');
        if (serverSelect) {
            serverSelect.value = serverId;
        }
        if (serverId) {
            loadInstalledPlugins(serverId);
        }
    }

    // Get selected server
    function getSelectedServer() {
        return selectedServer;
    }

    // Public API
    return {
        init,
        showInstallModal,
        installPlugin,
        uninstallPlugin,
        closeModal,
        loadServerList,
        setSelectedServer,
        getSelectedServer
    };
})();

// Initialize when plugins tab becomes active
document.addEventListener('DOMContentLoaded', () => {
    PluginManager.init();
});
