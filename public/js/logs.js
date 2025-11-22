/**
 * Logs Viewer
 * Handles log viewing, filtering, and export functionality
 */

const Logs = (function() {
    const API_URL = 'http://localhost:3000/api';
    
    let currentServerId = null;
    let currentLogType = 'latest';
    let autoRefreshInterval = null;
    let autoScrollEnabled = true;

    // Helper to get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Initialize
    function init() {
        
        // Event listeners
        document.getElementById('logServerSelect')?.addEventListener('change', handleServerChange);
        document.getElementById('logLevelFilter')?.addEventListener('change', loadLogs);
        document.getElementById('logSearchInput')?.addEventListener('input', debounce(loadLogs, 500));
        document.getElementById('logFileSelect')?.addEventListener('change', handleLogFileChange);
        document.getElementById('refreshLogsBtn')?.addEventListener('click', loadLogs);
        document.getElementById('exportLogsBtn')?.addEventListener('click', exportLogs);
        document.getElementById('clearLogsBtn')?.addEventListener('click', clearLogDisplay);
        document.getElementById('autoRefreshCheckbox')?.addEventListener('change', handleAutoRefreshToggle);
        document.getElementById('autoScrollLogCheckbox')?.addEventListener('change', (e) => {
            autoScrollEnabled = e.target.checked;
        });

        // Load servers for dropdown
        loadServersForDropdown();
    }

    // Load servers for dropdown
    async function loadServersForDropdown() {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setTimeout(() => window.location.href = '/login.html', 1500);
                return;
            }

            const response = await fetch(`${API_URL}/servers`, {
                headers: getAuthHeaders()
            });

            if (response.status === 401) {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                setTimeout(() => window.location.href = '/login.html', 1500);
                return;
            }

            const data = await response.json();
            const select = document.getElementById('logServerSelect');
            
            if (select) {
                select.innerHTML = '<option value="">Server auswählen...</option>';
                data.servers.forEach(server => {
                    const option = document.createElement('option');
                    option.value = server.id;
                    option.textContent = `${server.name} (${server.type})`;
                    select.appendChild(option);
                });
            }
        } catch (error) {
        }
    }

    // Handle server change
    async function handleServerChange(e) {
        currentServerId = e.target.value;
        
        if (!currentServerId) {
            document.getElementById('logDisplay').innerHTML = '<div class="no-logs">Bitte wähle einen Server aus.</div>';
            document.getElementById('logStats').innerHTML = '';
            return;
        }

        // Load available log files
        await loadLogFiles();
        
        // Load logs and stats
        await Promise.all([
            loadLogs(),
            loadLogStats()
        ]);
    }

    // Load available log files
    async function loadLogFiles() {
        if (!currentServerId) return;

        try {
            const response = await fetch(`${API_URL}/servers/${currentServerId}/logs/files`, {
                headers: getAuthHeaders()
            });

            const data = await response.json();
            const select = document.getElementById('logFileSelect');
            
            if (select && data.success) {
                select.innerHTML = '';
                data.files.forEach(file => {
                    const option = document.createElement('option');
                    option.value = file.name.replace('.log', '');
                    option.textContent = file.name;
                    if (file.name === 'latest.log') {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        } catch (error) {
        }
    }

    // Handle log file change
    function handleLogFileChange(e) {
        currentLogType = e.target.value;
        loadLogs();
    }

    // Load logs
    async function loadLogs() {
        if (!currentServerId) return;

        const level = document.getElementById('logLevelFilter')?.value || '';
        const search = document.getElementById('logSearchInput')?.value || '';
        const lines = 500; // Load more lines for better scrolling

        try {
            document.getElementById('logDisplay').innerHTML = '<div class="loading">Lade Logs...</div>';

            const params = new URLSearchParams({
                lines: lines.toString(),
                logType: currentLogType
            });

            if (level) params.append('level', level);
            if (search) params.append('search', search);

            const response = await fetch(`${API_URL}/servers/${currentServerId}/logs?${params}`, {
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                renderLogs(data.logs);
            } else {
                document.getElementById('logDisplay').innerHTML = `<div class="error">Fehler: ${data.message}</div>`;
            }
        } catch (error) {
            document.getElementById('logDisplay').innerHTML = '<div class="error">Fehler beim Laden der Logs.</div>';
        }
    }

    // Load log statistics
    async function loadLogStats() {
        if (!currentServerId) return;

        try {
            const response = await fetch(`${API_URL}/servers/${currentServerId}/logs/stats`, {
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success && data.stats) {
                renderLogStats(data.stats);
            }
        } catch (error) {
        }
    }

    // Render logs
    function renderLogs(logs) {
        const display = document.getElementById('logDisplay');
        
        if (!logs || logs.length === 0) {
            display.innerHTML = '<div class="no-logs">Keine Logs gefunden.</div>';
            return;
        }

        const logLines = logs.map(log => {
            const levelClass = getLevelClass(log.level);
            return `
                <div class="log-line ${levelClass}">
                    <span class="log-time">${log.timestamp || '--:--:--'}</span>
                    <span class="log-level log-level-${log.level.toLowerCase()}">${log.level}</span>
                    <span class="log-thread">[${log.thread}]</span>
                    <span class="log-message">${escapeHtml(log.message)}</span>
                </div>
            `;
        }).join('');

        display.innerHTML = logLines;

        // Auto-scroll to bottom
        if (autoScrollEnabled) {
            display.scrollTop = display.scrollHeight;
        }
    }

    // Render log statistics
    function renderLogStats(stats) {
        const statsContainer = document.getElementById('logStats');
        
        if (!stats) {
            statsContainer.innerHTML = '';
            return;
        }

        const totalMessages = Object.values(stats.levels).reduce((sum, count) => sum + count, 0);

        statsContainer.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem;">
                <div class="stat-card">
                    <div class="stat-label">Größe</div>
                    <div class="stat-value">${stats.sizeFormatted}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Zeilen</div>
                    <div class="stat-value">${stats.lines.toLocaleString()}</div>
                </div>
                <div class="stat-card stat-info">
                    <div class="stat-label">INFO</div>
                    <div class="stat-value">${stats.levels.INFO || 0}</div>
                </div>
                <div class="stat-card stat-warn">
                    <div class="stat-label">WARN</div>
                    <div class="stat-value">${stats.levels.WARN || 0}</div>
                </div>
                <div class="stat-card stat-error">
                    <div class="stat-label">ERROR</div>
                    <div class="stat-value">${stats.levels.ERROR || 0}</div>
                </div>
            </div>
        `;
    }

    // Get CSS class for log level
    function getLevelClass(level) {
        const levelMap = {
            'INFO': 'log-info',
            'WARN': 'log-warn',
            'WARNING': 'log-warn',
            'ERROR': 'log-error',
            'FATAL': 'log-fatal',
            'DEBUG': 'log-debug'
        };
        return levelMap[level] || '';
    }

    // Export logs
    async function exportLogs() {
        if (!currentServerId) {
            alert('Bitte wähle zuerst einen Server aus.');
            return;
        }

        const level = document.getElementById('logLevelFilter')?.value || '';
        const search = document.getElementById('logSearchInput')?.value || '';

        try {
            const params = new URLSearchParams({
                logType: currentLogType
            });

            if (level) params.append('level', level);
            if (search) params.append('search', search);

            const response = await fetch(`${API_URL}/servers/${currentServerId}/logs/export?${params}`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                throw new Error('Export failed');
            }

            // Download the file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `logs-${Date.now()}.txt`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            showStatus('Logs erfolgreich exportiert', 'success');
        } catch (error) {
            showStatus('Fehler beim Exportieren der Logs', 'error');
        }
    }

    // Clear log display
    function clearLogDisplay() {
        document.getElementById('logDisplay').innerHTML = '<div class="no-logs">Logs gelöscht. Klicke auf Aktualisieren, um neu zu laden.</div>';
    }

    // Handle auto-refresh toggle
    function handleAutoRefreshToggle(e) {
        if (e.target.checked) {
            // Enable auto-refresh every 5 seconds
            autoRefreshInterval = setInterval(() => {
                if (currentServerId) {
                    loadLogs();
                }
            }, 5000);
        } else {
            // Disable auto-refresh
            if (autoRefreshInterval) {
                clearInterval(autoRefreshInterval);
                autoRefreshInterval = null;
            }
        }
    }

    // Show status message
    function showStatus(message, type = 'info') {
        // Reuse dashboard status function if available
        if (window.Dashboard && window.Dashboard.showStatus) {
            window.Dashboard.showStatus(message, type);
        } else {
        }
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    // Debounce function
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Cleanup on unmount
    function cleanup() {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
    }

    // Public API
    return {
        init,
        cleanup,
        loadLogs
    };
})();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', Logs.init);
} else {
    Logs.init();
}
