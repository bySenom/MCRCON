/**
 * Activity Feed - Timeline of all actions and events
 * Version: 1.0.0
 */

const ActivityFeed = (function() {
    let activities = [];
    let filters = {
        type: 'all',
        serverId: 'all'
    };

    const ACTIVITY_TYPES = {
        SERVER_START: { icon: '▶️', color: '#4CAF50', label: 'Server Started' },
        SERVER_STOP: { icon: '⏹️', color: '#f44336', label: 'Server Stopped' },
        SERVER_RESTART: { icon: '🔄', color: '#ff9800', label: 'Server Restarted' },
        SERVER_CREATE: { icon: '➕', color: '#2196F3', label: 'Server Created' },
        SERVER_DELETE: { icon: '🗑️', color: '#9e9e9e', label: 'Server Deleted' },
        BACKUP_CREATE: { icon: '📦', color: '#00bcd4', label: 'Backup Created' },
        BACKUP_RESTORE: { icon: '📥', color: '#00bcd4', label: 'Backup Restored' },
        PLUGIN_INSTALL: { icon: '🔌', color: '#9c27b0', label: 'Plugin Installed' },
        PLUGIN_REMOVE: { icon: '🔌', color: '#9e9e9e', label: 'Plugin Removed' },
        CONFIG_CHANGE: { icon: '⚙️', color: '#607d8b', label: 'Config Changed' },
        PLAYER_JOIN: { icon: '👤', color: '#4CAF50', label: 'Player Joined' },
        PLAYER_LEAVE: { icon: '👤', color: '#9e9e9e', label: 'Player Left' }
    };

    function initialize() {
        loadActivities();
        startPolling();
        addStyles();
    }

    /**
     * Add activity to feed
     */
    function addActivity(type, message, serverId = null, metadata = {}) {
        const activity = {
            id: generateId(),
            type,
            message,
            serverId,
            metadata,
            timestamp: new Date().toISOString(),
            user: getCurrentUser()
        };
        
        activities.unshift(activity);
        
        // Limit to last 100 activities
        if (activities.length > 100) {
            activities = activities.slice(0, 100);
        }
        
        saveActivities();
        refreshFeed();
    }

    /**
     * Create activity feed widget
     */
    function createFeedWidget() {
        const widget = document.createElement('div');
        widget.className = 'activity-feed-widget';
        widget.id = 'activity-feed-widget';
        
        widget.innerHTML = `
            <div class="activity-feed-header">
                <h3>📝 Recent Activity</h3>
                <div class="activity-feed-filters">
                    <select id="activity-type-filter" onchange="ActivityFeed.setFilter('type', this.value)">
                        <option value="all">All Types</option>
                        <option value="server">Server Actions</option>
                        <option value="backup">Backups</option>
                        <option value="plugin">Plugins</option>
                        <option value="player">Players</option>
                    </select>
                    <select id="activity-server-filter" onchange="ActivityFeed.setFilter('serverId', this.value)">
                        <option value="all">All Servers</option>
                    </select>
                    <button class="activity-refresh-btn" onclick="ActivityFeed.refresh()" title="Refresh">
                        🔄
                    </button>
                </div>
            </div>
            <div class="activity-feed-timeline" id="activity-timeline">
                ${renderTimeline()}
            </div>
        `;
        
        populateServerFilter();
        return widget;
    }

    /**
     * Render timeline
     */
    function renderTimeline() {
        const filtered = getFilteredActivities();
        
        if (filtered.length === 0) {
            return `
                <div class="activity-empty">
                    <p>No activities yet</p>
                    <p class="activity-empty-hint">Actions will appear here as you use the system</p>
                </div>
            `;
        }
        
        return filtered.map(activity => {
            const config = ACTIVITY_TYPES[activity.type] || { icon: '📌', color: '#9e9e9e', label: 'Activity' };
            const timeAgo = getTimeAgo(activity.timestamp);
            const serverName = getServerName(activity.serverId);
            
            return `
                <div class="activity-item" data-activity-id="${activity.id}">
                    <div class="activity-icon" style="background: ${config.color}">
                        ${config.icon}
                    </div>
                    <div class="activity-content">
                        <div class="activity-header">
                            <span class="activity-label">${config.label}</span>
                            ${serverName ? `<span class="activity-server">${serverName}</span>` : ''}
                        </div>
                        <div class="activity-message">${activity.message}</div>
                        <div class="activity-footer">
                            <span class="activity-time">${timeAgo}</span>
                            ${activity.user ? `<span class="activity-user">by ${activity.user}</span>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Get filtered activities
     */
    function getFilteredActivities() {
        let filtered = [...activities];
        
        if (filters.type !== 'all') {
            filtered = filtered.filter(a => {
                if (filters.type === 'server') {
                    return ['SERVER_START', 'SERVER_STOP', 'SERVER_RESTART', 'SERVER_CREATE', 'SERVER_DELETE'].includes(a.type);
                } else if (filters.type === 'backup') {
                    return ['BACKUP_CREATE', 'BACKUP_RESTORE'].includes(a.type);
                } else if (filters.type === 'plugin') {
                    return ['PLUGIN_INSTALL', 'PLUGIN_REMOVE'].includes(a.type);
                } else if (filters.type === 'player') {
                    return ['PLAYER_JOIN', 'PLAYER_LEAVE'].includes(a.type);
                }
                return true;
            });
        }
        
        if (filters.serverId !== 'all') {
            filtered = filtered.filter(a => a.serverId === filters.serverId);
        }
        
        return filtered;
    }

    /**
     * Set filter
     */
    function setFilter(type, value) {
        filters[type] = value;
        refreshFeed();
    }

    /**
     * Refresh feed
     */
    function refreshFeed() {
        const timeline = document.getElementById('activity-timeline');
        if (timeline) {
            timeline.innerHTML = renderTimeline();
        }
    }

    /**
     * Refresh (manual)
     */
    function refresh() {
        if (window.Toast) {
            Toast.info('Refreshing activity feed...');
        }
        refreshFeed();
    }

    /**
     * Populate server filter
     */
    function populateServerFilter() {
        const select = document.getElementById('activity-server-filter');
        if (!select) return;
        
        if (window.dashboardState && window.dashboardState.servers) {
            const options = window.dashboardState.servers.map(server => 
                `<option value="${server.id}">${server.name}</option>`
            ).join('');
            
            select.innerHTML = `<option value="all">All Servers</option>${options}`;
        }
    }

    /**
     * Get server name by ID
     */
    function getServerName(serverId) {
        if (!serverId || !window.dashboardState || !window.dashboardState.servers) return null;
        const server = window.dashboardState.servers.find(s => s.id === serverId);
        return server ? server.name : null;
    }

    /**
     * Get time ago string
     */
    function getTimeAgo(timestamp) {
        const now = new Date();
        const then = new Date(timestamp);
        const seconds = Math.floor((now - then) / 1000);
        
        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return then.toLocaleDateString();
    }

    /**
     * Get current user
     */
    function getCurrentUser() {
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                return parsed.username || 'Unknown';
            } catch (e) {
                return 'Unknown';
            }
        }
        return null;
    }

    /**
     * Generate unique ID
     */
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    /**
     * Save activities to localStorage
     */
    function saveActivities() {
        try {
            localStorage.setItem('activityFeed', JSON.stringify(activities));
        } catch (error) {
            console.error('Failed to save activities:', error);
        }
    }

    /**
     * Load activities from localStorage
     */
    function loadActivities() {
        try {
            const saved = localStorage.getItem('activityFeed');
            if (saved) {
                activities = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load activities:', error);
            activities = [];
        }
    }

    /**
     * Start polling for new activities
     */
    function startPolling() {
        // Poll every 30 seconds
        setInterval(() => {
            refreshFeed();
        }, 30000);
    }

    /**
     * Add styles
     */
    function addStyles() {
        if (document.getElementById('activity-feed-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'activity-feed-styles';
        style.textContent = `
            .activity-feed-widget {
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                overflow: hidden;
            }
            
            .activity-feed-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid var(--border-color);
                background: rgba(0, 0, 0, 0.2);
            }
            
            .activity-feed-header h3 {
                margin: 0;
                font-size: 16px;
            }
            
            .activity-feed-filters {
                display: flex;
                gap: 8px;
            }
            
            .activity-feed-filters select {
                padding: 6px 10px;
                background: var(--input-bg);
                border: 1px solid var(--border-color);
                border-radius: 4px;
                color: var(--text-color);
                font-size: 13px;
            }
            
            .activity-refresh-btn {
                background: none;
                border: 1px solid var(--border-color);
                padding: 6px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .activity-refresh-btn:hover {
                background: var(--hover-bg);
            }
            
            .activity-feed-timeline {
                max-height: 400px;
                overflow-y: auto;
                padding: 12px;
            }
            
            .activity-item {
                display: flex;
                gap: 12px;
                padding: 12px;
                border-radius: 8px;
                transition: background 0.2s;
                margin-bottom: 8px;
            }
            
            .activity-item:hover {
                background: var(--hover-bg);
            }
            
            .activity-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
                flex-shrink: 0;
            }
            
            .activity-content {
                flex: 1;
            }
            
            .activity-header {
                display: flex;
                gap: 8px;
                align-items: center;
                margin-bottom: 4px;
            }
            
            .activity-label {
                font-weight: 600;
                font-size: 14px;
                color: var(--text-color);
            }
            
            .activity-server {
                padding: 2px 8px;
                background: var(--input-bg);
                border-radius: 12px;
                font-size: 12px;
                color: var(--text-secondary);
            }
            
            .activity-message {
                font-size: 13px;
                color: var(--text-secondary);
                margin-bottom: 4px;
            }
            
            .activity-footer {
                display: flex;
                gap: 12px;
                font-size: 12px;
                color: var(--text-secondary);
            }
            
            .activity-time {
                font-weight: 500;
            }
            
            .activity-empty {
                text-align: center;
                padding: 60px 20px;
                color: var(--text-secondary);
            }
            
            .activity-empty-hint {
                font-size: 13px;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        addActivity,
        createFeedWidget,
        setFilter,
        refresh,
        ACTIVITY_TYPES
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ActivityFeed.initialize());
} else {
    ActivityFeed.initialize();
}

// Make globally available
window.ActivityFeed = ActivityFeed;
