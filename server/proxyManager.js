const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const toml = require('@iarna/toml');

class ProxyManager {
    /**
     * Detect proxy type from server path
     */
    async detectProxyType(serverPath) {
        const velocityPath = path.join(serverPath, 'velocity.toml');
        const bungeePath = path.join(serverPath, 'config.yml');
        
        try {
            await fs.access(velocityPath);
            return 'velocity';
        } catch {
            try {
                await fs.access(bungeePath);
                return 'bungeecord';
            } catch {
                throw new Error('Could not detect proxy type - no config file found');
            }
        }
    }

    /**
     * Parse config from proxy server (YAML or TOML)
     */
    async getProxyConfig(serverPath, proxyType = null) {
        if (!proxyType) {
            proxyType = await this.detectProxyType(serverPath);
        }
        
        if (proxyType === 'velocity') {
            const configPath = path.join(serverPath, 'velocity.toml');
            try {
                const content = await fs.readFile(configPath, 'utf8');
                const config = toml.parse(content);
                return config;
            } catch (error) {
                throw new Error(`Failed to read velocity.toml: ${error.message}`);
            }
        } else {
            const configPath = path.join(serverPath, 'config.yml');
            try {
                const content = await fs.readFile(configPath, 'utf8');
                const config = yaml.load(content);
                return config;
            } catch (error) {
                throw new Error(`Failed to read config.yml: ${error.message}`);
            }
        }
    }

    /**
     * Save config to proxy server (YAML or TOML)
     */
    async saveProxyConfig(serverPath, config, proxyType = null) {
        if (!proxyType) {
            proxyType = await this.detectProxyType(serverPath);
        }
        
        if (proxyType === 'velocity') {
            const configPath = path.join(serverPath, 'velocity.toml');
            try {
                const tomlStr = toml.stringify(config);
                await fs.writeFile(configPath, tomlStr, 'utf8');
                return true;
            } catch (error) {
                throw new Error(`Failed to save velocity.toml: ${error.message}`);
            }
        } else {
            const configPath = path.join(serverPath, 'config.yml');
            try {
                const yamlStr = yaml.dump(config, {
                    indent: 2,
                    lineWidth: -1,
                    noRefs: true
                });
                await fs.writeFile(configPath, yamlStr, 'utf8');
                return true;
            } catch (error) {
                throw new Error(`Failed to save config.yml: ${error.message}`);
            }
        }
    }

    /**
     * Get list of backend servers from config
     */
    async getBackendServers(serverPath, proxyType = null) {
        try {
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (!config.servers) {
                return [];
            }

            // Velocity uses different structure
            if (proxyType === 'velocity' || (await this.detectProxyType(serverPath)) === 'velocity') {
                // Velocity: servers = { lobby: "localhost:25565", hub: "localhost:25566" }
                // Filter out 'try' which is the priority list, not a server
                return Object.entries(config.servers)
                    .filter(([name]) => name !== 'try')
                    .map(([name, address]) => ({
                        name: name,
                        address: typeof address === 'string' ? address : address.address || '',
                        motd: name, // Velocity doesn't have per-server MOTD in config
                        restricted: false
                    }));
            } else {
                // BungeeCord/Waterfall: servers.lobby = { address: "...", motd: "...", restricted: false }
                return Object.entries(config.servers).map(([name, serverConfig]) => ({
                    name: name,
                    address: serverConfig.address || '',
                    motd: serverConfig.motd || '',
                    restricted: serverConfig.restricted || false
                }));
            }
        } catch (error) {
            throw new Error(`Failed to get backend servers: ${error.message}`);
        }
    }

