/**
 * Tag Manager - Server tagging and favorites system
 * Version: 1.0.0
 */

const TagManager = (function() {
    let tags = [];
    let favorites = new Set();

    function initialize() {
        loadFromStorage();
        addStyles();
    }

    /**
     * Add tag to a server
     */
    function addTag(serverId, tag) {
        if (!serverId || !tag) return;
        
        tag = tag.trim().toLowerCase();
        if (tag === '') return;
        
        // Get or create server tags
        const server = getServerById(serverId);
        if (!server) return;
        
        if (!server.tags) {
            server.tags = [];
        }
        
        if (!server.tags.includes(tag)) {
            server.tags.push(tag);
            updateServer(server);
            
            // Add to global tags list
            if (!tags.includes(tag)) {
                tags.push(tag);
                saveToStorage();
            }
            
            if (window.Toast) {
                Toast.success(`Tag "${tag}" hinzugefügt!`);
            }
            
            refreshUI();
        }
    }

    /**
     * Remove tag from server
     */
    function removeTag(serverId, tag) {
        const server = getServerById(serverId);
        if (!server || !server.tags) return;
        
        server.tags = server.tags.filter(t => t !== tag);
        updateServer(server);
        refreshUI();
        
        if (window.Toast) {
            Toast.info(`Tag "${tag}" entfernt`);
        }
    }

    /**
     * Toggle favorite status
     */
    function toggleFavorite(serverId) {
        if (favorites.has(serverId)) {
            favorites.delete(serverId);
            if (window.Toast) {
                Toast.info('Aus Favoriten entfernt');
            }
        } else {
            favorites.add(serverId);
            if (window.Toast) {
                Toast.success('Zu Favoriten hinzugefügt!');
            }
        }
        
        saveToStorage();
        refreshUI();
    }

    /**
     * Check if server is favorite
     */
    function isFavorite(serverId) {
        return favorites.has(serverId);
    }

    /**
     * Get all tags
     */
    function getAllTags() {
        return [...tags];
    }

    /**
     * Get servers by tag
     */
    function getServersByTag(tag) {
        if (!window.dashboardState || !window.dashboardState.servers) return [];
        
        return window.dashboardState.servers.filter(server => 
            server.tags && server.tags.includes(tag)
        );
    }

    /**
     * Get favorite servers
     */
    function getFavoriteServers() {
        if (!window.dashboardState || !window.dashboardState.servers) return [];
        
        return window.dashboardState.servers.filter(server => 
            favorites.has(server.id)
        );
    }

    /**
     * Create tag input UI
     */
    function createTagInput(serverId) {
        const container = document.createElement('div');
        container.className = 'tag-input-container';
        
        const server = getServerById(serverId);
        const serverTags = server && server.tags ? server.tags : [];
        
        container.innerHTML = `
            <div class="tag-list">
                ${serverTags.map(tag => `
                    <span class="tag-badge">
                        ${escapeHtml(tag)}
                        <button class="tag-remove" onclick="TagManager.removeTag('${serverId}', '${escapeHtml(tag)}')">×</button>
                    </span>
                `).join('')}
            </div>
            <div class="tag-input-wrapper">
                <input 
                    type="text" 
                    class="tag-input" 
                    placeholder="+ Add tag..."
                    data-server-id="${serverId}"
                />
                <button class="tag-suggestions-btn" title="Popular tags">🏷️</button>
            </div>
        `;
        
        const input = container.querySelector('.tag-input');
        input.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const tag = input.value.trim();
                if (tag) {
                    addTag(serverId, tag);
                    input.value = '';
                }
            }
        };
        
        const suggestionsBtn = container.querySelector('.tag-suggestions-btn');
        suggestionsBtn.onclick = () => showTagSuggestions(serverId, input);
        
        return container;
    }

    /**
     * Create favorite button
     */
    function createFavoriteButton(serverId) {
        const button = document.createElement('button');
        button.className = 'favorite-btn';
        button.innerHTML = isFavorite(serverId) ? '⭐' : '☆';
        button.title = isFavorite(serverId) ? 'Remove from favorites' : 'Add to favorites';
        button.onclick = (e) => {
            e.stopPropagation();
            toggleFavorite(serverId);
            button.innerHTML = isFavorite(serverId) ? '⭐' : '☆';
            button.title = isFavorite(serverId) ? 'Remove from favorites' : 'Add to favorites';
        };
        return button;
    }

    /**
     * Create tag filter UI
     */
    function createTagFilter() {
        const container = document.createElement('div');
        container.className = 'tag-filter-container';
        
        const allTags = getAllTags();
        
        container.innerHTML = `
            <div class="tag-filter-header">
                <span class="tag-filter-label">🏷️ Filter:</span>
                <button class="tag-filter-btn ${!getActiveFilter() ? 'active' : ''}" 
                        onclick="TagManager.setFilter(null)">
                    All
                </button>
                <button class="tag-filter-btn ${getActiveFilter() === 'favorites' ? 'active' : ''}" 
                        onclick="TagManager.setFilter('favorites')">
                    ⭐ Favorites
                </button>
                ${allTags.map(tag => `
                    <button class="tag-filter-btn ${getActiveFilter() === tag ? 'active' : ''}" 
                            onclick="TagManager.setFilter('${escapeHtml(tag)}')">
                        ${escapeHtml(tag)}
                    </button>
                `).join('')}
            </div>
        `;
        
        return container;
    }

    /**
     * Show tag suggestions
     */
    function showTagSuggestions(serverId, inputElement) {
        const suggestions = [
            'production', 'development', 'test', 'staging',
            'public', 'private', 'modded', 'vanilla',
            'survival', 'creative', 'minigames', 'pvp'
        ];
        
        const existingTags = getServerById(serverId)?.tags || [];
        const available = suggestions.filter(s => !existingTags.includes(s));
        
        if (available.length === 0) {
            if (window.Toast) Toast.info('No more suggestions');
            return;
        }
        
        const menu = document.createElement('div');
        menu.className = 'tag-suggestions-menu';
        menu.innerHTML = available.map(tag => `
            <div class="tag-suggestion-item" data-tag="${tag}">
                🏷️ ${tag}
            </div>
        `).join('');
        
        menu.querySelectorAll('.tag-suggestion-item').forEach(item => {
            item.onclick = () => {
                addTag(serverId, item.dataset.tag);
                menu.remove();
            };
        });
        
        // Position menu
        const rect = inputElement.getBoundingClientRect();
        menu.style.position = 'absolute';
        menu.style.top = (rect.bottom + 4) + 'px';
        menu.style.left = rect.left + 'px';
        menu.style.width = rect.width + 'px';
        
        document.body.appendChild(menu);
        
        // Close on click outside
        setTimeout(() => {
            const closeHandler = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeHandler);
                }
            };
            document.addEventListener('click', closeHandler);
        }, 100);
    }

    /**
     * Set active filter
     */
    function setFilter(filter) {
        localStorage.setItem('tagFilter', filter || '');
        refreshUI();
    }

    /**
     * Get active filter
     */
    function getActiveFilter() {
        return localStorage.getItem('tagFilter') || null;
    }

    /**
     * Filter servers based on active filter
     */
    function filterServers(servers) {
        const filter = getActiveFilter();
        
        if (!filter) return servers;
        
        if (filter === 'favorites') {
            return servers.filter(s => favorites.has(s.id));
        }
        
        return servers.filter(s => s.tags && s.tags.includes(filter));
    }

    /**
     * Refresh UI
     */
    function refreshUI() {
        if (window.dashboardState && window.dashboardState.loadServers) {
            window.dashboardState.loadServers();
        }
    }

    /**
     * Save to localStorage
     */
    function saveToStorage() {
        try {
            localStorage.setItem('serverTags', JSON.stringify(tags));
            localStorage.setItem('serverFavorites', JSON.stringify([...favorites]));
        } catch (error) {
            console.error('Failed to save tags:', error);
        }
    }

    /**
     * Load from localStorage
     */
    function loadFromStorage() {
        try {
            const savedTags = localStorage.getItem('serverTags');
            if (savedTags) {
                tags = JSON.parse(savedTags);
            }
            
            const savedFavorites = localStorage.getItem('serverFavorites');
            if (savedFavorites) {
                favorites = new Set(JSON.parse(savedFavorites));
            }
        } catch (error) {
            console.error('Failed to load tags:', error);
        }
    }

    /**
     * Update server (backend sync)
     */
    async function updateServer(server) {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/servers/${server.id}/tags`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ tags: server.tags })
            });
            
            if (!response.ok) {
                console.error('Failed to update server tags');
            }
        } catch (error) {
            console.error('Error updating server tags:', error);
        }
    }

    /**
     * Get server by ID
     */
    function getServerById(serverId) {
        if (!window.dashboardState || !window.dashboardState.servers) return null;
        return window.dashboardState.servers.find(s => s.id === serverId);
    }

    /**
     * Escape HTML
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Add styles
     */
    function addStyles() {
        if (document.getElementById('tag-manager-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'tag-manager-styles';
        style.textContent = `
            .tag-input-container {
                margin: 12px 0;
            }
            
            .tag-list {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                margin-bottom: 8px;
            }
            
            .tag-badge {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 4px 8px;
                background: var(--primary-color, #4CAF50);
                color: white;
                border-radius: 12px;
                font-size: 12px;
                font-weight: 500;
            }
            
            .tag-remove {
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 0;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: background 0.2s;
            }
            
            .tag-remove:hover {
                background: rgba(255, 255, 255, 0.2);
            }
            
            .tag-input-wrapper {
                display: flex;
                gap: 4px;
            }
            
            .tag-input {
                flex: 1;
                padding: 6px 10px;
                background: var(--input-bg, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 4px;
                color: var(--text-color, #fff);
                font-size: 13px;
            }
            
            .tag-suggestions-btn {
                padding: 6px 10px;
                background: var(--input-bg, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .tag-suggestions-btn:hover {
                background: var(--hover-bg, #333);
            }
            
            .tag-suggestions-menu {
                background: var(--card-bg, #1e1e1e);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
            }
            
            .tag-suggestion-item {
                padding: 8px 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .tag-suggestion-item:hover {
                background: var(--hover-bg, #2a2a2a);
            }
            
            .favorite-btn {
                position: absolute;
                top: 8px;
                left: 8px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 18px;
                transition: all 0.2s;
                z-index: 10;
            }
            
            .favorite-btn:hover {
                background: rgba(0, 0, 0, 0.8);
                transform: scale(1.1);
            }
            
            .tag-filter-container {
                margin-bottom: 20px;
            }
            
            .tag-filter-header {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
                padding: 12px;
                background: var(--card-bg, #1e1e1e);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 8px;
            }
            
            .tag-filter-label {
                font-weight: 600;
                color: var(--text-secondary, #888);
                margin-right: 8px;
            }
            
            .tag-filter-btn {
                padding: 6px 12px;
                background: var(--input-bg, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 16px;
                color: var(--text-color, #fff);
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s;
            }
            
            .tag-filter-btn:hover {
                background: var(--hover-bg, #333);
            }
            
            .tag-filter-btn.active {
                background: var(--primary-color, #4CAF50);
                border-color: var(--primary-color, #4CAF50);
                color: white;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        addTag,
        removeTag,
        toggleFavorite,
        isFavorite,
        getAllTags,
        getServersByTag,
        getFavoriteServers,
        createTagInput,
        createFavoriteButton,
        createTagFilter,
        setFilter,
        getActiveFilter,
        filterServers
    };
})();

// Auto-initialize
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => TagManager.initialize());
} else {
    TagManager.initialize();
}

// Make globally available
window.TagManager = TagManager;
