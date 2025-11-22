/**
 * Command Palette - Global search with Ctrl+K
 * Version: 1.0.0
 */

const CommandPalette = (function() {
    let isOpen = false;
    let selectedIndex = 0;
    let filteredResults = [];
    let searchIndex = [];

    function initialize() {
        buildSearchIndex();
        addStyles();
        
        // Manual keyboard shortcut (Ctrl+K)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                toggle();
            }
        });
    }

    function toggle() {
        if (isOpen) {
            close();
        } else {
            open();
        }
    }

    function open() {
        if (isOpen) return;
        
        buildSearchIndex(); // Refresh index
        const palette = createPalette();
        document.body.appendChild(palette);
        isOpen = true;
        
        // Focus search input
        setTimeout(() => {
            const input = palette.querySelector('.cmd-palette-input');
            if (input) input.focus();
        }, 100);
        
        // Animate in
        requestAnimationFrame(() => {
            palette.classList.add('cmd-palette-show');
        });
    }

    function close() {
        if (!isOpen) return;
        
        const palette = document.querySelector('.cmd-palette');
        if (palette) {
            palette.classList.remove('cmd-palette-show');
            setTimeout(() => {
                if (palette.parentNode) {
                    palette.parentNode.removeChild(palette);
                }
            }, 200);
        }
        
        isOpen = false;
        selectedIndex = 0;
        filteredResults = [];
    }

    function createPalette() {
        const palette = document.createElement('div');
        palette.className = 'cmd-palette';
        
        palette.innerHTML = `
            <div class="cmd-palette-backdrop"></div>
            <div class="cmd-palette-container">
                <div class="cmd-palette-header">
                    <input 
                        type="text" 
                        class="cmd-palette-input" 
                        placeholder="🔍 Search servers, plugins, settings..."
                        autocomplete="off"
                        spellcheck="false"
                    />
                </div>
                <div class="cmd-palette-results"></div>
                <div class="cmd-palette-footer">
                    <span><kbd>↑↓</kbd> Navigate</span>
                    <span><kbd>Enter</kbd> Select</span>
                    <span><kbd>Esc</kbd> Close</span>
                </div>
            </div>
        `;
        
        // Event listeners
        const backdrop = palette.querySelector('.cmd-palette-backdrop');
        backdrop.onclick = close;
        
        const input = palette.querySelector('.cmd-palette-input');
        input.oninput = (e) => handleSearch(e.target.value);
        input.onkeydown = handleKeyDown;
        
        // Show all results initially
        handleSearch('');
        
        return palette;
    }

    function handleSearch(query) {
        selectedIndex = 0;
        
        if (query.trim() === '') {
            filteredResults = [...searchIndex].slice(0, 10);
        } else {
            filteredResults = fuzzySearch(query, searchIndex);
        }
        
        renderResults();
    }

    function fuzzySearch(query, items) {
        query = query.toLowerCase();
        
        return items
            .map(item => {
                const text = item.title.toLowerCase();
                const matches = [];
                let score = 0;
                let queryIndex = 0;
                
                for (let i = 0; i < text.length && queryIndex < query.length; i++) {
                    if (text[i] === query[queryIndex]) {
                        matches.push(i);
                        score += 10 - queryIndex;
                        queryIndex++;
                    }
                }
                
                if (queryIndex === query.length) {
                    return { ...item, score, matches };
                }
                return null;
            })
            .filter(item => item !== null)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);
    }

    function renderResults() {
        const resultsContainer = document.querySelector('.cmd-palette-results');
        if (!resultsContainer) return;
        
        if (filteredResults.length === 0) {
            resultsContainer.innerHTML = '<div class="cmd-palette-empty">No results found</div>';
            return;
        }
        
        resultsContainer.innerHTML = filteredResults
            .map((result, index) => `
                <div class="cmd-palette-item ${index === selectedIndex ? 'cmd-palette-item-selected' : ''}" 
                     data-index="${index}">
                    <div class="cmd-palette-item-icon">${result.icon}</div>
                    <div class="cmd-palette-item-content">
                        <div class="cmd-palette-item-title">${highlightMatches(result.title, result.matches)}</div>
                        <div class="cmd-palette-item-subtitle">${result.subtitle}</div>
                    </div>
                    ${result.badge ? `<div class="cmd-palette-item-badge">${result.badge}</div>` : ''}
                </div>
            `)
            .join('');
        
        // Add click handlers
        resultsContainer.querySelectorAll('.cmd-palette-item').forEach(item => {
            item.onclick = () => {
                const index = parseInt(item.dataset.index);
                executeAction(filteredResults[index]);
            };
        });
    }

    function highlightMatches(text, matches = []) {
        if (!matches || matches.length === 0) return text;
        
        let result = '';
        for (let i = 0; i < text.length; i++) {
            if (matches.includes(i)) {
                result += `<span class="cmd-palette-highlight">${text[i]}</span>`;
            } else {
                result += text[i];
            }
        }
        return result;
    }

    function handleKeyDown(e) {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, filteredResults.length - 1);
                renderResults();
                scrollToSelected();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                renderResults();
                scrollToSelected();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (filteredResults[selectedIndex]) {
                    executeAction(filteredResults[selectedIndex]);
                }
                break;
                
            case 'Escape':
                e.preventDefault();
                close();
                break;
        }
    }

    function scrollToSelected() {
        const selected = document.querySelector('.cmd-palette-item-selected');
        if (selected) {
            selected.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function executeAction(item) {
        close();
        
        if (item.action) {
            item.action();
        }
    }

    function buildSearchIndex() {
        searchIndex = [];
        
        // Add servers
        if (window.dashboardState && window.dashboardState.servers) {
            window.dashboardState.servers.forEach(server => {
                searchIndex.push({
                    type: 'server',
                    title: server.name,
                    subtitle: `${server.type} ${server.version} • Port ${server.port}`,
                    icon: '🖥️',
                    badge: server.status === 'running' ? '🟢' : '🔴',
                    action: () => {
                        if (window.dashboardState) {
                            window.dashboardState.selectServer(server.id);
                        }
                    }
                });
            });
        }
        
        // Add navigation
        const tabs = [
            { name: 'Dashboard', icon: '📊', tab: 'dashboard' },
            { name: 'Create Server', icon: '➕', tab: 'create' },
            { name: 'Plugins', icon: '🔌', tab: 'plugins' },
            { name: 'Tasks', icon: '⏰', tab: 'tasks' },
            { name: 'Webhooks', icon: '🔔', tab: 'webhooks' },
            { name: 'Logs', icon: '📋', tab: 'logs' }
        ];
        
        tabs.forEach(tab => {
            searchIndex.push({
                type: 'navigation',
                title: tab.name,
                subtitle: 'Navigate to tab',
                icon: tab.icon,
                action: () => {
                    const tabButton = document.querySelector(`[data-tab="${tab.tab}"]`);
                    if (tabButton) tabButton.click();
                }
            });
        });
        
        // Add quick actions
        const actions = [
            {
                title: 'Start All Servers',
                subtitle: 'Start all stopped servers',
                icon: '▶️',
                action: () => {
                    if (window.BulkOperations) {
                        window.BulkOperations.startAll();
                    }
                }
            },
            {
                title: 'Stop All Servers',
                subtitle: 'Stop all running servers',
                icon: '⏹️',
                action: () => {
                    if (window.BulkOperations) {
                        window.BulkOperations.stopAll();
                    }
                }
            },
            {
                title: 'Refresh Server List',
                subtitle: 'Reload all servers',
                icon: '🔄',
                action: () => {
                    if (window.dashboardState) {
                        window.dashboardState.loadServers();
                        if (window.Toast) Toast.info('Refreshing...');
                    }
                }
            },
            {
                title: 'Command History',
                subtitle: 'View RCON command history',
                icon: '📋',
                action: () => {
                    if (window.Clipboard) {
                        window.Clipboard.showHistoryModal();
                    }
                }
            },
            {
                title: 'Keyboard Shortcuts',
                subtitle: 'Show all shortcuts',
                icon: '⌨️',
                action: () => {
                    if (window.KeyboardShortcuts) {
                        window.KeyboardShortcuts.toggleHelp();
                    }
                }
            },
            {
                title: 'Toggle Theme',
                subtitle: 'Switch between light/dark mode',
                icon: '🎨',
                action: () => {
                    if (window.toggleTheme) {
                        window.toggleTheme();
                    }
                }
            }
        ];
        
        actions.forEach(action => {
            searchIndex.push({
                type: 'action',
                ...action
            });
        });
    }

    function addStyles() {
        if (document.getElementById('cmd-palette-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'cmd-palette-styles';
        style.textContent = `
            .cmd-palette {
                position: fixed;
                inset: 0;
                z-index: 10002;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 10vh;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .cmd-palette-show {
                opacity: 1;
            }
            
            .cmd-palette-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
            }
            
            .cmd-palette-container {
                position: relative;
                width: 90%;
                max-width: 600px;
                background: var(--card-bg, #1e1e1e);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                overflow: hidden;
                transform: translateY(-20px);
                transition: transform 0.2s;
            }
            
            .cmd-palette-show .cmd-palette-container {
                transform: translateY(0);
            }
            
            .cmd-palette-header {
                padding: 16px;
                border-bottom: 1px solid var(--border-color, #3a3a3a);
            }
            
            .cmd-palette-input {
                width: 100%;
                background: transparent;
                border: none;
                outline: none;
                font-size: 18px;
                color: var(--text-color, #fff);
                padding: 0;
            }
            
            .cmd-palette-input::placeholder {
                color: var(--text-secondary, #888);
            }
            
            .cmd-palette-results {
                max-height: 400px;
                overflow-y: auto;
            }
            
            .cmd-palette-empty {
                padding: 40px;
                text-align: center;
                color: var(--text-secondary, #888);
            }
            
            .cmd-palette-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 16px;
                cursor: pointer;
                transition: background 0.2s;
                border-left: 3px solid transparent;
            }
            
            .cmd-palette-item:hover,
            .cmd-palette-item-selected {
                background: var(--hover-bg, #2a2a2a);
                border-left-color: var(--primary-color, #4CAF50);
            }
            
            .cmd-palette-item-icon {
                font-size: 24px;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .cmd-palette-item-content {
                flex: 1;
            }
            
            .cmd-palette-item-title {
                font-size: 15px;
                font-weight: 500;
                color: var(--text-color, #fff);
                margin-bottom: 2px;
            }
            
            .cmd-palette-item-subtitle {
                font-size: 13px;
                color: var(--text-secondary, #888);
            }
            
            .cmd-palette-highlight {
                color: var(--primary-color, #4CAF50);
                font-weight: 600;
            }
            
            .cmd-palette-item-badge {
                font-size: 16px;
            }
            
            .cmd-palette-footer {
                display: flex;
                gap: 16px;
                padding: 12px 16px;
                border-top: 1px solid var(--border-color, #3a3a3a);
                font-size: 12px;
                color: var(--text-secondary, #888);
            }
            
            .cmd-palette-footer kbd {
                display: inline-block;
                padding: 2px 6px;
                background: var(--input-bg, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 3px;
                font-family: monospace;
                font-size: 11px;
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        open,
        close,
        toggle
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CommandPalette.initialize());
} else {
    CommandPalette.initialize();
}

// Make globally available
window.CommandPalette = CommandPalette;