    /**
     * Add a backend server to proxy config
     */
    async addBackendServer(serverPath, serverData, proxyType = null) {
        try {
            if (!proxyType) {
                proxyType = await this.detectProxyType(serverPath);
            }
            
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (!config.servers) {
                config.servers = {};
            }

            // Check if server already exists
            if (config.servers[serverData.name]) {
                throw new Error(`Server '${serverData.name}' already exists`);
            }

            if (proxyType === 'velocity') {
                // Velocity: servers.lobby = "localhost:25565"
                config.servers[serverData.name] = serverData.address;
                
                // Add to try list if it's the first or default server
                if (serverData.default || Object.keys(config.servers).length === 1) {
                    if (!config.try) {
                        config.try = [];
                    }
                    if (!config.try.includes(serverData.name)) {
                        config.try.unshift(serverData.name);
                    }
                }
            } else {
                // BungeeCord/Waterfall
                config.servers[serverData.name] = {
                    motd: serverData.motd || `${serverData.name} Server`,
                    address: serverData.address,
                    restricted: serverData.restricted || false
                };

                // If this is the first server or marked as default, add to priorities
                if (serverData.default && config.listeners && config.listeners[0]) {
                    if (!config.listeners[0].priorities) {
                        config.listeners[0].priorities = [];
                    }
                    // Add to beginning of priorities array
                    config.listeners[0].priorities.unshift(serverData.name);
                }
            }

            await this.saveProxyConfig(serverPath, config, proxyType);
            return true;
        } catch (error) {
            throw new Error(`Failed to add backend server: ${error.message}`);
        }
    }

    /**
     * Update a backend server in proxy config
     */
    async updateBackendServer(serverPath, oldName, serverData, proxyType = null) {
        try {
            if (!proxyType) {
                proxyType = await this.detectProxyType(serverPath);
            }
            
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (!config.servers || !config.servers[oldName]) {
                throw new Error(`Server '${oldName}' not found`);
            }

            // If name changed, delete old and create new
            if (oldName !== serverData.name) {
                delete config.servers[oldName];
                
                if (proxyType === 'velocity') {
                    // Update try list
                    if (config.try && Array.isArray(config.try)) {
                        const tryIndex = config.try.indexOf(oldName);
                        if (tryIndex !== -1) {
                            config.try[tryIndex] = serverData.name;
                        }
                    }
                } else {
                    // Update priorities if name changed
                    if (config.listeners && config.listeners[0] && config.listeners[0].priorities) {
                        const priorityIndex = config.listeners[0].priorities.indexOf(oldName);
                        if (priorityIndex !== -1) {
                            config.listeners[0].priorities[priorityIndex] = serverData.name;
                        }
                    }
                }
            }

            // Update server config
            if (proxyType === 'velocity') {
                config.servers[serverData.name] = serverData.address;
            } else {
                config.servers[serverData.name] = {
                    motd: serverData.motd || `${serverData.name} Server`,
                    address: serverData.address,
                    restricted: serverData.restricted || false
                };
            }

            await this.saveProxyConfig(serverPath, config, proxyType);
            return true;
        } catch (error) {
            throw new Error(`Failed to update backend server: ${error.message}`);
        }
    }

    /**
     * Remove a backend server from proxy config
     */
    async removeBackendServer(serverPath, serverName, proxyType = null) {
        try {
            if (!proxyType) {
                proxyType = await this.detectProxyType(serverPath);
            }
            
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (!config.servers || !config.servers[serverName]) {
                throw new Error(`Server '${serverName}' not found`);
            }

            // Remove from servers
            delete config.servers[serverName];

            if (proxyType === 'velocity') {
                // Remove from try list
                if (config.try && Array.isArray(config.try)) {
                    const tryIndex = config.try.indexOf(serverName);
                    if (tryIndex !== -1) {
                        config.try.splice(tryIndex, 1);
                    }
                }
            } else {
                // Remove from priorities
                if (config.listeners && config.listeners[0] && config.listeners[0].priorities) {
                    const priorityIndex = config.listeners[0].priorities.indexOf(serverName);
                    if (priorityIndex !== -1) {
                        config.listeners[0].priorities.splice(priorityIndex, 1);
                    }
                }

                // Remove from forced_hosts
                if (config.listeners && config.listeners[0] && config.listeners[0].forced_hosts) {
                    const hostsToRemove = [];
                    for (const [host, target] of Object.entries(config.listeners[0].forced_hosts)) {
                        if (target === serverName) {
                            hostsToRemove.push(host);
                        }
                    }
                    hostsToRemove.forEach(host => {
                        delete config.listeners[0].forced_hosts[host];
                    });
                }
            }

            await this.saveProxyConfig(serverPath, config, proxyType);
            return true;
        } catch (error) {
            throw new Error(`Failed to remove backend server: ${error.message}`);
        }
    }

