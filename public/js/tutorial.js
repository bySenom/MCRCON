/**
 * First-Time Tutorial System
 * Shows an interactive walkthrough when user first visits the dashboard
 */

class Tutorial {
    constructor() {
        this.steps = [
            {
                title: "🎉 Willkommen zum Minecraft Server Manager!",
                content: "Dieses Tutorial führt dich durch die ersten Schritte. Du kannst es jederzeit mit ESC überspringen.",
                target: null,
                position: "center"
            },
            {
                title: "📊 Dashboard Übersicht",
                content: "Hier siehst du alle deine Server auf einen Blick. Status, Typ, Version und Spieleranzahl werden live angezeigt.",
                target: "#dashboard-tab",
                position: "bottom"
            },
            {
                title: "➕ Server erstellen",
                content: "Klicke hier, um einen neuen Minecraft Server zu erstellen. Du kannst zwischen verschiedenen Typen wählen: Vanilla, Paper, Fabric, Forge oder Proxy-Server.",
                target: "[data-tab='create']",
                position: "bottom",
                highlight: true
            },
            {
                title: "🎯 Server Templates",
                content: "Wähle vorkonfigurierte Templates für schnelles Setup oder erstelle einen benutzerdefinierten Server.",
                target: null,
                position: "center",
                showOnTab: "create"
            },
            {
                title: "⚙️ Server Konfiguration",
                content: "Konfiguriere Name, Typ, Version, Host/IP, Port und RAM-Zuteilung. Das Host-Feld ist wichtig für Online-Server!",
                target: null,
                position: "center",
                showOnTab: "create"
            },
            {
                title: "📺 Live Console",
                content: "Nach der Erstellung kannst du die Live-Console nutzen, um Server-Logs in Echtzeit zu sehen und Befehle auszuführen.",
                target: null,
                position: "center"
            },
            {
                title: "🔌 Plugins & Mods",
                content: "Installiere Plugins und Mods direkt aus Modrinth und Spigot. Die Suche filtert automatisch nach deinem Server-Typ.",
                target: "[data-tab='plugins']",
                position: "bottom"
            },
            {
                title: "💾 Backups & Automation",
                content: "Erstelle Backups, plane automatische Tasks und richte Discord-Benachrichtigungen ein.",
                target: null,
                position: "center"
            },
            {
                title: "🌐 Proxy-Netzwerke",
                content: "Für mehrere Server: Erstelle einen Velocity/BungeeCord Proxy und füge Backend-Server direkt über 'Create & Add' hinzu.",
                target: null,
                position: "center"
            },
            {
                title: "✨ Viel Erfolg!",
                content: "Du bist bereit! Erstelle jetzt deinen ersten Server. Klicke auf 'Tutorial beenden' um zu starten.",
                target: null,
                position: "center",
                final: true
            }
        ];

        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.tooltip = null;
    }

    /**
     * Check if tutorial should be shown (first time user)
     */
    shouldShow() {
        const hasSeenTutorial = localStorage.getItem('mcmanager_tutorial_completed');
        const hasServers = window.servers && window.servers.length > 0;
        return !hasSeenTutorial && !hasServers;
    }

    /**
     * Start the tutorial
     */
    start() {
        if (this.isActive) return;
        
        this.isActive = true;
        this.currentStep = 0;
        this.createOverlay();
        this.createTooltip();
        this.showStep(0);
    }

    /**
     * Create dark overlay
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.id = 'tutorial-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 9998;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(this.overlay);

        // Close on ESC
        this.escHandler = (e) => {
            if (e.key === 'Escape') this.skip();
        };
        document.addEventListener('keydown', this.escHandler);
    }

    /**
     * Create tooltip element
     */
    createTooltip() {
        this.tooltip = document.createElement('div');
        this.tooltip.id = 'tutorial-tooltip';
        this.tooltip.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 2rem;
            max-width: 500px;
            z-index: 9999;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            color: #e4e4e7;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;
        document.body.appendChild(this.tooltip);
    }

    /**
     * Show specific tutorial step
     */
    showStep(stepIndex) {
        const step = this.steps[stepIndex];
        if (!step) return;

        // Switch to correct tab if needed
        if (step.showOnTab) {
            const tabButton = document.querySelector(`[data-tab="${step.showOnTab}"]`);
            if (tabButton && !tabButton.classList.contains('active')) {
                tabButton.click();
                // Wait for tab switch animation to complete
                setTimeout(() => {
                    this.renderStepContent(stepIndex, step);
                }, 300);
                return;
            }
        }

        this.renderStepContent(stepIndex, step);
    }

