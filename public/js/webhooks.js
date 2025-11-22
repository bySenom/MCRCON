// Webhooks Module (IIFE to prevent global variable conflicts)
(() => {
    // Module State
    let webhooks = [];
    let servers = [];
    let editingWebhookId = null;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        setupEventListeners();
        // Don't load servers immediately - wait until tab is opened
    }

    // Load webhooks when tab becomes active
    function loadWebhooksIfActive() {
        const webhooksTab = document.getElementById('webhooks-tab');
        if (webhooksTab && webhooksTab.classList.contains('active')) {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                // Show message in the webhooks tab
                const container = document.getElementById('webhooksList');
                if (container) {
                    container.innerHTML = '<p style="color: var(--text-secondary); grid-column: 1 / -1; text-align: center; padding: 2rem;">Bitte melde dich an, um Webhooks zu verwalten. Weiterleitung...</p>';
                }
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1500);
                return;
            }
            loadWebhooks();
            // Also load servers for dropdown when tab opens
            if (servers.length === 0) {
                loadServersForDropdown();
            }
        }
    }

    // Setup Event Listeners
    function setupEventListeners() {
        const createBtn = document.getElementById('createWebhookBtn');
        if (createBtn) {
            createBtn.addEventListener('click', openCreateWebhookModal);
        }

        const form = document.getElementById('webhookForm');
        if (form) {
            form.addEventListener('submit', handleWebhookFormSubmit);
        }

        // Listen for tab changes to load webhooks
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-tab="webhooks"]')) {
                setTimeout(loadWebhooksIfActive, 100);
            }
        });
    }

    // Load Webhooks
    async function loadWebhooks() {
        try {
            const token = localStorage.getItem('auth_token');
            
            if (!token) {
                // Don't show notification here - will be handled by loadWebhooksIfActive
                return;
            }
            
            const response = await fetch('/api/webhooks', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                showNotification('Session abgelaufen. Bitte neu anmelden.', 'error');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load webhooks');
            }

            const data = await response.json();
            webhooks = data.webhooks || [];
            renderWebhooks();
        } catch (error) {
            showNotification('Fehler beim Laden der Webhooks', 'error');
        }
    }

    // Render Webhooks
    function renderWebhooks() {
        const container = document.getElementById('webhooksList');
        const noWebhooksMsg = document.getElementById('noWebhooksMessage');
        
        if (!container) return;

        if (webhooks.length === 0) {
            if (noWebhooksMsg) noWebhooksMsg.style.display = 'block';
            // Clear existing cards
            const existingCards = container.querySelectorAll('.webhook-card');
            existingCards.forEach(card => card.remove());
            return;
        }

        if (noWebhooksMsg) noWebhooksMsg.style.display = 'none';

        // Clear and render
        const existingCards = container.querySelectorAll('.webhook-card');
        existingCards.forEach(card => card.remove());

        webhooks.forEach(webhook => {
            const card = createWebhookCard(webhook);
            container.appendChild(card);
        });
    }

    // Create Webhook Card
    function createWebhookCard(webhook) {
        const card = document.createElement('div');
        card.className = 'webhook-card';
        card.style.cssText = 'background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 1.5rem; transition: transform 0.2s, box-shadow 0.2s;';

        // Find server name
        const server = servers.find(s => s.id === webhook.serverId);
        const serverName = server ? server.name : 'Alle Server';

        // Count enabled events
        const eventCount = webhook.events.length;
        const statusBadge = webhook.enabled 
            ? '<span style="background: #10b981; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">AKTIV</span>'
            : '<span style="background: #6b7280; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">INAKTIV</span>';

        const typeBadge = webhook.type === 'discord'
            ? '<span style="background: #5865f2; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Discord</span>'
            : '<span style="background: #6366f1; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.75rem; font-weight: 600;">Generic</span>';

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">${escapeHtml(webhook.name)}</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        ${statusBadge}
                        ${typeBadge}
                    </div>
                </div>
                <button class="webhook-menu-btn" data-id="${webhook.id}" style="background: transparent; border: none; color: var(--text-secondary); font-size: 1.5rem; cursor: pointer; padding: 0; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.background='var(--bg-primary)'" onmouseout="this.style.background='transparent'">⋮</button>
            </div>

            <div style="margin-bottom: 1rem;">
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0.5rem 0;"><strong>Server:</strong> ${escapeHtml(serverName)}</p>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0.5rem 0;"><strong>Ereignisse:</strong> ${eventCount} aktiviert</p>
                <p style="color: var(--text-secondary); font-size: 0.875rem; margin: 0.5rem 0; word-break: break-all;"><strong>URL:</strong> ${escapeHtml(webhook.url.substring(0, 50))}...</p>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 1rem;">
                ${webhook.events.map(event => {
                    const eventLabels = {
                        start: '🟢 Start',
                        stop: '🔴 Stop',
                        crash: '💥 Crash',
                        player_join: '👋 Join',
                        player_leave: '👤 Leave',
                        backup_complete: '💾 Backup OK',
                        backup_failed: '⚠️ Backup Fehler'
                    };
                    return `<span style="background: var(--bg-primary); color: var(--text-secondary); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;">${eventLabels[event] || event}</span>`;
                }).join('')}
            </div>

            <div class="webhook-actions" style="display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
                <button class="btn btn-secondary" onclick="webhooksModule.testWebhook('${webhook.id}')" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;">🧪 Testen</button>
                <button class="btn btn-secondary" onclick="webhooksModule.toggleWebhook('${webhook.id}')" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;">${webhook.enabled ? '⏸️ Deaktivieren' : '▶️ Aktivieren'}</button>
                <button class="btn btn-secondary" onclick="webhooksModule.editWebhook('${webhook.id}')" style="flex: 1; padding: 0.5rem; font-size: 0.875rem;">✏️ Bearbeiten</button>
                <button class="btn btn-danger" onclick="webhooksModule.deleteWebhook('${webhook.id}')" style="padding: 0.5rem; font-size: 0.875rem;">🗑️</button>
            </div>
        `;

        // Add hover effect
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-2px)';
            card.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
        });
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = 'none';
        });

        return card;
    }

    // Open Create Modal
    function openCreateWebhookModal() {
        editingWebhookId = null;
        document.getElementById('webhookModalTitle').textContent = 'Webhook hinzufügen';
        document.getElementById('webhookForm').reset();
        document.getElementById('webhookEnabled').checked = true;
        
        // Clear all event checkboxes
        document.querySelectorAll('.event-checkbox').forEach(cb => cb.checked = false);
        
        document.getElementById('webhookModal').style.display = 'flex';
    }

    // Close Modal
    window.closeWebhookModal = function() {
        document.getElementById('webhookModal').style.display = 'none';
        editingWebhookId = null;
    };

    // Handle Form Submit
    async function handleWebhookFormSubmit(e) {
        e.preventDefault();

        const name = document.getElementById('webhookName').value.trim();
        const url = document.getElementById('webhookUrl').value.trim();
        const type = document.getElementById('webhookType').value;
        const serverId = document.getElementById('webhookServerId').value || null;
        const enabled = document.getElementById('webhookEnabled').checked;

        // Get selected events
        const events = Array.from(document.querySelectorAll('.event-checkbox:checked'))
            .map(cb => cb.value);

        if (events.length === 0) {
            showNotification('Bitte mindestens ein Ereignis auswählen', 'error');
            return;
        }

        const webhookData = {
            name,
            url,
            type,
            serverId,
            events,
            enabled
        };

        try {
            const token = localStorage.getItem('auth_token');
            
            if (!token) {
                showNotification('Nicht angemeldet', 'error');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return;
            }
            
            const method = editingWebhookId ? 'PUT' : 'POST';
            const endpoint = editingWebhookId ? `/api/webhooks/${editingWebhookId}` : '/api/webhooks';

            const response = await fetch(endpoint, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(webhookData)
            });

            if (response.status === 401) {
                showNotification('Session abgelaufen. Bitte neu anmelden.', 'error');
                localStorage.removeItem('auth_token');
                localStorage.removeItem('user');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
                return;
            }

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to save webhook');
            }

            showNotification(editingWebhookId ? 'Webhook aktualisiert' : 'Webhook erstellt', 'success');
            closeWebhookModal();
            loadWebhooks();
        } catch (error) {
            showNotification(error.message || 'Fehler beim Speichern des Webhooks', 'error');
        }
    }

    // Edit Webhook
    window.webhooksModule = window.webhooksModule || {};
    window.webhooksModule.editWebhook = async function(webhookId) {
        const webhook = webhooks.find(w => w.id === webhookId);
        if (!webhook) return;

        editingWebhookId = webhookId;
        document.getElementById('webhookModalTitle').textContent = 'Webhook bearbeiten';
        
        document.getElementById('webhookName').value = webhook.name;
        document.getElementById('webhookUrl').value = webhook.url;
        document.getElementById('webhookType').value = webhook.type;
        document.getElementById('webhookServerId').value = webhook.serverId || '';
        document.getElementById('webhookEnabled').checked = webhook.enabled;

        // Set event checkboxes
        document.querySelectorAll('.event-checkbox').forEach(cb => {
            cb.checked = webhook.events.includes(cb.value);
        });

        document.getElementById('webhookModal').style.display = 'flex';
    };

    // Toggle Webhook
    window.webhooksModule.toggleWebhook = async function(webhookId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/webhooks/${webhookId}/toggle`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to toggle webhook');
            }

            showNotification('Webhook Status geändert', 'success');
            loadWebhooks();
        } catch (error) {
            showNotification('Fehler beim Ändern des Webhook Status', 'error');
        }
    };

    // Test Webhook
    window.webhooksModule.testWebhook = async function(webhookId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/webhooks/${webhookId}/test`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to test webhook');
            }

            showNotification('Test-Benachrichtigung gesendet', 'success');
        } catch (error) {
            showNotification('Fehler beim Testen des Webhooks', 'error');
        }
    };

    // Delete Webhook
    window.webhooksModule.deleteWebhook = async function(webhookId) {
        if (!confirm('Möchtest du diesen Webhook wirklich löschen?')) {
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`/api/webhooks/${webhookId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to delete webhook');
            }

            showNotification('Webhook gelöscht', 'success');
            loadWebhooks();
        } catch (error) {
            showNotification('Fehler beim Löschen des Webhooks', 'error');
        }
    };

    // Load Servers for Dropdown
    async function loadServersForDropdown() {
        try {
            const token = localStorage.getItem('auth_token');
            
            if (!token) {
                return;
            }
            
            const response = await fetch('/api/servers', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.status === 401) {
                return;
            }

            if (!response.ok) {
                throw new Error('Failed to load servers');
            }

            const data = await response.json();
            servers = data.servers || [];
            
            // Populate dropdown
            const dropdown = document.getElementById('webhookServerId');
            if (dropdown) {
                // Keep "Alle Server" option
                dropdown.innerHTML = '<option value="">Alle Server</option>';
                
                for (const server of servers) {
                    const option = document.createElement('option');
                    option.value = server.id;
                    option.textContent = server.name;
                    dropdown.appendChild(option);
                }
            }
        } catch (error) {
        }
    }

    // Show Notification
    function showNotification(message, type = 'info') {
        // Try to use dashboard notification if available
        if (typeof window.showNotification === 'function') {
            window.showNotification(message, type);
            return;
        }

        // Fallback notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Escape HTML to prevent XSS
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Close modal on background click
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('webhookModal');
        if (e.target === modal) {
            closeWebhookModal();
        }
    });
})();