    /**
     * Set default server (first priority)
     */
    async setDefaultServer(serverPath, serverName, proxyType = null) {
        try {
            if (!proxyType) {
                proxyType = await this.detectProxyType(serverPath);
            }
            
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (!config.servers || !config.servers[serverName]) {
                throw new Error(`Server '${serverName}' not found`);
            }

            if (proxyType === 'velocity') {
                if (!config.try) {
                    config.try = [];
                }

                // Remove from current position
                const currentIndex = config.try.indexOf(serverName);
                if (currentIndex !== -1) {
                    config.try.splice(currentIndex, 1);
                }

                // Add to beginning
                config.try.unshift(serverName);
            } else {
                if (!config.listeners || !config.listeners[0]) {
                    throw new Error('No listeners configured');
                }

                if (!config.listeners[0].priorities) {
                    config.listeners[0].priorities = [];
                }

                // Remove from current position
                const currentIndex = config.listeners[0].priorities.indexOf(serverName);
                if (currentIndex !== -1) {
                    config.listeners[0].priorities.splice(currentIndex, 1);
                }

                // Add to beginning
                config.listeners[0].priorities.unshift(serverName);
            }

            await this.saveProxyConfig(serverPath, config, proxyType);
            return true;
        } catch (error) {
            throw new Error(`Failed to set default server: ${error.message}`);
        }
    }

    /**
     * Get proxy listener settings
     */
    async getListenerSettings(serverPath, proxyType = null) {
        try {
            if (!proxyType) {
                proxyType = await this.detectProxyType(serverPath);
            }
            
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (proxyType === 'velocity') {
                return {
                    host: config.bind || '0.0.0.0:25577',
                    motd: config.motd || 'A Velocity Server',
                    maxPlayers: config['show-max-players'] || 500,
                    priorities: config.try || [],
                    forceDefaultServer: false, // Velocity doesn't have this
                    pingPassthrough: config['ping-passthrough'] === 'MODS' || config['ping-passthrough'] === 'ALL'
                };
            } else {
                if (!config.listeners || !config.listeners[0]) {
                    return null;
                }

                const listener = config.listeners[0];
                return {
                    host: listener.host || '0.0.0.0:25577',
                    motd: listener.motd || 'A BungeeCord Server',
                    maxPlayers: listener.max_players || 100,
                    priorities: listener.priorities || [],
                    forceDefaultServer: listener.force_default_server || false,
                    pingPassthrough: listener.ping_passthrough || false
                };
            }
        } catch (error) {
            throw new Error(`Failed to get listener settings: ${error.message}`);
        }
    }

    /**
     * Update proxy listener settings
     */
    async updateListenerSettings(serverPath, settings, proxyType = null) {
        try {
            if (!proxyType) {
                proxyType = await this.detectProxyType(serverPath);
            }
            
            const config = await this.getProxyConfig(serverPath, proxyType);
            
            if (proxyType === 'velocity') {
                if (settings.motd !== undefined) config.motd = settings.motd;
                if (settings.maxPlayers !== undefined) config['show-max-players'] = settings.maxPlayers;
                if (settings.pingPassthrough !== undefined) {
                    config['ping-passthrough'] = settings.pingPassthrough ? 'ALL' : 'DISABLED';
                }
            } else {
                if (!config.listeners || !config.listeners[0]) {
                    throw new Error('No listeners configured');
                }

                const listener = config.listeners[0];
                
                if (settings.motd !== undefined) listener.motd = settings.motd;
                if (settings.maxPlayers !== undefined) listener.max_players = settings.maxPlayers;
                if (settings.forceDefaultServer !== undefined) listener.force_default_server = settings.forceDefaultServer;
                if (settings.pingPassthrough !== undefined) listener.ping_passthrough = settings.pingPassthrough;
            }

            await this.saveProxyConfig(serverPath, config, proxyType);
            return true;
        } catch (error) {
            throw new Error(`Failed to update listener settings: ${error.message}`);
        }
    }
}

module.exports = new ProxyManager();
