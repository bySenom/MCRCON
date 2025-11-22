// Task Management
const TaskManager = (() => {
    const API_URL = 'http://localhost:3000/api';
    let tasks = [];
    let servers = [];
    let editingTaskId = null;

    function getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    function init() {
        setupEventListeners();
        loadServersForTasks();
    }

    function setupEventListeners() {
        // Create task button
        document.getElementById('createTaskBtn')?.addEventListener('click', () => openTaskModal());
        
        // Task form
        document.getElementById('taskForm')?.addEventListener('submit', handleTaskSubmit);
        
        // Task type change (show/hide command field)
        document.getElementById('taskType')?.addEventListener('change', (e) => {
            const commandGroup = document.getElementById('taskCommandGroup');
            if (commandGroup) {
                commandGroup.style.display = e.target.value === 'command' ? 'block' : 'none';
            }
        });

        // Refresh log button
        document.getElementById('refreshLogBtn')?.addEventListener('click', loadExecutionLog);

        // Tab visibility - load tasks when tab is shown
        const tasksTab = document.querySelector('[data-tab="tasks"]');
        if (tasksTab) {
            tasksTab.addEventListener('click', () => {
                loadTasks();
                loadExecutionLog();
            });
        }
    }

    async function loadServersForTasks() {
        try {
            const response = await fetch(`${API_URL}/servers`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                servers = data.servers;
                populateServerSelect();
            }
        } catch (error) {
        }
    }

    function populateServerSelect() {
        const select = document.getElementById('taskServer');
        if (!select) return;

        select.innerHTML = '<option value="">Server auswählen...</option>';
        servers.forEach(server => {
            const option = document.createElement('option');
            option.value = server.id;
            option.textContent = `${server.name} (${server.type} ${server.version})`;
            select.appendChild(option);
        });
    }

    async function loadTasks() {
        try {
            const response = await fetch(`${API_URL}/tasks`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                tasks = data.tasks;
                renderTasks();
            }
        } catch (error) {
            document.getElementById('taskList').innerHTML = `
                <div style="color: var(--danger-color); text-align: center; padding: 2rem;">
                    Fehler beim Laden der Tasks
                </div>
            `;
        }
    }

    function renderTasks() {
        const container = document.getElementById('taskList');
        if (!container) return;

        if (tasks.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📅</div>
                    <p style="font-size: 1.1rem; margin-bottom: 0.5rem;">Keine geplanten Tasks</p>
                    <p style="font-size: 0.9rem;">Erstelle einen neuen Task, um automatische Aktionen zu planen.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tasks.map(task => {
            const server = servers.find(s => s.id === task.serverId);
            const serverName = server ? server.name : 'Unbekannter Server';
            
            const typeIcons = {
                backup: '🗄️',
                restart: '🔄',
                start: '▶️',
                stop: '⏹️',
                command: '⌨️'
            };

            const typeNames = {
                backup: 'Backup',
                restart: 'Restart',
                start: 'Start',
                stop: 'Stop',
                command: 'Command'
            };

            return `
                <div class="task-card" style="background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                        <div style="flex: 1;">
                            <h3 style="margin: 0 0 0.5rem 0; display: flex; align-items: center; gap: 0.5rem;">
                                ${typeIcons[task.type]} ${task.name}
                                ${task.enabled ? 
                                    '<span style="background: var(--success-color); color: #000; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">AKTIV</span>' : 
                                    '<span style="background: var(--text-secondary); color: #000; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600;">INAKTIV</span>'
                                }
                            </h3>
                            <div style="display: flex; gap: 1rem; color: var(--text-secondary); font-size: 0.875rem;">
                                <span>📦 ${serverName}</span>
                                <span>🏷️ ${typeNames[task.type]}</span>
                                <span>⏰ ${task.cronExpression}</span>
                            </div>
                            ${task.command ? `<div style="margin-top: 0.5rem; font-family: monospace; font-size: 0.875rem; color: var(--info-color);">» ${task.command}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn-sm btn-action" onclick="TaskManager.executeTask('${task.id}')" title="Jetzt ausführen">▶️</button>
                            <button class="btn-sm ${task.enabled ? 'btn-warning' : 'btn-success'}" onclick="TaskManager.toggleTask('${task.id}')" title="${task.enabled ? 'Deaktivieren' : 'Aktivieren'}">
                                ${task.enabled ? '⏸️' : '▶️'}
                            </button>
                            <button class="btn-sm btn-secondary" onclick="TaskManager.editTask('${task.id}')" title="Bearbeiten">✏️</button>
                            <button class="btn-sm btn-danger" onclick="TaskManager.deleteTask('${task.id}')" title="Löschen">🗑️</button>
                        </div>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding-top: 0.75rem; border-top: 1px solid var(--border); font-size: 0.875rem; color: var(--text-secondary);">
                        <span>Erstellt: ${new Date(task.createdAt).toLocaleString('de-DE')}</span>
                        ${task.lastRun ? `<span>Zuletzt: ${new Date(task.lastRun).toLocaleString('de-DE')}</span>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    async function loadExecutionLog() {
        try {
            const response = await fetch(`${API_URL}/tasks/log?limit=50`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();
            
            if (data.success) {
                renderExecutionLog(data.log);
            }
        } catch (error) {
        }
    }

    function renderExecutionLog(log) {
        const container = document.getElementById('executionLog');
        if (!container) return;

        if (log.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    Noch keine Ausführungen
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border); text-align: left;">
                        <th style="padding: 0.75rem;">Status</th>
                        <th style="padding: 0.75rem;">Task</th>
                        <th style="padding: 0.75rem;">Typ</th>
                        <th style="padding: 0.75rem;">Zeitpunkt</th>
                        <th style="padding: 0.75rem;">Dauer</th>
                    </tr>
                </thead>
                <tbody>
                    ${log.map(entry => `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 0.75rem;">
                                ${entry.success ? 
                                    '<span style="color: var(--success-color);">✅ Erfolg</span>' : 
                                    '<span style="color: var(--danger-color);">❌ Fehler</span>'
                                }
                            </td>
                            <td style="padding: 0.75rem;">${entry.taskName}</td>
                            <td style="padding: 0.75rem;">${entry.type}</td>
                            <td style="padding: 0.75rem; font-size: 0.875rem; color: var(--text-secondary);">
                                ${new Date(entry.startTime).toLocaleString('de-DE')}
                            </td>
                            <td style="padding: 0.75rem; font-size: 0.875rem;">${entry.duration}ms</td>
                        </tr>
                        ${!entry.success && entry.error ? `
                            <tr style="border-bottom: 1px solid var(--border);">
                                <td colspan="5" style="padding: 0.5rem 0.75rem; background: rgba(255, 85, 85, 0.1); color: var(--danger-color); font-size: 0.875rem; font-family: monospace;">
                                    ${entry.error}
                                </td>
                            </tr>
                        ` : ''}
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function openTaskModal(task = null) {
        editingTaskId = task ? task.id : null;
        const modal = document.getElementById('taskModal');
        const title = document.getElementById('taskModalTitle');
        const form = document.getElementById('taskForm');

        if (task) {
            title.textContent = 'Task bearbeiten';
            document.getElementById('taskName').value = task.name;
            document.getElementById('taskServer').value = task.serverId;
            document.getElementById('taskType').value = task.type;
            document.getElementById('taskCommand').value = task.command || '';
            document.getElementById('taskCron').value = task.cronExpression;
            document.getElementById('taskEnabled').checked = task.enabled;

            // Show/hide command field
            const commandGroup = document.getElementById('taskCommandGroup');
            if (commandGroup) {
                commandGroup.style.display = task.type === 'command' ? 'block' : 'none';
            }
        } else {
            title.textContent = 'Neuer Task';
            form.reset();
            document.getElementById('taskEnabled').checked = true;
        }

        modal.classList.add('active');
    }

    function closeTaskModal() {
        const modal = document.getElementById('taskModal');
        modal.classList.remove('active');
        editingTaskId = null;
    }

    async function handleTaskSubmit(e) {
        e.preventDefault();

        const taskData = {
            name: document.getElementById('taskName').value,
            serverId: document.getElementById('taskServer').value,
            type: document.getElementById('taskType').value,
            cronExpression: document.getElementById('taskCron').value,
            command: document.getElementById('taskCommand').value || null,
            enabled: document.getElementById('taskEnabled').checked
        };

        try {
            const url = editingTaskId ? 
                `${API_URL}/tasks/${editingTaskId}` : 
                `${API_URL}/tasks`;
            
            const method = editingTaskId ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: getAuthHeaders(),
                body: JSON.stringify(taskData)
            });

            const data = await response.json();

            if (data.success) {
                showMessage(data.message || 'Task gespeichert', 'success');
                closeTaskModal();
                await loadTasks();
            } else {
                showMessage(data.message || 'Fehler beim Speichern', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Speichern des Tasks', 'error');
        }
    }

    async function executeTask(taskId) {
        if (!confirm('Task jetzt ausführen?')) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/execute`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Task wird ausgeführt', 'success');
                setTimeout(loadExecutionLog, 2000); // Refresh log after 2 seconds
            } else {
                showMessage(data.message || 'Fehler beim Ausführen', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Ausführen des Tasks', 'error');
        }
    }

    async function toggleTask(taskId) {
        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}/toggle`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                showMessage(data.message, 'success');
                await loadTasks();
            } else {
                showMessage(data.message || 'Fehler beim Umschalten', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Umschalten des Tasks', 'error');
        }
    }

    async function editTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (task) {
            openTaskModal(task);
        }
    }

    async function deleteTask(taskId) {
        const task = tasks.find(t => t.id === taskId);
        if (!task) return;

        if (!confirm(`Task "${task.name}" wirklich löschen?`)) return;

        try {
            const response = await fetch(`${API_URL}/tasks/${taskId}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.success) {
                showMessage('Task gelöscht', 'success');
                await loadTasks();
            } else {
                showMessage(data.message || 'Fehler beim Löschen', 'error');
            }
        } catch (error) {
            showMessage('Fehler beim Löschen des Tasks', 'error');
        }
    }

    function showMessage(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: ${type === 'success' ? 'var(--success-color)' : type === 'error' ? 'var(--danger-color)' : 'var(--info-color)'};
            color: #000;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Public API
    return {
        init,
        loadTasks,
        executeTask,
        toggleTask,
        editTask,
        deleteTask,
        openTaskModal: () => openTaskModal(),
        closeTaskModal
    };
})();

// Make closeTaskModal globally available for onclick handlers
window.closeTaskModal = () => TaskManager.closeTaskModal();

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TaskManager.init());
} else {
    TaskManager.init();
}
