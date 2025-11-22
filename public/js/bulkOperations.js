/**
 * Bulk Operations - Multi-select and batch actions for servers
 * Version: 1.0.0
 */

const BulkOperations = (function() {
    let selectedServers = new Set();
    let bulkBar = null;

    function initialize() {
        addStyles();
        setupKeyboardShortcuts();
    }

    /**
     * Toggle server selection
     */
    function toggleServer(serverId) {
        if (selectedServers.has(serverId)) {
            selectedServers.delete(serverId);
        } else {
            selectedServers.add(serverId);
        }
        
        updateUI();
        updateBulkBar();
    }

    /**
     * Select all servers
     */
    function selectAll() {
        if (!window.dashboardState || !window.dashboardState.servers) return;
        
        selectedServers.clear();
        window.dashboardState.servers.forEach(server => {
            selectedServers.add(server.id);
        });
        
        updateUI();
        updateBulkBar();
        
        if (window.Toast) {
            Toast.info(`${selectedServers.size} Server ausgewählt`);
        }
    }

    /**
     * Deselect all servers
     */
    function deselectAll() {
        selectedServers.clear();
        updateUI();
        updateBulkBar();
    }

    /**
     * Check if server is selected
     */
    function isSelected(serverId) {
        return selectedServers.has(serverId);
    }

    /**
     * Get selected count
     */
    function getSelectedCount() {
        return selectedServers.size;
    }

    /**
     * Create checkbox for server card
     */
    function createCheckbox(serverId) {
        const checkbox = document.createElement('div');
        checkbox.className = 'bulk-checkbox';
        checkbox.innerHTML = `
            <input 
                type="checkbox" 
                id="bulk-${serverId}" 
                ${isSelected(serverId) ? 'checked' : ''}
            />
            <label for="bulk-${serverId}"></label>
        `;
        
        checkbox.onclick = (e) => {
            e.stopPropagation();
            toggleServer(serverId);
        };
        
        return checkbox;
    }

    /**
     * Update UI (checkboxes)
     */
    function updateUI() {
        selectedServers.forEach(serverId => {
            const checkbox = document.getElementById(`bulk-${serverId}`);
            if (checkbox) checkbox.checked = true;
        });
    }

    /**
     * Update bulk action bar
     */
    function updateBulkBar() {
        if (selectedServers.size === 0) {
            hideBulkBar();
        } else {
            showBulkBar();
        }
    }

    /**
     * Show bulk action bar
     */
    function showBulkBar() {
        if (!bulkBar) {
            bulkBar = createBulkBar();
            document.body.appendChild(bulkBar);
        }
        
        updateBulkBarContent();
        
        requestAnimationFrame(() => {
            bulkBar.classList.add('bulk-bar-show');
        });
    }

    /**
     * Hide bulk action bar
     */
    function hideBulkBar() {
        if (bulkBar) {
            bulkBar.classList.remove('bulk-bar-show');
        }
    }

    /**
     * Create bulk action bar
     */
    function createBulkBar() {
        const bar = document.createElement('div');
        bar.className = 'bulk-action-bar';
        return bar;
    }

    /**
     * Update bulk action bar content
     */
    function updateBulkBarContent() {
        if (!bulkBar) return;
        
        const count = selectedServers.size;
        
        bulkBar.innerHTML = `
            <div class="bulk-bar-content">
                <div class="bulk-bar-info">
                    <span class="bulk-bar-count">${count} Server ausgewählt</span>
                    <button class="bulk-bar-deselect" onclick="BulkOperations.deselectAll()">
                        ✕ Auswahl aufheben
                    </button>
                </div>
                <div class="bulk-bar-actions">
                    <button class="bulk-action-btn bulk-action-start" onclick="BulkOperations.startSelected()">
                        <span class="bulk-action-icon">▶️</span>
                        Start
                    </button>
                    <button class="bulk-action-btn bulk-action-stop" onclick="BulkOperations.stopSelected()">
                        <span class="bulk-action-icon">⏹️</span>
                        Stop
                    </button>
                    <button class="bulk-action-btn bulk-action-restart" onclick="BulkOperations.restartSelected()">
                        <span class="bulk-action-icon">🔄</span>
                        Restart
                    </button>
                    <button class="bulk-action-btn bulk-action-backup" onclick="BulkOperations.backupSelected()">
                        <span class="bulk-action-icon">📦</span>
                        Backup
                    </button>
                    <button class="bulk-action-btn bulk-action-delete" onclick="BulkOperations.deleteSelected()">
                        <span class="bulk-action-icon">🗑️</span>
                        Delete
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Bulk start servers
     */
    async function startSelected() {
        if (selectedServers.size === 0) return;
        
        if (!confirm(`${selectedServers.size} Server starten?`)) return;
        
        const results = await executeBulkAction('start', 'Server wird gestartet');
        showResults(results, 'gestartet');
        deselectAll();
    }

    /**
     * Bulk stop servers
     */
    async function stopSelected() {
        if (selectedServers.size === 0) return;
        
        if (!confirm(`${selectedServers.size} Server stoppen?`)) return;
        
        const results = await executeBulkAction('stop', 'Server wird gestoppt');
        showResults(results, 'gestoppt');
        deselectAll();
    }

    /**
     * Bulk restart servers
     */
    async function restartSelected() {
        if (selectedServers.size === 0) return;
        
        if (!confirm(`${selectedServers.size} Server neustarten?`)) return;
        
        const results = await executeBulkAction('restart', 'Server wird neugestartet');
        showResults(results, 'neugestartet');
        deselectAll();
    }

    /**
     * Bulk backup servers
     */
    async function backupSelected() {
        if (selectedServers.size === 0) return;
        
        if (!confirm(`Backup für ${selectedServers.size} Server erstellen?`)) return;
        
        const results = await executeBulkAction('backup', 'Backup wird erstellt');
        showResults(results, 'gesichert');
        deselectAll();
    }

    /**
     * Bulk delete servers
     */
    async function deleteSelected() {
        if (selectedServers.size === 0) return;
        
        if (!confirm(`⚠️ ${selectedServers.size} Server PERMANENT löschen?\n\nDiese Aktion kann nicht rückgängig gemacht werden!`)) return;
        
        const results = await executeBulkAction('delete', 'Server wird gelöscht', 'DELETE');
        showResults(results, 'gelöscht');
        deselectAll();
        
        // Reload server list
        if (window.dashboardState) {
            window.dashboardState.loadServers();
        }
    }

    /**
     * Execute bulk action
     */
    async function executeBulkAction(action, progressMessage, method = 'POST') {
        const token = localStorage.getItem('token');
        const promises = [];
        
        selectedServers.forEach(serverId => {
            const endpoint = action === 'delete' 
                ? `/api/servers/${serverId}`
                : `/api/servers/${serverId}/${action}`;
            
            promises.push(
                fetch(endpoint, {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    }
                })
                .then(res => res.json())
                .then(data => ({ serverId, success: data.success }))
                .catch(() => ({ serverId, success: false }))
            );
        });
        
        if (window.Toast) {
            Toast.info(progressMessage);
        }
        
        return await Promise.all(promises);
    }

    /**
     * Show bulk action results
     */
    function showResults(results, action) {
        const successful = results.filter(r => r.success).length;
        const failed = results.length - successful;
        
        if (failed === 0) {
            if (window.Toast) {
                Toast.success(`${successful} Server ${action}!`);
            }
        } else {
            if (window.Toast) {
                Toast.warning(`${successful} Server ${action}, ${failed} fehlgeschlagen`);
            }
        }
    }

    /**
     * Start all servers
     */
    async function startAll() {
        if (!window.dashboardState || !window.dashboardState.servers) return;
        
        const stoppedServers = window.dashboardState.servers.filter(s => s.status === 'stopped');
        if (stoppedServers.length === 0) {
            if (window.Toast) Toast.info('Keine gestoppten Server');
            return;
        }
        
        if (!confirm(`${stoppedServers.length} Server starten?`)) return;
        
        selectedServers.clear();
        stoppedServers.forEach(s => selectedServers.add(s.id));
        
        await startSelected();
    }

    /**
     * Stop all servers
     */
    async function stopAll() {
        if (!window.dashboardState || !window.dashboardState.servers) return;
        
        const runningServers = window.dashboardState.servers.filter(s => s.status === 'running');
        if (runningServers.length === 0) {
            if (window.Toast) Toast.info('Keine laufenden Server');
            return;
        }
        
        if (!confirm(`${runningServers.length} Server stoppen?`)) return;
        
        selectedServers.clear();
        runningServers.forEach(s => selectedServers.add(s.id));
        
        await stopSelected();
    }

    /**
     * Setup keyboard shortcuts (removed to avoid browser conflicts)
     */
    function setupKeyboardShortcuts() {
        // Ctrl+A removed to avoid conflicts with browser select-all
        // Users can use the "Alle auswählen" button instead
    }

    /**
     * Add styles
     */
    function addStyles() {
        if (document.getElementById('bulk-operations-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'bulk-operations-styles';
        style.textContent = `
            .bulk-checkbox {
                position: absolute;
                top: 8px;
                right: 8px;
                z-index: 10;
            }
            
            .bulk-checkbox input[type="checkbox"] {
                display: none;
            }
            
            .bulk-checkbox label {
                display: block;
                width: 24px;
                height: 24px;
                background: rgba(0, 0, 0, 0.5);
                border: 2px solid var(--border-color, #3a3a3a);
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            
            .bulk-checkbox label::after {
                content: '✓';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) scale(0);
                color: white;
                font-size: 14px;
                font-weight: bold;
                transition: transform 0.2s;
            }
            
            .bulk-checkbox input:checked + label {
                background: var(--primary-color, #4CAF50);
                border-color: var(--primary-color, #4CAF50);
            }
            
            .bulk-checkbox input:checked + label::after {
                transform: translate(-50%, -50%) scale(1);
            }
            
            .bulk-checkbox label:hover {
                border-color: var(--primary-color, #4CAF50);
            }
            
            .bulk-action-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: var(--card-bg, #1e1e1e);
                border-top: 2px solid var(--primary-color, #4CAF50);
                box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .bulk-action-bar.bulk-bar-show {
                transform: translateY(0);
            }
            
            .bulk-bar-content {
                max-width: 1200px;
                margin: 0 auto;
                padding: 16px 24px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 20px;
            }
            
            .bulk-bar-info {
                display: flex;
                align-items: center;
                gap: 16px;
            }
            
            .bulk-bar-count {
                font-size: 16px;
                font-weight: 600;
                color: var(--text-color, #fff);
            }
            
            .bulk-bar-deselect {
                background: none;
                border: 1px solid var(--border-color, #3a3a3a);
                color: var(--text-color, #fff);
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }
            
            .bulk-bar-deselect:hover {
                background: var(--hover-bg, #2a2a2a);
            }
            
            .bulk-bar-actions {
                display: flex;
                gap: 8px;
            }
            
            .bulk-action-btn {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 16px;
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s;
                color: var(--text-color, #fff);
            }
            
            .bulk-action-start {
                background: var(--success-color, #4CAF50);
                border-color: var(--success-color, #4CAF50);
            }
            
            .bulk-action-start:hover {
                background: #45a049;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(76, 175, 80, 0.3);
            }
            
            .bulk-action-stop {
                background: var(--danger-color, #f44336);
                border-color: var(--danger-color, #f44336);
            }
            
            .bulk-action-stop:hover {
                background: #da190b;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(244, 67, 54, 0.3);
            }
            
            .bulk-action-restart {
                background: var(--warning-color, #ff9800);
                border-color: var(--warning-color, #ff9800);
            }
            
            .bulk-action-restart:hover {
                background: #e68900;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(255, 152, 0, 0.3);
            }
            
            .bulk-action-backup {
                background: var(--info-color, #2196F3);
                border-color: var(--info-color, #2196F3);
            }
            
            .bulk-action-backup:hover {
                background: #0b7dda;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(33, 150, 243, 0.3);
            }
            
            .bulk-action-delete {
                background: transparent;
                border-color: var(--danger-color, #f44336);
                color: var(--danger-color, #f44336);
            }
            
            .bulk-action-delete:hover {
                background: var(--danger-color, #f44336);
                color: white;
                transform: translateY(-2px);
            }
            
            .bulk-action-icon {
                font-size: 16px;
            }
            
            @media (max-width: 768px) {
                .bulk-bar-content {
                    flex-direction: column;
                    gap: 12px;
                }
                
                .bulk-bar-actions {
                    width: 100%;
                    justify-content: space-around;
                }
                
                .bulk-action-btn {
                    flex: 1;
                    justify-content: center;
                    padding: 8px 12px;
                    font-size: 12px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        toggleServer,
        selectAll,
        deselectAll,
        isSelected,
        getSelectedCount,
        createCheckbox,
        startSelected,
        stopSelected,
        restartSelected,
        backupSelected,
        deleteSelected,
        startAll,
        stopAll
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => BulkOperations.initialize());
} else {
    BulkOperations.initialize();
}

// Make globally available
window.BulkOperations = BulkOperations;
