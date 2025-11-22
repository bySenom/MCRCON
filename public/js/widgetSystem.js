/**
 * Widget System - Customizable dashboard widgets with drag & drop
 * Version: 1.0.0
 */

const WidgetSystem = (function() {
    let widgets = [];
    let layout = [];
    let isDragging = false;
    let draggedWidget = null;

    const WIDGET_TYPES = {
        SERVER_STATUS: 'server_status',
        SYSTEM_STATS: 'system_stats',
        RECENT_LOGS: 'recent_logs',
        QUICK_ACTIONS: 'quick_actions'
    };

    function initialize() {
        loadLayout();
        addStyles();
        
        // Ctrl+W removed to avoid browser conflicts (closes tab)
        // Users can use the "⚙️ Widgets anpassen" button instead
    }

    /**
     * Create widget container
     */
    function createWidgetContainer() {
        const container = document.createElement('div');
        container.className = 'widget-grid';
        container.id = 'widget-container';
        
        renderWidgets(container);
        return container;
    }

    /**
     * Render all widgets
     */
    function renderWidgets(container) {
        container.innerHTML = '';
        
        if (layout.length === 0) {
            // Default layout
            layout = [
                { id: 'widget-1', type: WIDGET_TYPES.SERVER_STATUS, x: 0, y: 0, w: 2, h: 1 },
                { id: 'widget-2', type: WIDGET_TYPES.SYSTEM_STATS, x: 2, y: 0, w: 1, h: 1 },
                { id: 'widget-3', type: WIDGET_TYPES.RECENT_LOGS, x: 0, y: 1, w: 2, h: 2 },
                { id: 'widget-4', type: WIDGET_TYPES.QUICK_ACTIONS, x: 2, y: 1, w: 1, h: 2 }
            ];
        }
        
        layout.forEach(widgetConfig => {
            const widget = createWidget(widgetConfig);
            container.appendChild(widget);
        });
    }

    /**
     * Create individual widget
     */
    function createWidget(config) {
        const widget = document.createElement('div');
        widget.className = 'dashboard-widget';
        widget.dataset.widgetId = config.id;
        widget.dataset.widgetType = config.type;
        
        // Apply grid position
        widget.style.gridColumn = `span ${config.w}`;
        widget.style.gridRow = `span ${config.h}`;
        
        // Widget header
        const header = document.createElement('div');
        header.className = 'widget-header';
        header.innerHTML = `
            <h3 class="widget-title">${getWidgetTitle(config.type)}</h3>
            <div class="widget-actions">
                <button class="widget-action-btn" onclick="WidgetSystem.refreshWidget('${config.id}')" title="Refresh">
                    🔄
                </button>
                <button class="widget-action-btn widget-drag-handle" title="Move">
                    ⋮⋮
                </button>
            </div>
        `;
        
        // Widget body
        const body = document.createElement('div');
        body.className = 'widget-body';
        renderWidgetContent(body, config.type);
        
        widget.appendChild(header);
        widget.appendChild(body);
        
        // Make draggable
        makeDraggable(widget, config);
        
        return widget;
    }

    /**
     * Render widget content based on type
     */
    function renderWidgetContent(body, type) {
        switch (type) {
            case WIDGET_TYPES.SERVER_STATUS:
                renderServerStatusWidget(body);
                break;
            case WIDGET_TYPES.SYSTEM_STATS:
                renderSystemStatsWidget(body);
                break;
            case WIDGET_TYPES.RECENT_LOGS:
                renderRecentLogsWidget(body);
                break;
            case WIDGET_TYPES.QUICK_ACTIONS:
                renderQuickActionsWidget(body);
                break;
        }
    }

    /**
     * Server Status Widget
     */
    function renderServerStatusWidget(body) {
        body.innerHTML = '<div class="widget-loading">Loading...</div>';
        
        if (window.dashboardState && window.dashboardState.servers) {
            const servers = window.dashboardState.servers;
            const running = servers.filter(s => s.status === 'running').length;
            const stopped = servers.filter(s => s.status === 'stopped').length;
            
            body.innerHTML = `
                <div class="widget-stats-grid">
                    <div class="widget-stat">
                        <div class="widget-stat-value">${servers.length}</div>
                        <div class="widget-stat-label">Total Servers</div>
                    </div>
                    <div class="widget-stat">
                        <div class="widget-stat-value" style="color: var(--success-color);">${running}</div>
                        <div class="widget-stat-label">Running</div>
                    </div>
                    <div class="widget-stat">
                        <div class="widget-stat-value" style="color: var(--danger-color);">${stopped}</div>
                        <div class="widget-stat-label">Stopped</div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * System Stats Widget
     */
    function renderSystemStatsWidget(body) {
        body.innerHTML = `
            <div class="widget-stats-list">
                <div class="widget-stat-item">
                    <span class="widget-stat-label">CPU Usage</span>
                    <div class="widget-progress-bar">
                        <div class="widget-progress-fill" id="cpu-progress" style="width: 0%"></div>
                    </div>
                    <span class="widget-stat-value" id="cpu-value">-</span>
                </div>
                <div class="widget-stat-item">
                    <span class="widget-stat-label">RAM Usage</span>
                    <div class="widget-progress-bar">
                        <div class="widget-progress-fill" id="ram-progress" style="width: 0%"></div>
                    </div>
                    <span class="widget-stat-value" id="ram-value">-</span>
                </div>
                <div class="widget-stat-item">
                    <span class="widget-stat-label">Disk Usage</span>
                    <div class="widget-progress-bar">
                        <div class="widget-progress-fill" id="disk-progress" style="width: 0%"></div>
                    </div>
                    <span class="widget-stat-value" id="disk-value">-</span>
                </div>
            </div>
        `;
        
        // Fetch system stats
        fetchSystemStats();
    }

    /**
     * Recent Logs Widget
     */
    function renderRecentLogsWidget(body) {
        body.innerHTML = `
            <div class="widget-logs">
                <div class="widget-log-item">
                    <span class="widget-log-time">10:30:45</span>
                    <span class="widget-log-level widget-log-info">INFO</span>
                    <span class="widget-log-message">Server started successfully</span>
                </div>
                <div class="widget-log-item">
                    <span class="widget-log-time">10:29:12</span>
                    <span class="widget-log-level widget-log-warning">WARN</span>
                    <span class="widget-log-message">High memory usage detected</span>
                </div>
                <div class="widget-log-item">
                    <span class="widget-log-time">10:25:03</span>
                    <span class="widget-log-level widget-log-info">INFO</span>
                    <span class="widget-log-message">Backup completed</span>
                </div>
                <div class="widget-empty-state">
                    <p>Real-time logs coming soon...</p>
                    <button class="btn btn-primary btn-sm" onclick="document.querySelector('[data-tab=\\'logs\\']')?.click()">
                        View All Logs
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Quick Actions Widget
     */
    function renderQuickActionsWidget(body) {
        body.innerHTML = `
            <div class="widget-actions-grid">
                <button class="widget-action-card" onclick="document.querySelector('[data-tab=\\'create\\']')?.click()">
                    <div class="widget-action-icon">➕</div>
                    <div class="widget-action-label">New Server</div>
                </button>
                <button class="widget-action-card" onclick="BulkOperations?.startAll()">
                    <div class="widget-action-icon">▶️</div>
                    <div class="widget-action-label">Start All</div>
                </button>
                <button class="widget-action-card" onclick="BulkOperations?.stopAll()">
                    <div class="widget-action-icon">⏹️</div>
                    <div class="widget-action-label">Stop All</div>
                </button>
                <button class="widget-action-card" onclick="CommandPalette?.open()">
                    <div class="widget-action-icon">🔍</div>
                    <div class="widget-action-label">Search</div>
                </button>
                <button class="widget-action-card" onclick="Clipboard?.showHistoryModal()">
                    <div class="widget-action-icon">📋</div>
                    <div class="widget-action-label">History</div>
                </button>
                <button class="widget-action-card" onclick="KeyboardShortcuts?.toggleHelp()">
                    <div class="widget-action-icon">⌨️</div>
                    <div class="widget-action-label">Shortcuts</div>
                </button>
            </div>
        `;
    }

    /**
     * Fetch system stats
     */
    async function fetchSystemStats() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/system/stats', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            
            if (data.success) {
                const cpu = data.cpu.usage.toFixed(1);
                const ram = data.memory.usedPercentage.toFixed(1);
                const disk = data.disk.usedPercentage.toFixed(1);
                
                document.getElementById('cpu-progress').style.width = cpu + '%';
                document.getElementById('cpu-value').textContent = cpu + '%';
                
                document.getElementById('ram-progress').style.width = ram + '%';
                document.getElementById('ram-value').textContent = ram + '%';
                
                document.getElementById('disk-progress').style.width = disk + '%';
                document.getElementById('disk-value').textContent = disk + '%';
                
                // Color coding
                setProgressColor('cpu-progress', cpu);
                setProgressColor('ram-progress', ram);
                setProgressColor('disk-progress', disk);
            }
        } catch (error) {
            console.error('Failed to fetch system stats:', error);
        }
    }

    /**
     * Set progress bar color based on value
     */
    function setProgressColor(id, value) {
        const element = document.getElementById(id);
        if (!element) return;
        
        if (value < 60) {
            element.style.background = 'var(--success-color)';
        } else if (value < 80) {
            element.style.background = 'var(--warning-color)';
        } else {
            element.style.background = 'var(--danger-color)';
        }
    }

    /**
     * Get widget title
     */
    function getWidgetTitle(type) {
        const titles = {
            [WIDGET_TYPES.SERVER_STATUS]: '🖥️ Server Overview',
            [WIDGET_TYPES.SYSTEM_STATS]: '📊 System Resources',
            [WIDGET_TYPES.RECENT_LOGS]: '📋 Recent Activity',
            [WIDGET_TYPES.QUICK_ACTIONS]: '⚡ Quick Actions'
        };
        return titles[type] || 'Widget';
    }

    /**
     * Refresh widget
     */
    function refreshWidget(widgetId) {
        const widget = document.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widget) return;
        
        const config = layout.find(w => w.id === widgetId);
        if (!config) return;
        
        const body = widget.querySelector('.widget-body');
        renderWidgetContent(body, config.type);
        
        if (window.Toast) {
            Toast.success('Widget refreshed!');
        }
    }

    /**
     * Toggle widget editor
     */
    function toggleWidgetEditor() {
        const editor = document.getElementById('widget-editor');
        if (editor) {
            editor.remove();
        } else {
            showWidgetEditor();
        }
    }

    /**
     * Show widget editor
     */
    function showWidgetEditor() {
        const editor = document.createElement('div');
        editor.id = 'widget-editor';
        editor.className = 'widget-editor';
        
        editor.innerHTML = `
            <div class="widget-editor-backdrop"></div>
            <div class="widget-editor-panel">
                <div class="widget-editor-header">
                    <h3>⚙️ Customize Dashboard</h3>
                    <button class="widget-editor-close" onclick="WidgetSystem.toggleWidgetEditor()">✕</button>
                </div>
                <div class="widget-editor-body">
                    <p class="widget-editor-hint">
                        💡 Drag widgets by their handle (⋮⋮) to rearrange
                    </p>
                    <div class="widget-editor-actions">
                        <button class="btn btn-primary" onclick="WidgetSystem.resetLayout()">
                            🔄 Reset to Default
                        </button>
                        <button class="btn btn-secondary" onclick="WidgetSystem.toggleWidgetEditor()">
                            ✓ Done
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(editor);
        
        // Close on backdrop click
        editor.querySelector('.widget-editor-backdrop').onclick = () => {
            editor.remove();
        };
    }

    /**
     * Reset layout to default
     */
    function resetLayout() {
        layout = [];
        saveLayout();
        
        const container = document.getElementById('widget-container');
        if (container) {
            renderWidgets(container);
        }
        
        if (window.Toast) {
            Toast.success('Layout reset to default');
        }
    }

    /**
     * Make widget draggable
     */
    function makeDraggable(widget, config) {
        const handle = widget.querySelector('.widget-drag-handle');
        if (!handle) return;
        
        handle.style.cursor = 'grab';
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isDragging = true;
            draggedWidget = { element: widget, config };
            handle.style.cursor = 'grabbing';
            widget.classList.add('widget-dragging');
        });
    }

    /**
     * Save layout to localStorage
     */
    function saveLayout() {
        try {
            localStorage.setItem('widgetLayout', JSON.stringify(layout));
        } catch (error) {
            console.error('Failed to save widget layout:', error);
        }
    }

    /**
     * Load layout from localStorage
     */
    function loadLayout() {
        try {
            const saved = localStorage.getItem('widgetLayout');
            if (saved) {
                layout = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load widget layout:', error);
            layout = [];
        }
    }

    /**
     * Add styles
     */
    function addStyles() {
        if (document.getElementById('widget-system-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'widget-system-styles';
        style.textContent = `
            .widget-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .dashboard-widget {
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                overflow: hidden;
                transition: all 0.3s;
            }
            
            .dashboard-widget:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            }
            
            .widget-dragging {
                opacity: 0.5;
                cursor: grabbing !important;
            }
            
            .widget-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-color);
                background: rgba(0, 0, 0, 0.2);
            }
            
            .widget-title {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            
            .widget-actions {
                display: flex;
                gap: 8px;
            }
            
            .widget-action-btn {
                background: none;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s;
                font-size: 16px;
            }
            
            .widget-action-btn:hover {
                background: var(--hover-bg);
                color: var(--text-color);
            }
            
            .widget-body {
                padding: 20px;
            }
            
            .widget-stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
            }
            
            .widget-stat {
                text-align: center;
            }
            
            .widget-stat-value {
                font-size: 32px;
                font-weight: bold;
                color: var(--primary-color);
            }
            
            .widget-stat-label {
                font-size: 13px;
                color: var(--text-secondary);
                margin-top: 4px;
            }
            
            .widget-stats-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .widget-stat-item {
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .widget-stat-item .widget-stat-label {
                min-width: 100px;
                font-size: 13px;
            }
            
            .widget-progress-bar {
                flex: 1;
                height: 8px;
                background: var(--input-bg);
                border-radius: 4px;
                overflow: hidden;
            }
            
            .widget-progress-fill {
                height: 100%;
                background: var(--primary-color);
                transition: width 0.3s;
            }
            
            .widget-stat-item .widget-stat-value {
                min-width: 50px;
                text-align: right;
                font-size: 14px;
                font-weight: 600;
            }
            
            .widget-logs {
                display: flex;
                flex-direction: column;
                gap: 8px;
                max-height: 300px;
                overflow-y: auto;
            }
            
            .widget-log-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px;
                background: var(--input-bg);
                border-radius: 6px;
                font-size: 12px;
            }
            
            .widget-log-time {
                color: var(--text-secondary);
                font-family: monospace;
            }
            
            .widget-log-level {
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 600;
                font-size: 10px;
            }
            
            .widget-log-info {
                background: var(--info-color);
                color: white;
            }
            
            .widget-log-warning {
                background: var(--warning-color);
                color: white;
            }
            
            .widget-log-message {
                flex: 1;
                color: var(--text-color);
            }
            
            .widget-actions-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 12px;
            }
            
            .widget-action-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 20px;
                background: var(--input-bg);
                border: 1px solid var(--border-color);
                border-radius: 8px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .widget-action-card:hover {
                background: var(--hover-bg);
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }
            
            .widget-action-icon {
                font-size: 32px;
            }
            
            .widget-action-label {
                font-size: 13px;
                font-weight: 500;
                color: var(--text-color);
            }
            
            .widget-editor {
                position: fixed;
                inset: 0;
                z-index: 10003;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .widget-editor-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
            }
            
            .widget-editor-panel {
                position: relative;
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                width: 90%;
                max-width: 500px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            }
            
            .widget-editor-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid var(--border-color);
            }
            
            .widget-editor-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--text-color);
                padding: 0;
                width: 32px;
                height: 32px;
            }
            
            .widget-editor-body {
                padding: 20px;
            }
            
            .widget-editor-hint {
                padding: 12px;
                background: rgba(255, 193, 7, 0.1);
                border-left: 3px solid var(--warning-color);
                border-radius: 4px;
                margin-bottom: 20px;
            }
            
            .widget-editor-actions {
                display: flex;
                gap: 12px;
                justify-content: flex-end;
            }
            
            .widget-empty-state {
                text-align: center;
                padding: 20px;
                color: var(--text-secondary);
            }
            
            .widget-loading {
                text-align: center;
                padding: 40px;
                color: var(--text-secondary);
            }
            
            @media (max-width: 1024px) {
                .widget-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            
            @media (max-width: 768px) {
                .widget-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        createWidgetContainer,
        refreshWidget,
        toggleWidgetEditor,
        resetLayout,
        WIDGET_TYPES
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => WidgetSystem.initialize());
} else {
    WidgetSystem.initialize();
}

// Make globally available
window.WidgetSystem = WidgetSystem;
