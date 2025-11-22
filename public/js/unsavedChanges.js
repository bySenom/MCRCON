/**
 * Unsaved Changes Tracker
 * Detects unsaved changes and warns before navigation/close
 */

const UnsavedChanges = (function() {
    let hasUnsavedChanges = false;
    let trackedForms = new Set();
    let originalValues = new Map();

    // Initialize
    function initialize() {
        // Warn before page close
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Track form changes
        document.addEventListener('input', handleInput);
        document.addEventListener('change', handleChange);
    }

    // Handle before unload
    function handleBeforeUnload(e) {
        if (hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = 'Sie haben ungespeicherte Änderungen. Möchten Sie die Seite wirklich verlassen?';
            return e.returnValue;
        }
    }

    // Handle input events
    function handleInput(e) {
        const element = e.target;
        
        // Only track specific elements
        if (shouldTrackElement(element)) {
            markAsChanged(element);
        }
    }

    // Handle change events
    function handleChange(e) {
        const element = e.target;
        
        if (shouldTrackElement(element)) {
            markAsChanged(element);
        }
    }

    // Check if element should be tracked
    function shouldTrackElement(element) {
        // Track server settings, config forms, etc.
        const trackableIds = [
            'propMotd', 'propMaxPlayers', 'propDifficulty', 'propGamemode',
            'propPvp', 'propOnlineMode', 'propWhitelist', 'propSpawnProtection',
            'propViewDistance', 'propSimulationDistance',
            'proxyMotd', 'proxyOnlineMode', 'proxyIpForward'
        ];

        const trackableClasses = [
            'server-config-input',
            'settings-input',
            'config-textarea'
        ];

        return trackableIds.includes(element.id) ||
               trackableClasses.some(cls => element.classList.contains(cls)) ||
               element.closest('.server-settings-form') !== null;
    }

    // Mark as changed
    function markAsChanged(element) {
        const formId = getFormId(element);
        
        // Store original value if not stored yet
        if (!originalValues.has(element.id)) {
            originalValues.set(element.id, element.value);
        }

        // Check if value actually changed
        const currentValue = element.value;
        const originalValue = originalValues.get(element.id);

        if (currentValue !== originalValue) {
            hasUnsavedChanges = true;
            trackedForms.add(formId);
            showUnsavedIndicator();
        } else {
            // Value restored to original
            checkIfAllRestored(formId);
        }
    }

    // Get form ID for element
    function getFormId(element) {
        const form = element.closest('form') || element.closest('[data-form-id]');
        return form ? (form.id || form.dataset.formId || 'default') : 'default';
    }

    // Check if all values restored
    function checkIfAllRestored(formId) {
        let allRestored = true;
        
        originalValues.forEach((originalValue, elementId) => {
            const element = document.getElementById(elementId);
            if (element && element.value !== originalValue) {
                allRestored = false;
            }
        });

        if (allRestored) {
            markAsSaved();
        }
    }

    // Show unsaved indicator
    function showUnsavedIndicator() {
        let indicator = document.getElementById('unsaved-changes-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'unsaved-changes-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--warning-color);
                color: white;
                padding: 0.75rem 1.25rem;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                gap: 0.75rem;
                z-index: 9999;
                animation: slideInUp 0.3s ease-out;
                font-weight: 500;
            `;
            indicator.innerHTML = `
                <span style="font-size: 1.25rem;">⚠️</span>
                <span>Ungespeicherte Änderungen</span>
            `;
            document.body.appendChild(indicator);

            // Add animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                @keyframes slideOutDown {
                    from {
                        opacity: 1;
                        transform: translateY(0);
                    }
                    to {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                }
            `;
            document.head.appendChild(style);
        }

        indicator.style.display = 'flex';
    }

    // Hide unsaved indicator
    function hideUnsavedIndicator() {
        const indicator = document.getElementById('unsaved-changes-indicator');
        if (indicator) {
            indicator.style.animation = 'slideOutDown 0.3s ease-out';
            setTimeout(() => {
                indicator.style.display = 'none';
            }, 300);
        }
    }

    // Mark as saved
    function markAsSaved() {
        hasUnsavedChanges = false;
        trackedForms.clear();
        originalValues.clear();
        hideUnsavedIndicator();
    }

    // Reset tracking for element
    function resetTracking(element) {
        originalValues.delete(element.id);
        
        // Re-store current value as original
        originalValues.set(element.id, element.value);
    }

    // Reset all tracking
    function resetAll() {
        originalValues.clear();
        markAsSaved();
    }

    // Check if has unsaved changes
    function check() {
        return hasUnsavedChanges;
    }

    // Warn before action
    function warnBeforeAction(message, callback) {
        if (hasUnsavedChanges) {
            if (confirm(message || 'Sie haben ungespeicherte Änderungen. Wirklich fortfahren?')) {
                markAsSaved();
                callback();
            }
        } else {
            callback();
        }
    }

    // Public API
    return {
        initialize,
        markAsSaved,
        resetTracking,
        resetAll,
        check,
        warnBeforeAction,
        hasChanges: () => hasUnsavedChanges
    };
})();

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => UnsavedChanges.initialize());
} else {
    UnsavedChanges.initialize();
}

// Make globally available
window.UnsavedChanges = UnsavedChanges;
