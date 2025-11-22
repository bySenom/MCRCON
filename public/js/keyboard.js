/**
 * Keyboard Shortcuts Manager
 * Global keyboard shortcuts for improved UX
 */

const KeyboardShortcuts = (function() {
    const shortcuts = new Map();
    let helpModalOpen = false;

    // Initialize
    function initialize() {
        document.addEventListener('keydown', handleKeydown);
        registerDefaultShortcuts();
    }

    // Handle keydown events
    function handleKeydown(e) {
        // Build shortcut key (e.g., "Ctrl+K", "Ctrl+Shift+S")
        const parts = [];
        if (e.ctrlKey || e.metaKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        
        // Ignore modifier keys alone
        if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;
        
        parts.push(e.key.toUpperCase());
        const shortcutKey = parts.join('+');

        // Check if shortcut exists
        if (shortcuts.has(shortcutKey)) {
            const shortcut = shortcuts.get(shortcutKey);
            
            // Check if we should ignore (e.g., in input fields)
            if (shortcut.ignoreInInputs && isInputElement(e.target)) {
                return;
            }

            e.preventDefault();
            shortcut.callback(e);
        }
    }

    // Check if element is input
    function isInputElement(element) {
        const tagName = element.tagName.toLowerCase();
        return tagName === 'input' || tagName === 'textarea' || element.isContentEditable;
    }

    // Register shortcut
    function register(key, description, callback, options = {}) {
        shortcuts.set(key, {
            description,
            callback,
            ignoreInInputs: options.ignoreInInputs !== false
        });
    }

    // Unregister shortcut
    function unregister(key) {
        shortcuts.delete(key);
    }

    // Register default shortcuts
    function registerDefaultShortcuts() {
        // ESC - Close modals
        register('ESC', 'Modals schließen', () => {
            closeAllModals();
        }, { ignoreInInputs: false });

        // Ctrl+N - New server
        register('Ctrl+N', 'Neuen Server erstellen', () => {
            switchToTab('create');
        });

        // Ctrl+R - Refresh
        register('Ctrl+R', 'Server-Liste aktualisieren', (e) => {
            const refreshBtn = document.getElementById('refreshServers');
            if (refreshBtn) {
                refreshBtn.click();
                Toast.success('Server-Liste aktualisiert', 2000);
            }
        });

        // Ctrl+S - Save (when in settings)
        register('Ctrl+S', 'Einstellungen speichern', () => {
            const saveBtn = document.querySelector('.btn-primary[onclick*="save"]');
            if (saveBtn && saveBtn.offsetParent !== null) { // Check if visible
                saveBtn.click();
            }
        });

        // ? - Show help
        register('?', 'Tastenkombinationen anzeigen', () => {
            toggleHelpModal();
        }, { ignoreInInputs: true });

        // Ctrl+1 to Ctrl+7 - Switch tabs
        for (let i = 1; i <= 7; i++) {
            register(`Ctrl+${i}`, `Tab ${i} öffnen`, () => {
                const tabs = document.querySelectorAll('.tab-button');
                if (tabs[i - 1]) {
                    tabs[i - 1].click();
                }
            });
        }
    }

    // Close all modals
    function closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'block' || modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });

        // Close help modal if open
        if (helpModalOpen) {
            toggleHelpModal();
        }
    }

    // Switch to tab
    function switchToTab(tabName) {
        const tabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
        if (tabButton) {
            tabButton.click();
        }
    }

    // Toggle help modal
    function toggleHelpModal() {
        let modal = document.getElementById('keyboard-shortcuts-modal');
        
        if (!modal) {
            modal = createHelpModal();
        }

        if (helpModalOpen) {
            modal.style.display = 'none';
            helpModalOpen = false;
        } else {
            modal.style.display = 'flex';
            helpModalOpen = true;
        }
    }

    // Create help modal
    function createHelpModal() {
        const modal = document.createElement('div');
        modal.id = 'keyboard-shortcuts-modal';
        modal.className = 'modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 10001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(4px);
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: var(--card-bg);
            padding: 2rem;
            border-radius: 12px;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
        `;

        const header = document.createElement('div');
        header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;';
        header.innerHTML = `
            <h2 style="margin: 0;">⌨️ Tastenkombinationen</h2>
            <button onclick="KeyboardShortcuts.toggleHelp()" style="background: none; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; padding: 0; width: 32px; height: 32px; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='none'">×</button>
        `;

        const shortcutsList = document.createElement('div');
        shortcutsList.style.cssText = 'display: grid; gap: 1rem;';

        // Group shortcuts by category
        const categories = {
            'Navigation': [
                { key: 'Ctrl+1-7', desc: 'Tab wechseln' },
                { key: 'Ctrl+N', desc: shortcuts.get('Ctrl+N')?.description },
                { key: 'Ctrl+R', desc: shortcuts.get('Ctrl+R')?.description },
            ],
            'Aktionen': [
                { key: 'Ctrl+S', desc: shortcuts.get('Ctrl+S')?.description },
                { key: 'ESC', desc: shortcuts.get('ESC')?.description },
            ],
            'Hilfe': [
                { key: '?', desc: shortcuts.get('?')?.description },
            ]
        };

        for (const [category, items] of Object.entries(categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.innerHTML = `
                <h3 style="margin: 0 0 0.75rem 0; font-size: 0.875rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em;">${category}</h3>
                <div style="display: grid; gap: 0.5rem;">
                    ${items.map(item => `
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: var(--bg-secondary); border-radius: 6px;">
                            <span style="color: var(--text-primary);">${item.desc}</span>
                            <kbd style="background: var(--bg-primary); padding: 0.25rem 0.5rem; border-radius: 4px; font-family: monospace; font-size: 0.875rem; color: var(--primary-color); border: 1px solid var(--border);">${item.key}</kbd>
                        </div>
                    `).join('')}
                </div>
            `;
            shortcutsList.appendChild(categoryDiv);
        }

        content.appendChild(header);
        content.appendChild(shortcutsList);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                toggleHelpModal();
            }
        });

        return modal;
    }

    // Show shortcut hint
    function showHint(message, duration = 2000) {
        Toast.info(message, duration);
    }

    // Public API
    return {
        initialize,
        register,
        unregister,
        toggleHelp: toggleHelpModal,
        showHint
    };
})();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => KeyboardShortcuts.initialize());
} else {
    KeyboardShortcuts.initialize();
}

// Make globally available
window.KeyboardShortcuts = KeyboardShortcuts;
