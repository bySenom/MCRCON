/**
 * Context Menu System - Right-click actions for server cards
 * Version: 1.0.0
 */

const ContextMenu = (function() {
    let currentMenu = null;
    let currentServerId = null;

    function initialize() {
        // Remove any existing context menu on click outside
        document.addEventListener('click', () => {
            closeMenu();
        });

        // Prevent default context menu on server cards
        document.addEventListener('contextmenu', (e) => {
            const serverCard = e.target.closest('.server-card');
            if (serverCard) {
                e.preventDefault();
                const serverId = serverCard.dataset.serverId;
                showMenu(e.pageX, e.pageY, serverId);
            }
        });

        // Add context menu styling
        addStyles();
    }

    function showMenu(x, y, serverId) {
        closeMenu();

        currentServerId = serverId;
        const server = getServerById(serverId);
        if (!server) return;

        const menu = createMenu(server);
        document.body.appendChild(menu);
        currentMenu = menu;

        // Position menu
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';

        // Ensure menu stays within viewport
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = (x - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = (y - rect.height) + 'px';
        }

        // Animate in
        requestAnimationFrame(() => {
            menu.classList.add('context-menu-show');
        });
    }

    function createMenu(server) {
        const menu = document.createElement('div');
        menu.className = 'context-menu';

        const actions = [
            {
                icon: '▶️',
                label: 'Start Server',
                action: () => startServer(server.id),
                show: server.status === 'stopped',
                color: 'success'
            },
            {
                icon: '⏹️',
                label: 'Stop Server',
                action: () => stopServer(server.id),
                show: server.status === 'running',
                color: 'danger'
            },
            {
                icon: '🔄',
                label: 'Restart Server',
                action: () => restartServer(server.id),
                show: server.status === 'running',
                color: 'warning'
            },
            { separator: true, show: true },
            {
                icon: '📋',
                label: 'Copy Server IP',
                action: () => copyServerIP(server),
                show: true
            },
            {
                icon: '🔑',
                label: 'Copy RCON Password',
                action: () => copyRCONPassword(server),
                show: true
            },
            { separator: true, show: true },
            {
                icon: '📦',
                label: 'Create Backup',
                action: () => createBackup(server.id),
                show: true
            },
            {
                icon: '📄',
                label: 'Export Config',
                action: () => exportConfig(server),
                show: true
            },
            {
                icon: '📑',
                label: 'Share as JSON',
                action: () => shareAsJSON(server),
                show: true
            },
            { separator: true, show: true },
            {
                icon: '🔗',
                label: 'Open in Details',
                action: () => openServerDetails(server.id),
                show: true
            },
            {
                icon: '📂',
                label: 'Open Files',
                action: () => openServerFiles(server.id),
                show: true
            },
            { separator: true, show: true },
            {
                icon: '🗑️',
                label: 'Delete Server',
                action: () => deleteServer(server.id),
                show: true,
                color: 'danger'
            }
        ];

        actions.forEach(action => {
            if (!action.show) return;

            if (action.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                menu.appendChild(separator);
            } else {
                const item = document.createElement('div');
                item.className = 'context-menu-item';
                if (action.color) {
                    item.classList.add(`context-menu-item-${action.color}`);
                }
                item.innerHTML = `
                    <span class="context-menu-icon">${action.icon}</span>
                    <span class="context-menu-label">${action.label}</span>
                `;
                item.onclick = (e) => {
                    e.stopPropagation();
                    action.action();
                    closeMenu();
                };
                menu.appendChild(item);
            }
        });

        return menu;
    }

    function closeMenu() {
        if (currentMenu) {
            currentMenu.classList.remove('context-menu-show');
            setTimeout(() => {
                if (currentMenu && currentMenu.parentNode) {
                    currentMenu.parentNode.removeChild(currentMenu);
                }
                currentMenu = null;
                currentServerId = null;
            }, 200);
        }
    }

    // Action handlers
    async function startServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/start`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                if (window.Toast) Toast.success('Server wird gestartet...');
                if (window.dashboardState) window.dashboardState.loadServers();
            } else {
                if (window.Toast) Toast.error(data.message || 'Start fehlgeschlagen');
            }
        } catch (error) {
            if (window.Toast) Toast.error('Fehler beim Starten');
        }
    }

    async function stopServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/stop`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                if (window.Toast) Toast.success('Server wird gestoppt...');
                if (window.dashboardState) window.dashboardState.loadServers();
            } else {
                if (window.Toast) Toast.error(data.message || 'Stop fehlgeschlagen');
            }
        } catch (error) {
            if (window.Toast) Toast.error('Fehler beim Stoppen');
        }
    }

    async function restartServer(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/restart`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                if (window.Toast) Toast.success('Server wird neugestartet...');
                if (window.dashboardState) window.dashboardState.loadServers();
            } else {
                if (window.Toast) Toast.error(data.message || 'Restart fehlgeschlagen');
            }
        } catch (error) {
            if (window.Toast) Toast.error('Fehler beim Neustarten');
        }
    }

    async function createBackup(serverId) {
        try {
            const response = await fetch(`/api/servers/${serverId}/backup`, {
                method: 'POST',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                if (window.Toast) Toast.success('Backup wird erstellt...');
            } else {
                if (window.Toast) Toast.error(data.message || 'Backup fehlgeschlagen');
            }
        } catch (error) {
            if (window.Toast) Toast.error('Fehler beim Backup');
        }
    }

    function copyServerIP(server) {
        const ip = `localhost:${server.port}`;
        if (window.Clipboard) {
            window.Clipboard.copy(ip, 'Server IP kopiert!');
        }
    }

    function copyRCONPassword(server) {
        if (window.Clipboard) {
            window.Clipboard.copy(server.rconPassword, 'RCON Passwort kopiert!');
        }
    }

    function exportConfig(server) {
        const config = {
            name: server.name,
            type: server.type,
            version: server.version,
            port: server.port,
            rconPort: server.rconPort,
            memory: server.memory
        };
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${server.name}-config.json`;
        a.click();
        URL.revokeObjectURL(url);
        if (window.Toast) Toast.success('Config exportiert!');
    }

    function shareAsJSON(server) {
        const json = JSON.stringify(server, null, 2);
        if (window.Clipboard) {
            window.Clipboard.copy(json, 'Server JSON kopiert!');
        }
    }

    function openServerDetails(serverId) {
        if (window.dashboardState) {
            window.dashboardState.selectServer(serverId);
        }
    }

    function openServerFiles(serverId) {
        if (window.dashboardState) {
            window.dashboardState.selectServer(serverId);
            // Switch to Files tab (assuming it's the 4th sub-tab)
            setTimeout(() => {
                const filesTab = document.querySelector('[data-subtab="files"]');
                if (filesTab) filesTab.click();
            }, 100);
        }
    }

    async function deleteServer(serverId) {
        const server = getServerById(serverId);
        if (!confirm(`Server "${server.name}" wirklich löschen?`)) return;

        try {
            const response = await fetch(`/api/servers/${serverId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });
            const data = await response.json();
            if (data.success) {
                if (window.Toast) Toast.success('Server gelöscht!');
                if (window.dashboardState) window.dashboardState.loadServers();
            } else {
                if (window.Toast) Toast.error(data.message || 'Löschen fehlgeschlagen');
            }
        } catch (error) {
            if (window.Toast) Toast.error('Fehler beim Löschen');
        }
    }

    // Helper functions
    function getServerById(serverId) {
        if (window.dashboardState && window.dashboardState.servers) {
            return window.dashboardState.servers.find(s => s.id === serverId);
        }
        return null;
    }

    function getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    function addStyles() {
        if (document.getElementById('context-menu-styles')) return;

        const style = document.createElement('style');
        style.id = 'context-menu-styles';
        style.textContent = `
            .context-menu {
                position: fixed;
                background: var(--card-bg, #1e1e1e);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                padding: 4px 0;
                min-width: 200px;
                z-index: 10000;
                opacity: 0;
                transform: scale(0.95);
                transition: opacity 0.2s, transform 0.2s;
            }

            .context-menu-show {
                opacity: 1;
                transform: scale(1);
            }

            .context-menu-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                cursor: pointer;
                transition: background 0.2s;
                user-select: none;
            }

            .context-menu-item:hover {
                background: var(--hover-bg, #2a2a2a);
            }

            .context-menu-item-success:hover {
                background: rgba(76, 175, 80, 0.2);
            }

            .context-menu-item-danger:hover {
                background: rgba(244, 67, 54, 0.2);
            }

            .context-menu-item-warning:hover {
                background: rgba(255, 152, 0, 0.2);
            }

            .context-menu-icon {
                font-size: 16px;
                width: 20px;
                text-align: center;
            }

            .context-menu-label {
                flex: 1;
                font-size: 14px;
            }

            .context-menu-separator {
                height: 1px;
                background: var(--border-color, #3a3a3a);
                margin: 4px 0;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        showMenu,
        closeMenu
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ContextMenu.initialize());
} else {
    ContextMenu.initialize();
}
