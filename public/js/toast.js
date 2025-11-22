/**
 * Toast Notification System
 * Modern notification system with animations and stacking
 */

const ToastManager = (function() {
    const toasts = [];
    let container = null;
    let toastIdCounter = 0;

    // Initialize toast container
    function initialize() {
        if (container) return;
        
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
            pointer-events: none;
        `;
        document.body.appendChild(container);
    }

    // Show toast notification
    function show(message, type = 'info', duration = 5000) {
        initialize();

        const toastId = toastIdCounter++;
        const toast = document.createElement('div');
        toast.id = `toast-${toastId}`;
        toast.className = `toast toast-${type}`;
        toast.style.cssText = `
            background: var(--card-bg);
            color: var(--text-primary);
            padding: 1rem 1.25rem;
            border-radius: 8px;
            border-left: 4px solid ${getColor(type)};
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            display: flex;
            align-items: center;
            gap: 0.75rem;
            min-width: 300px;
            max-width: 400px;
            pointer-events: auto;
            animation: slideInRight 0.3s ease-out;
            transition: all 0.3s ease;
        `;

        // Icon
        const icon = document.createElement('span');
        icon.style.cssText = 'font-size: 1.5rem; flex-shrink: 0;';
        icon.textContent = getIcon(type);

        // Content
        const content = document.createElement('div');
        content.style.cssText = 'flex: 1; font-size: 0.95rem; line-height: 1.4;';
        content.textContent = message;

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '×';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
            flex-shrink: 0;
        `;
        closeBtn.onmouseover = () => {
            closeBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            closeBtn.style.color = 'var(--text-primary)';
        };
        closeBtn.onmouseout = () => {
            closeBtn.style.background = 'none';
            closeBtn.style.color = 'var(--text-secondary)';
        };
        closeBtn.onclick = () => dismiss(toastId);

        toast.appendChild(icon);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        container.appendChild(toast);

        toasts.push({ id: toastId, element: toast });

        // Auto-dismiss
        if (duration > 0) {
            setTimeout(() => dismiss(toastId), duration);
        }

        return toastId;
    }

    // Dismiss toast
    function dismiss(toastId) {
        const toastIndex = toasts.findIndex(t => t.id === toastId);
        if (toastIndex === -1) return;

        const toast = toasts[toastIndex].element;
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';

        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
            toasts.splice(toastIndex, 1);
        }, 300);
    }

    // Dismiss all toasts
    function dismissAll() {
        toasts.forEach(toast => dismiss(toast.id));
    }

    // Get color by type
    function getColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || colors.info;
    }

    // Get icon by type
    function getIcon(type) {
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    // Convenience methods
    function success(message, duration) {
        return show(message, 'success', duration);
    }

    function error(message, duration) {
        return show(message, 'error', duration);
    }

    function warning(message, duration) {
        return show(message, 'warning', duration);
    }

    function info(message, duration) {
        return show(message, 'info', duration);
    }

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100%);
            }
        }

        .toast:hover {
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4) !important;
            transform: translateY(-2px);
        }
    `;
    document.head.appendChild(style);

    // Public API
    return {
        show,
        success,
        error,
        warning,
        info,
        dismiss,
        dismissAll
    };
})();

// Make globally available
window.Toast = ToastManager;