    /**
     * Render the step content (split from showStep for async tab switching)
     */
    renderStepContent(stepIndex, step) {
        // Clear previous highlights
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        // Highlight target element
        if (step.target) {
            const target = document.querySelector(step.target);
            if (target) {
                target.classList.add('tutorial-highlight');
                
                // Add highlight styles if not exists
                if (!document.getElementById('tutorial-styles')) {
                    const style = document.createElement('style');
                    style.id = 'tutorial-styles';
                    style.textContent = `
                        .tutorial-highlight {
                            position: relative;
                            z-index: 9999 !important;
                            box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.5), 0 0 30px rgba(102, 126, 234, 0.8) !important;
                            border-radius: 8px !important;
                            animation: tutorial-pulse 2s infinite;
                        }
                        @keyframes tutorial-pulse {
                            0%, 100% { box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.5), 0 0 30px rgba(102, 126, 234, 0.8); }
                            50% { box-shadow: 0 0 0 8px rgba(102, 126, 234, 0.7), 0 0 40px rgba(102, 126, 234, 1); }
                        }
                    `;
                    document.head.appendChild(style);
                }
                
                // Scroll target into view
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        // Update tooltip content
        this.updateTooltipContent(stepIndex, step);
    }

    /**
     * Update tooltip content and event listeners
     */
    updateTooltipContent(stepIndex, step) {
        this.tooltip.innerHTML = `
            <div style="margin-bottom: 1.5rem;">
                <h3 style="margin: 0 0 1rem 0; font-size: 1.5rem; color: #667eea;">${step.title}</h3>
                <p style="margin: 0; font-size: 1rem; line-height: 1.6; color: #d4d4d8;">${step.content}</p>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="color: #a1a1aa; font-size: 0.9rem;">
                    Schritt ${stepIndex + 1} von ${this.steps.length}
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button id="tutorial-skip" style="
                        padding: 0.5rem 1rem;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        border-radius: 6px;
                        color: #e4e4e7;
                        cursor: pointer;
                        font-size: 0.9rem;
                        transition: all 0.2s ease;
                    ">
                        ${step.final ? 'Tutorial beenden' : 'Überspringen (ESC)'}
                    </button>
                    ${!step.final ? `
                    <button id="tutorial-next" style="
                        padding: 0.5rem 1.5rem;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        border: none;
                        border-radius: 6px;
                        color: white;
                        cursor: pointer;
                        font-weight: 600;
                        font-size: 0.9rem;
                        transition: all 0.2s ease;
                    ">
                        Weiter →
                    </button>
                    ` : ''}
                </div>
            </div>
        `;

        // Position tooltip
        this.positionTooltip(step);

        // Add event listeners
        const skipBtn = document.getElementById('tutorial-skip');
        const nextBtn = document.getElementById('tutorial-next');
        
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skip());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.next());
        }

        // Add hover effects
        const buttons = this.tooltip.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.transform = 'translateY(-2px)';
                btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = 'none';
            });
        });
    }

    /**
     * Position tooltip relative to target or center
     */
    positionTooltip(step) {
        if (step.position === 'center' || !step.target) {
            // Center on screen
            this.tooltip.style.top = '50%';
            this.tooltip.style.left = '50%';
            this.tooltip.style.transform = 'translate(-50%, -50%)';
        } else {
            // Position relative to target
            const target = document.querySelector(step.target);
            if (target) {
                const rect = target.getBoundingClientRect();
                
                switch (step.position) {
                    case 'bottom':
                        this.tooltip.style.top = `${rect.bottom + 20}px`;
                        this.tooltip.style.left = `${rect.left + rect.width / 2}px`;
                        this.tooltip.style.transform = 'translateX(-50%)';
                        break;
                    case 'top':
                        this.tooltip.style.bottom = `${window.innerHeight - rect.top + 20}px`;
                        this.tooltip.style.left = `${rect.left + rect.width / 2}px`;
                        this.tooltip.style.transform = 'translateX(-50%)';
                        break;
                    case 'right':
                        this.tooltip.style.top = `${rect.top + rect.height / 2}px`;
                        this.tooltip.style.left = `${rect.right + 20}px`;
                        this.tooltip.style.transform = 'translateY(-50%)';
                        break;
                    case 'left':
                        this.tooltip.style.top = `${rect.top + rect.height / 2}px`;
                        this.tooltip.style.right = `${window.innerWidth - rect.left + 20}px`;
                        this.tooltip.style.transform = 'translateY(-50%)';
                        break;
                }
            }
        }
    }

    /**
     * Go to next step
     */
    next() {
        this.currentStep++;
        if (this.currentStep < this.steps.length) {
            this.showStep(this.currentStep);
        } else {
            this.complete();
        }
    }

    /**
     * Skip tutorial
     */
    skip() {
        this.complete();
    }

    /**
     * Complete and cleanup tutorial
     */
    complete() {
        localStorage.setItem('mcmanager_tutorial_completed', 'true');
        
        // Cleanup
        if (this.overlay) this.overlay.remove();
        if (this.tooltip) this.tooltip.remove();
        document.removeEventListener('keydown', this.escHandler);
        
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });

        const styles = document.getElementById('tutorial-styles');
        if (styles) styles.remove();

        this.isActive = false;

        // Show completion message
        if (typeof Toast !== 'undefined') {
            Toast.success('Tutorial abgeschlossen! Viel Erfolg mit deinem Server Manager! 🎉');
        }
    }

    /**
     * Reset tutorial (for testing or user request)
     */
    static reset() {
        localStorage.removeItem('mcmanager_tutorial_completed');
        if (typeof Toast !== 'undefined') {
            Toast.info('Tutorial zurückgesetzt. Lade die Seite neu, um es erneut zu starten.');
        }
    }
}

// Global instance
window.TutorialManager = new Tutorial();

// Auto-start on page load if needed
document.addEventListener('DOMContentLoaded', () => {
    // Wait for servers to load first
    setTimeout(() => {
        if (window.TutorialManager.shouldShow()) {
            setTimeout(() => {
                window.TutorialManager.start();
            }, 1000); // Delay 1s for better UX
        }
    }, 500);
});
