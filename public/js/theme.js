// Theme Management Module
(function() {
    'use strict';

    // Get saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark';
    
    /**
     * Initialize theme system
     */
    function initTheme() {
        // Apply saved theme immediately to prevent flash
        applyTheme(savedTheme);
        
        // Create theme toggle button
        createThemeToggle();
        
    }

    /**
     * Apply theme to document
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update toggle button icon if it exists
        updateToggleIcon(theme);
    }

    /**
     * Toggle between light and dark theme
     */
    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        applyTheme(newTheme);
        
        // Show notification
        if (window.showNotification) {
            window.showNotification(
                `Theme gewechselt zu ${newTheme === 'dark' ? 'Dunkel' : 'Hell'} Modus`,
                'success'
            );
        }
    }

    /**
     * Create theme toggle button in header
     */
    function createThemeToggle() {
        // Find the logout button's parent container
        const logoutBtn = document.getElementById('logoutBtn');
        const headerControls = logoutBtn ? logoutBtn.parentElement : null;
        
        if (!headerControls) {
            // Fallback: create floating button
            createFloatingToggle();
            return;
        }

        // Create toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'themeToggle';
        toggleBtn.className = 'btn btn-secondary theme-toggle';
        toggleBtn.setAttribute('aria-label', 'Toggle theme');
        toggleBtn.title = 'Theme wechseln';
        toggleBtn.onclick = toggleTheme;
        toggleBtn.style.cssText = 'padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.5rem;';
        
        // Set initial icon
        updateToggleIcon(savedTheme, toggleBtn);
        
        // Add before logout button
        headerControls.insertBefore(toggleBtn, logoutBtn);
    }

    /**
     * Create floating theme toggle button
     */
    function createFloatingToggle() {
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'themeToggle';
        toggleBtn.className = 'btn btn-secondary theme-toggle-floating';
        toggleBtn.setAttribute('aria-label', 'Toggle theme');
        toggleBtn.title = 'Switch Theme';
        toggleBtn.onclick = toggleTheme;
        
        updateToggleIcon(savedTheme, toggleBtn);
        
        document.body.appendChild(toggleBtn);
    }

    /**
     * Update toggle button icon
     */
    function updateToggleIcon(theme, button = null) {
        const btn = button || document.getElementById('themeToggle');
        if (!btn) return;
        
        if (theme === 'dark') {
            btn.innerHTML = '☀️ Hell';
        } else {
            btn.innerHTML = '🌙 Dunkel';
        }
    }

    // Export functions
    window.themeManager = {
        toggle: toggleTheme,
        apply: applyTheme,
        getCurrent: () => document.documentElement.getAttribute('data-theme') || 'dark'
    };

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }

})();
