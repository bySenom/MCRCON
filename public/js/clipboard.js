/**
 * Clipboard Manager - Copy to clipboard with toast notifications
 * Version: 1.0.0
 */

const Clipboard = (function() {
    let commandHistory = [];
    const MAX_HISTORY = 50;

    function initialize() {
        loadCommandHistory();
        addCopyButtons();
    }

    /**
     * Copy text to clipboard
     */
    async function copy(text, successMessage = 'Kopiert!') {
        try {
            await navigator.clipboard.writeText(text);
            if (window.Toast) {
                Toast.success(successMessage);
            }
            return true;
        } catch (error) {
            // Fallback for older browsers
            return fallbackCopy(text, successMessage);
        }
    }

    /**
     * Fallback copy method for older browsers
     */
    function fallbackCopy(text, successMessage) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            document.body.removeChild(textarea);
            if (window.Toast) {
                Toast.success(successMessage);
            }
            return true;
        } catch (error) {
            document.body.removeChild(textarea);
            if (window.Toast) {
                Toast.error('Kopieren fehlgeschlagen');
            }
            return false;
        }
    }

    /**
     * Copy server IP with port
     */
    function copyServerIP(server) {
        const ip = `localhost:${server.port}`;
        copy(ip, `Server IP kopiert: ${ip}`);
    }

    /**
     * Copy RCON connection details
     */
    function copyRCONDetails(server) {
        const details = `Host: localhost:${server.rconPort}\nPassword: ${server.rconPassword}`;
        copy(details, 'RCON Details kopiert!');
    }

    /**
     * Add command to history
     */
    function addToHistory(command) {
        if (!command || command.trim() === '') return;
        
        // Remove duplicate if exists
        commandHistory = commandHistory.filter(cmd => cmd !== command);
        
        // Add to beginning
        commandHistory.unshift(command);
        
        // Limit history size
        if (commandHistory.length > MAX_HISTORY) {
            commandHistory = commandHistory.slice(0, MAX_HISTORY);
        }
        
        saveCommandHistory();
    }

    /**
     * Get command history
     */
    function getHistory() {
        return [...commandHistory];
    }

    /**
     * Clear command history
     */
    function clearHistory() {
        commandHistory = [];
        saveCommandHistory();
        if (window.Toast) {
            Toast.info('Command History gelöscht');
        }
    }

    /**
     * Copy command from history
     */
    function copyFromHistory(index) {
        if (index >= 0 && index < commandHistory.length) {
            copy(commandHistory[index], 'Command kopiert!');
        }
    }

    /**
     * Show command history modal
     */
    function showHistoryModal() {
        const modal = createHistoryModal();
        document.body.appendChild(modal);
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('clipboard-modal-show');
        });
    }

    /**
     * Create command history modal
     */
    function createHistoryModal() {
        const modal = document.createElement('div');
        modal.className = 'clipboard-modal';
        
        modal.innerHTML = `
            <div class="clipboard-modal-backdrop"></div>
            <div class="clipboard-modal-content">
                <div class="clipboard-modal-header">
                    <h3>📋 Command History</h3>
                    <button class="clipboard-modal-close" onclick="this.closest('.clipboard-modal').remove()">✕</button>
                </div>
                <div class="clipboard-modal-body">
                    ${commandHistory.length === 0 ? 
                        '<p class="clipboard-empty">Keine Commands in der History</p>' :
                        '<div class="clipboard-history-list">' +
                        commandHistory.map((cmd, index) => `
                            <div class="clipboard-history-item">
                                <code class="clipboard-history-command">${escapeHtml(cmd)}</code>
                                <button class="clipboard-history-copy" onclick="Clipboard.copyFromHistory(${index})">
                                    📋 Copy
                                </button>
                            </div>
                        `).join('') +
                        '</div>'
                    }
                </div>
                <div class="clipboard-modal-footer">
                    <button class="btn btn-secondary" onclick="Clipboard.clearHistory(); this.closest('.clipboard-modal').remove();">
                        🗑️ Clear History
                    </button>
                    <button class="btn btn-primary" onclick="this.closest('.clipboard-modal').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        // Close on backdrop click
        modal.querySelector('.clipboard-modal-backdrop').onclick = () => {
            modal.remove();
        };
        
        addModalStyles();
        return modal;
    }

    /**
     * Add copy buttons to server cards
     */
    function addCopyButtons() {
        // This will be called after server cards are rendered
        // Dashboard.js will need to call this after rendering
    }

    /**
     * Create copy button for server card
     */
    function createCopyButton(server) {
        const button = document.createElement('button');
        button.className = 'clipboard-copy-btn';
        button.innerHTML = '📋';
        button.title = 'Copy Server IP';
        button.onclick = (e) => {
            e.stopPropagation();
            copyServerIP(server);
        };
        return button;
    }

    /**
     * Save command history to localStorage
     */
    function saveCommandHistory() {
        try {
            localStorage.setItem('commandHistory', JSON.stringify(commandHistory));
        } catch (error) {
            console.error('Failed to save command history:', error);
        }
    }

    /**
     * Load command history from localStorage
     */
    function loadCommandHistory() {
        try {
            const saved = localStorage.getItem('commandHistory');
            if (saved) {
                commandHistory = JSON.parse(saved);
            }
        } catch (error) {
            console.error('Failed to load command history:', error);
            commandHistory = [];
        }
    }

    /**
     * Escape HTML for safe display
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Add modal styles
     */
    function addModalStyles() {
        if (document.getElementById('clipboard-styles')) return;

        const style = document.createElement('style');
        style.id = 'clipboard-styles';
        style.textContent = `
            .clipboard-modal {
                position: fixed;
                inset: 0;
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.3s;
            }

            .clipboard-modal-show {
                opacity: 1;
            }

            .clipboard-modal-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(4px);
            }

            .clipboard-modal-content {
                position: relative;
                background: var(--card-bg, #1e1e1e);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 12px;
                width: 90%;
                max-width: 600px;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            }

            .clipboard-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid var(--border-color, #3a3a3a);
            }

            .clipboard-modal-header h3 {
                margin: 0;
                font-size: 20px;
            }

            .clipboard-modal-close {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: var(--text-color, #fff);
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background 0.2s;
            }

            .clipboard-modal-close:hover {
                background: var(--hover-bg, #2a2a2a);
            }

            .clipboard-modal-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }

            .clipboard-empty {
                text-align: center;
                color: var(--text-secondary, #888);
                padding: 40px 20px;
            }

            .clipboard-history-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .clipboard-history-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px;
                background: var(--input-bg, #2a2a2a);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 8px;
                transition: background 0.2s;
            }

            .clipboard-history-item:hover {
                background: var(--hover-bg, #333);
            }

            .clipboard-history-command {
                flex: 1;
                font-family: 'Courier New', monospace;
                font-size: 14px;
                color: var(--text-color, #fff);
                word-break: break-all;
            }

            .clipboard-history-copy {
                background: var(--primary-color, #4CAF50);
                color: white;
                border: none;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 12px;
                white-space: nowrap;
                transition: background 0.2s;
            }

            .clipboard-history-copy:hover {
                background: var(--primary-hover, #45a049);
            }

            .clipboard-modal-footer {
                display: flex;
                justify-content: flex-end;
                gap: 12px;
                padding: 20px;
                border-top: 1px solid var(--border-color, #3a3a3a);
            }

            .clipboard-copy-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: rgba(0, 0, 0, 0.5);
                border: 1px solid var(--border-color, #3a3a3a);
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
                font-size: 16px;
                opacity: 0;
                transition: opacity 0.2s, background 0.2s;
            }

            .server-card:hover .clipboard-copy-btn {
                opacity: 1;
            }

            .clipboard-copy-btn:hover {
                background: rgba(0, 0, 0, 0.8);
            }
        `;
        document.head.appendChild(style);
    }

    return {
        initialize,
        copy,
        copyServerIP,
        copyRCONDetails,
        addToHistory,
        getHistory,
        clearHistory,
        copyFromHistory,
        showHistoryModal,
        createCopyButton
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Clipboard.initialize());
} else {
    Clipboard.initialize();
}

// Make globally available
window.Clipboard = Clipboard;
