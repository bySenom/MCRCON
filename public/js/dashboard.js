// Dashboard Management
const API_URL = 'http://localhost:3000/api';

// State
let servers = [];
let selectedServer = null;
let templates = [];
let selectedTemplate = null;
let currentUser = null;

// Helper to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('auth_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// DOM Elements
let tabs, tabContents, serverList, refreshButton, createForm, serverTypeSelect, serverVersionSelect, createStatus, modal, modalClose;

// Check authentication
function checkAuth() {
    const token = localStorage.getItem('auth_token');
    if (!token) {
        window.location.href = 'login.html';
        return false;
    }

    // Verify token
    fetch(`${API_URL}/auth/verify`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            currentUser = data.user;
            updateUserInfo();
        } else {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        }
    })
    .catch(error => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
    });

    return true;
}

function updateUserInfo() {
    const userInfo = document.getElementById('userInfo');
    if (currentUser) {
        const roleIcon = currentUser.role === 'admin' ? '👑' : '👤';
        userInfo.textContent = `${roleIcon} ${currentUser.username}`;
    }
}

function logout() {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    
    // Check authentication first
    if (!checkAuth()) return;
    
    // Initialize DOM elements
    tabs = document.querySelectorAll('.tab-button');
    tabContents = document.querySelectorAll('.tab-content');
    serverList = document.getElementById('serverList');
    refreshButton = document.getElementById('refreshServers');
    createForm = document.getElementById('createServerForm');
    serverTypeSelect = document.getElementById('serverType');
    serverVersionSelect = document.getElementById('serverVersion');
    createStatus = document.getElementById('createStatus');
    modal = document.getElementById('serverModal');
    modalClose = document.querySelector('.modal-close');
    
    
    setupEventListeners();
    loadServers();
    loadTemplates();
    
    // Initialize ServerDetails module
    if (typeof ServerDetails !== 'undefined') {
        ServerDetails.init();
    }
    
    // Initialize system monitoring
    initSystemMonitoring();
});

// System Monitoring
let systemCpuChart = null;
let systemRamChart = null;
let systemMonitoringInterval = null;
let systemHistory = {
    labels: [],
    cpuData: [],
    ramData: [],
    maxDataPoints: 30
};

function initSystemMonitoring() {
    
    // Load initial stats
    loadSystemStats();
    
    // Refresh every 2 seconds
    systemMonitoringInterval = setInterval(loadSystemStats, 2000);
    
    // Setup refresh button
    document.getElementById('refreshSystemStats')?.addEventListener('click', loadSystemStats);
    
    // Initialize charts
    initSystemCharts();
}

