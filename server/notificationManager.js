const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class NotificationManager {
    constructor() {
        this.webhooksFile = path.join(__dirname, '../data/webhooks.json');
        this.webhooks = new Map(); // serverId -> webhook configs
    }

    async initialize() {
        try {
            await this.loadWebhooks();
            console.log(`✓ Loaded webhooks for ${this.webhooks.size} servers`);
        } catch (error) {
            console.error('Failed to initialize notification manager:', error);
        }
    }

    async loadWebhooks() {
        try {
            const data = await fs.readFile(this.webhooksFile, 'utf8');
            const webhooks = JSON.parse(data);
            
            this.webhooks.clear();
            for (const webhook of webhooks) {
                if (!this.webhooks.has(webhook.serverId)) {
                    this.webhooks.set(webhook.serverId, []);
                }
                this.webhooks.get(webhook.serverId).push(webhook);
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                await this.saveWebhooks([]);
            } else {
                throw error;
            }
        }
    }

    async saveWebhooks(webhooks) {
        const dataDir = path.dirname(this.webhooksFile);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        
        await fs.writeFile(this.webhooksFile, JSON.stringify(webhooks, null, 2));
    }

    async getAllWebhooks() {
        try {
            const data = await fs.readFile(this.webhooksFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async createWebhook(webhookData) {
        const webhooks = await this.getAllWebhooks();
        const newWebhook = {
            id: require('uuid').v4(),
            serverId: webhookData.serverId,
            name: webhookData.name,
            url: webhookData.url,
            type: webhookData.type || 'discord', // discord, generic
            events: webhookData.events || ['crash', 'start', 'stop'],
            enabled: webhookData.enabled !== false,
            createdAt: new Date().toISOString()
        };

        webhooks.push(newWebhook);
        await this.saveWebhooks(webhooks);
        await this.loadWebhooks(); // Reload cache

        return newWebhook;
    }

    async updateWebhook(webhookId, updates) {
        const webhooks = await this.getAllWebhooks();
        const webhookIndex = webhooks.findIndex(w => w.id === webhookId);

        if (webhookIndex === -1) {
            throw new Error('Webhook not found');
        }

        webhooks[webhookIndex] = { ...webhooks[webhookIndex], ...updates };
        await this.saveWebhooks(webhooks);
        await this.loadWebhooks();

        return webhooks[webhookIndex];
    }

    async deleteWebhook(webhookId) {
        const webhooks = await this.getAllWebhooks();
        const filteredWebhooks = webhooks.filter(w => w.id !== webhookId);

        if (webhooks.length === filteredWebhooks.length) {
            throw new Error('Webhook not found');
        }

        await this.saveWebhooks(filteredWebhooks);
        await this.loadWebhooks();
    }

    async toggleWebhook(webhookId) {
        const webhooks = await this.getAllWebhooks();
        const webhook = webhooks.find(w => w.id === webhookId);

        if (!webhook) {
            throw new Error('Webhook not found');
        }

        webhook.enabled = !webhook.enabled;
        await this.saveWebhooks(webhooks);
        await this.loadWebhooks();

        return webhook;
    }

    async sendNotification(serverId, eventType, eventData) {
        const serverWebhooks = this.webhooks.get(serverId) || [];
        
        // Filter enabled webhooks that listen to this event
        const relevantWebhooks = serverWebhooks.filter(
            webhook => webhook.enabled && webhook.events.includes(eventType)
        );

        if (relevantWebhooks.length === 0) {
            return; // No webhooks to notify
        }

        const promises = relevantWebhooks.map(webhook => 
            this.sendToWebhook(webhook, eventType, eventData)
        );

        await Promise.allSettled(promises);
    }

    async sendToWebhook(webhook, eventType, eventData) {
        try {
            const payload = this.buildPayload(webhook.type, eventType, eventData);
            
            await axios.post(webhook.url, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            });

            console.log(`✓ Notification sent: ${webhook.name} (${eventType})`);
        } catch (error) {
            console.error(`✗ Failed to send notification to ${webhook.name}:`, error.message);
        }
    }

    buildPayload(type, eventType, eventData) {
        const { serverName, serverType, timestamp, message, exitCode, playerName } = eventData;

        if (type === 'discord') {
            return this.buildDiscordPayload(eventType, {
                serverName,
                serverType,
                timestamp,
                message,
                exitCode,
                playerName
            });
        } else {
            // Generic webhook format
            return {
                event: eventType,
                server: {
                    name: serverName,
                    type: serverType
                },
                timestamp: timestamp || new Date().toISOString(),
                data: eventData
            };
        }
    }

    buildDiscordPayload(eventType, data) {
        const { serverName, serverType, timestamp, message, exitCode, playerName } = data;
        const time = timestamp ? new Date(timestamp).toLocaleString('de-DE') : new Date().toLocaleString('de-DE');

        let embed = {
            title: '',
            description: '',
            color: 0,
            timestamp: timestamp || new Date().toISOString(),
            footer: {
                text: `${serverName} (${serverType})`
            }
        };

        switch (eventType) {
            case 'crash':
                embed.title = '🔴 Server Crashed';
                embed.description = message || `Server is gestürzt`;
                embed.color = 15158332; // Red
                if (exitCode !== undefined) {
                    embed.fields = [{ name: 'Exit Code', value: `${exitCode}`, inline: true }];
                }
                break;

            case 'start':
                embed.title = '✅ Server Started';
                embed.description = `Server wurde gestartet`;
                embed.color = 3066993; // Green
                break;

            case 'stop':
                embed.title = '⏹️ Server Stopped';
                embed.description = message || `Server wurde gestoppt`;
                embed.color = 10070709; // Gray
                if (exitCode !== undefined) {
                    embed.fields = [{ name: 'Exit Code', value: `${exitCode}`, inline: true }];
                }
                break;

            case 'player_join':
                embed.title = '👋 Player Joined';
                embed.description = `**${playerName}** ist beigetreten`;
                embed.color = 5763719; // Blue
                break;

            case 'player_leave':
                embed.title = '👋 Player Left';
                embed.description = `**${playerName}** hat den Server verlassen`;
                embed.color = 15105570; // Orange
                break;

            case 'backup_complete':
                embed.title = '💾 Backup Complete';
                embed.description = message || 'Backup wurde erfolgreich erstellt';
                embed.color = 3447003; // Blue
                break;

            case 'backup_failed':
                embed.title = '⚠️ Backup Failed';
                embed.description = message || 'Backup-Erstellung fehlgeschlagen';
                embed.color = 15158332; // Red
                break;

            default:
                embed.title = '📢 Server Event';
                embed.description = message || eventType;
                embed.color = 3447003; // Blue
        }

        return {
            embeds: [embed]
        };
    }

    // Detect player join/leave from console logs
    parsePlayerEvent(logMessage) {
        // Paper/Spigot format: "PlayerName joined the game" / "PlayerName left the game"
        const joinMatch = logMessage.match(/(\w+)\s+joined\s+the\s+game/i);
        if (joinMatch) {
            return { type: 'player_join', playerName: joinMatch[1] };
        }

        const leaveMatch = logMessage.match(/(\w+)\s+left\s+the\s+game/i);
        if (leaveMatch) {
            return { type: 'player_leave', playerName: leaveMatch[1] };
        }

        return null;
    }
}

module.exports = new NotificationManager();