function initSystemCharts() {
    const cpuCtx = document.getElementById('systemCpuChart');
    const ramCtx = document.getElementById('systemRamChart');
    
    if (cpuCtx && !systemCpuChart) {
        systemCpuChart = new Chart(cpuCtx, {
            type: 'line',
            data: {
                labels: systemHistory.labels,
                datasets: [{
                    label: 'CPU %',
                    data: systemHistory.cpuData,
                    borderColor: 'rgb(80, 250, 123)',
                    backgroundColor: 'rgba(80, 250, 123, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => `${value}%`,
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
    
    if (ramCtx && !systemRamChart) {
        systemRamChart = new Chart(ramCtx, {
            type: 'line',
            data: {
                labels: systemHistory.labels,
                datasets: [{
                    label: 'RAM %',
                    data: systemHistory.ramData,
                    borderColor: 'rgb(139, 233, 253)',
                    backgroundColor: 'rgba(139, 233, 253, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: (context) => `${context.parsed.y.toFixed(1)}%`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: (value) => `${value}%`,
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: { color: 'rgba(255, 255, 255, 0.1)' }
                    },
                    x: {
                        ticks: { color: 'rgba(255, 255, 255, 0.7)' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}

async function loadSystemStats() {
    try {
        const response = await fetch(`${API_URL}/system/stats`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        
        if (data.success && data.stats) {
            updateSystemDisplay(data.stats);
            updateSystemCharts(data.stats);
        }
    } catch (error) {
    }
}

function updateSystemDisplay(stats) {
    // CPU
    const cpuUsage = stats.cpu.usage.toFixed(1);
    document.getElementById('systemCpuUsage').textContent = `${cpuUsage}%`;
    document.getElementById('systemCpuBar').style.width = `${cpuUsage}%`;
    document.getElementById('systemCpuCores').textContent = `${stats.cpu.cores} Kerne`;
    
    // Color coding for CPU bar
    const cpuBar = document.getElementById('systemCpuBar');
    if (cpuUsage > 80) {
        cpuBar.style.background = 'var(--danger-color)';
    } else if (cpuUsage > 60) {
        cpuBar.style.background = 'linear-gradient(90deg, var(--warning-color), var(--danger-color))';
    } else {
        cpuBar.style.background = 'linear-gradient(90deg, var(--primary-color), var(--info-color))';
    }
    
    // RAM
    const ramUsedGB = (stats.memory.used / 1024 / 1024 / 1024).toFixed(1);
    const ramTotalGB = (stats.memory.total / 1024 / 1024 / 1024).toFixed(1);
    const ramPercentage = stats.memory.percentage.toFixed(1);
    
    document.getElementById('systemRamUsage').textContent = `${ramPercentage}%`;
    document.getElementById('systemRamBar').style.width = `${ramPercentage}%`;
    document.getElementById('systemRamTotal').textContent = `${ramUsedGB} / ${ramTotalGB} GB`;
    
    // Color coding for RAM bar
    const ramBar = document.getElementById('systemRamBar');
    if (ramPercentage > 90) {
        ramBar.style.background = 'var(--danger-color)';
    } else if (ramPercentage > 75) {
        ramBar.style.background = 'linear-gradient(90deg, var(--warning-color), var(--danger-color))';
    } else {
        ramBar.style.background = 'linear-gradient(90deg, var(--success-color), var(--warning-color))';
    }
    
    // Disk (show primary disk)
    if (stats.disk && stats.disk.length > 0) {
        const primaryDisk = stats.disk[0];
        const diskUsedGB = (primaryDisk.used / 1024 / 1024 / 1024).toFixed(1);
        const diskTotalGB = (primaryDisk.total / 1024 / 1024 / 1024).toFixed(1);
        const diskPercentage = primaryDisk.percentage.toFixed(1);
        
        document.getElementById('systemDiskUsage').textContent = `${diskPercentage}%`;
        document.getElementById('systemDiskBar').style.width = `${diskPercentage}%`;
        document.getElementById('systemDiskTotal').textContent = `${diskUsedGB} / ${diskTotalGB} GB (${primaryDisk.mount})`;
        
        // Color coding for Disk bar
        const diskBar = document.getElementById('systemDiskBar');
        if (diskPercentage > 90) {
            diskBar.style.background = 'var(--danger-color)';
        } else if (diskPercentage > 75) {
            diskBar.style.background = 'linear-gradient(90deg, var(--warning-color), var(--danger-color))';
        } else {
            diskBar.style.background = 'linear-gradient(90deg, var(--info-color), var(--primary-color))';
        }
    }
}

function updateSystemCharts(stats) {
    const now = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    // Add new data point
    systemHistory.labels.push(now);
    systemHistory.cpuData.push(stats.cpu.usage);
    systemHistory.ramData.push(stats.memory.percentage);
    
    // Keep only last 30 data points
    if (systemHistory.labels.length > systemHistory.maxDataPoints) {
        systemHistory.labels.shift();
        systemHistory.cpuData.shift();
        systemHistory.ramData.shift();
    }
    
    // Update charts
    if (systemCpuChart) {
        systemCpuChart.data.labels = systemHistory.labels;
        systemCpuChart.data.datasets[0].data = systemHistory.cpuData;
        systemCpuChart.update('none'); // No animation for smoother updates
    }
    
    if (systemRamChart) {
        systemRamChart.data.labels = systemHistory.labels;
        systemRamChart.data.datasets[0].data = systemHistory.ramData;
        systemRamChart.update('none');
    }
}

// Setup Event Listeners
function setupEventListeners() {
    
    // Tab switching
    for (const tab of tabs) {
        tab.addEventListener('click', () => {
            switchTab(tab.dataset.tab);
        });
    }

    // Logout button
    document.getElementById('logoutBtn')?.addEventListener('click', logout);

    // Refresh servers
    refreshButton.addEventListener('click', loadServers);

    // Server type change - load versions
    serverTypeSelect.addEventListener('change', async (e) => {
        const type = e.target.value;
        if (!type) return;

        // Set default port based on server type
        const portInput = document.getElementById('serverPort');
        if (type === 'bungeecord' || type === 'waterfall') {
            portInput.value = 25577; // Default proxy port
        } else {
            portInput.value = 25565; // Default Minecraft server port
        }

        serverVersionSelect.innerHTML = '<option value="">Lade Versionen...</option>';
        try {
            const response = await fetch(`${API_URL}/versions/${type}`, {
                headers: getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                serverVersionSelect.innerHTML = data.versions
                    .map(v => `<option value="${v}">${v}</option>`)
                    .join('');
            }
        } catch (error) {
            serverVersionSelect.innerHTML = '<option value="">Fehler beim Laden</option>';
        }
    });

    // Create server form
    createForm.addEventListener('submit', handleCreateServer);

    // Modal close
    modalClose.addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });
}

// Switch Tab
function switchTab(tabName) {
    // Update buttons
    for (const tab of tabs) {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    }

    // Update content
    for (const content of tabContents) {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    }

    // Load data when switching tabs
    if (tabName === 'dashboard') {
        loadServers();
    } else if (tabName === 'plugins') {
        // Reload server list and installed plugins if server selected
        if (typeof PluginManager !== 'undefined') {
            PluginManager.loadServerList();
            const selectedServerId = PluginManager.getSelectedServer();
            if (selectedServerId) {
                // Trigger the installed plugins reload by setting the server again
                PluginManager.setSelectedServer(selectedServerId);
            }
        }
    }
}

// Load Servers
async function loadServers() {
    try {
        serverList.innerHTML = '<div class="loading">Lade Server...</div>';

        const response = await fetch(`${API_URL}/servers`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            servers = data.servers;
            renderServers();
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        serverList.innerHTML = `<div class="empty-state">
            <h3>❌ Fehler</h3>
            <p>${error.message}</p>
        </div>`;
    }
}

// Load Templates
async function loadTemplates() {
    try {
        const response = await fetch(`${API_URL}/templates`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            templates = data.templates;
            renderTemplates();
        }
    } catch (error) {
    }
}

// Select Template (global function) - DEFINED BEFORE RENDERING
function dashboardSelectTemplate(templateId) {
    try {
        console.log('>>> INSIDE dashboardSelectTemplate, templateId:', templateId);
        console.log('>>> templates array:', templates);
        selectedTemplate = templates.find(t => t.id === templateId);
        console.log('>>> Found template:', selectedTemplate);
        if (!selectedTemplate) {
            console.error('Template not found:', templateId);
            return;
        }

        // Hide template selection, show config form
        document.getElementById('templateSelectionStep').style.display = 'none';
        document.getElementById('serverConfigStep').style.display = 'block';

        // Show selected template info
        const icon = document.getElementById('selectedTemplateIcon');
        const name = document.getElementById('selectedTemplateName');
        const desc = document.getElementById('selectedTemplateDesc');
        const pluginsContainer = document.getElementById('selectedTemplatePlugins');
        const pluginsList = document.getElementById('selectedTemplatePluginsList');

        icon.textContent = selectedTemplate.icon;
        name.textContent = selectedTemplate.name;
        desc.textContent = selectedTemplate.description;

        // Show recommended plugins
        if (selectedTemplate.recommendedPlugins && selectedTemplate.recommendedPlugins.length > 0) {
            pluginsList.innerHTML = selectedTemplate.recommendedPlugins.map(plugin => 
                `<span style="background: var(--primary-color); color: white; padding: 3px 10px; border-radius: 12px; font-size: 0.8rem;">${plugin}</span>`
            ).join('');
            pluginsContainer.style.display = 'block';
        } else {
            pluginsContainer.style.display = 'none';
        }

        // Apply template
        applyTemplate(selectedTemplate);

        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
        console.error('>>> ERROR in dashboardSelectTemplate:', error);
    }
}

// Make it globally accessible
window.dashboardSelectTemplate = dashboardSelectTemplate;

// Render Templates as Cards
function renderTemplates() {
    const container = document.getElementById('templateCards');
    if (!container || templates.length === 0) return;

    container.innerHTML = templates.map(template => `
        <div class="template-card" data-template-id="${template.id}" style="cursor: pointer;">
            <div style="font-size: 3rem; text-align: center; margin-bottom: 0.5rem;">${template.icon}</div>
            <h4 style="margin: 0 0 0.25rem 0; font-size: 0.95rem; text-align: center;">${template.name}</h4>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-secondary); text-align: center; line-height: 1.3;">${template.description}</p>
            <div style="margin-top: 0.5rem; text-align: center;">
                <span style="background: var(--bg-tertiary); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; color: var(--text-secondary);">
                    ${template.memory} RAM
                </span>
            </div>
        </div>
    `).join('');

    // Add click event listeners after rendering
    container.querySelectorAll('.template-card').forEach(card => {
        card.addEventListener('click', function() {
            const templateId = this.dataset.templateId;
            console.log('Template clicked:', templateId);
            console.log('Calling dashboardSelectTemplate...');
            console.log('dashboardSelectTemplate exists?', typeof dashboardSelectTemplate);
            console.log('About to call dashboardSelectTemplate with:', templateId);
            const result = dashboardSelectTemplate(templateId);
            console.log('dashboardSelectTemplate returned:', result);
        });
    });
}

// Clear Template Selection (global function)
window.clearTemplate = function() {
    selectedTemplate = null;
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Show template selection, hide config form
    document.getElementById('templateSelectionStep').style.display = 'block';
    document.getElementById('serverConfigStep').style.display = 'none';
    
    // Reset form fields to defaults
    serverTypeSelect.value = '';
    serverVersionSelect.innerHTML = '<option value="">Typ zuerst wählen...</option>';
    document.getElementById('serverMemory').value = '2G';
    document.getElementById('serverPort').value = '25565';
    document.getElementById('rconPortCreate').value = '25575';
}

// Apply Template
function applyTemplate(template) {
    // Show template info in the selected template section
    const icon = document.getElementById('selectedTemplateIcon');
    const name = document.getElementById('selectedTemplateName');
    const desc = document.getElementById('selectedTemplateDesc');
    const pluginsContainer = document.getElementById('selectedTemplatePlugins');
    const pluginsList = document.getElementById('selectedTemplatePluginsList');

    if (!icon || !name || !desc) {
        return;
    }

    icon.textContent = template.icon;
    name.textContent = template.name;
    desc.textContent = template.description;

    // Show recommended plugins if available
    if (template.recommendedPlugins && template.recommendedPlugins.length > 0) {
        pluginsList.innerHTML = template.recommendedPlugins.map(plugin => 
            `<span style="background: var(--primary-color); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${plugin}</span>`
        ).join('');
        pluginsContainer.style.display = 'block';
    } else {
        pluginsContainer.style.display = 'none';
    }

    // Auto-fill form fields
    if (template.type) {
        serverTypeSelect.value = template.type;
        // Trigger version load
        serverTypeSelect.dispatchEvent(new Event('change'));
    }
    
    if (template.memory) {
        document.getElementById('serverMemory').value = template.memory;
    }
    
    if (template.port) {
        document.getElementById('serverPort').value = template.port;
    }
    
    if (template.rconPort) {
        document.getElementById('rconPortCreate').value = template.rconPort;
    }
}

// Back to Template Selection (global function)
window.backToTemplateSelection = function() {
    // Clear selection
    selectedTemplate = null;
    document.querySelectorAll('.template-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Hide config form, show template selection
    document.getElementById('serverConfigStep').style.display = 'none';
    document.getElementById('templateSelectionStep').style.display = 'block';
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Render Servers
function renderServers() {
    if (servers.length === 0) {
        serverList.innerHTML = `<div class="empty-state">
            <h3>🎮 Keine Server vorhanden</h3>
            <p>Erstelle deinen ersten Minecraft Server!</p>
            <button class="btn btn-primary" onclick="document.querySelector('[data-tab=create]').click()">
                Server erstellen
            </button>
        </div>`;
        return;
    }

    serverList.innerHTML = servers.map(server => {
        const isProxy = server.type === 'bungeecord' || server.type === 'waterfall';
        const typeIcon = isProxy ? '🌐' : '🎮';
        const typeLabel = isProxy ? 'PROXY' : server.type.toUpperCase();
        
        return `
        <div class="server-list-item" data-server-id="${server.id}">
            <div class="server-list-item-header">
                <span class="server-list-item-name">${typeIcon} ${server.name}</span>
                <span class="server-status-badge ${server.status}">
                    ${server.status === 'running' ? '🟢' : '🔴'}
                </span>
            </div>
            <div class="server-list-item-info">
                <span class="server-list-item-type">${typeLabel}</span>
                <span style="color: var(--text-secondary);">v${server.version}</span>
                <span style="color: var(--text-secondary);">Port: ${server.port}</span>
            </div>
        </div>
    `;
    }).join('');
    
    // Add click event listeners to server items
    document.querySelectorAll('.server-list-item').forEach(item => {
        item.addEventListener('click', () => {
            const serverId = item.getAttribute('data-server-id');
            ServerDetails.showServer(serverId);
        });
    });
}

// Create Server
async function handleCreateServer(e) {
    e.preventDefault();

    const formData = {
        name: document.getElementById('serverName').value,
        type: document.getElementById('serverType').value,
        version: document.getElementById('serverVersion').value,
        host: document.getElementById('serverHost').value,
        port: Number.parseInt(document.getElementById('serverPort').value, 10),
        rconPort: Number.parseInt(document.getElementById('rconPortCreate').value, 10),
        rconPassword: document.getElementById('rconPasswordCreate').value,
        memory: document.getElementById('serverMemory').value
    };

    try {
        createStatus.className = 'status-message loading';
        createStatus.textContent = '🔄 Erstelle Server und lade Dateien herunter... (Das kann einige Minuten dauern)';

        const response = await fetch(`${API_URL}/servers/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(formData)
        });

        const data = await response.json();

        if (data.success) {
            createStatus.className = 'status-message success';
            createStatus.textContent = '✓ Server erfolgreich erstellt!';
            createForm.reset();
            
            setTimeout(() => {
                switchTab('dashboard');
                createStatus.className = 'status-message';
            }, 2000);
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        createStatus.className = 'status-message error';
        createStatus.textContent = `❌ Fehler: ${error.message}`;
    }
}

// Start Server
async function startServer(serverId) {
    try {
        const response = await fetch(`${API_URL}/servers/${serverId}/start`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            await loadServers();
        } else {
            alert(`Fehler: ${data.message}`);
        }
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}

// Stop Server
async function stopServer(serverId) {
    try {
        const response = await fetch(`${API_URL}/servers/${serverId}/stop`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            await loadServers();
        } else {
            alert(`Fehler: ${data.message}`);
        }
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}

// Restart Server
async function restartServer(serverId) {
    if (!confirm('Server wirklich neustarten?')) return;

    try {
        const response = await fetch(`${API_URL}/servers/${serverId}/restart`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            await loadServers();
        } else {
            alert(`Fehler: ${data.message}`);
        }
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}

// Delete Server
async function deleteServer(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!confirm(`Server "${server.name}" wirklich löschen? Alle Daten gehen verloren!`)) return;

    try {
        const response = await fetch(`${API_URL}/servers/${serverId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            await loadServers();
        } else {
            alert(`Fehler: ${data.message}`);
        }
    } catch (error) {
        alert(`Fehler: ${error.message}`);
    }
}

// Show Server Details
function showServerDetails(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');

    modalTitle.textContent = server.name;
    modalBody.innerHTML = `
        <div class="server-info">
            <div class="info-row">
                <span class="info-label">Server ID:</span>
                <span class="info-value">${server.id}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Typ:</span>
                <span class="info-value">${server.type}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Version:</span>
                <span class="info-value">${server.version}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Status:</span>
                <span class="info-value">${server.status}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Port:</span>
                <span class="info-value">${server.port}</span>
            </div>
            <div class="info-row">
                <span class="info-label">RCON Port:</span>
                <span class="info-value">${server.rconPort}</span>
            </div>
            <div class="info-row">
                <span class="info-label">RAM:</span>
                <span class="info-value">${server.memory}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Erstellt:</span>
                <span class="info-value">${new Date(server.createdAt).toLocaleString('de-DE')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Pfad:</span>
                <span class="info-value" style="font-size: 0.8rem; word-break: break-all;">${server.path}</span>
            </div>
        </div>
    `;

    modal.classList.add('active');
}
