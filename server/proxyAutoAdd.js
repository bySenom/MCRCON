/**
 * Proxy Auto-Add Helper
 * Helper functions to automatically add backend servers to proxies
 */

class ProxyAutoAdd {
    constructor(serverManager, proxyManager) {
        this.serverManager = serverManager;
        this.proxyManager = proxyManager;
    }

    /**
     * Get all available servers that can be added as backends
     * @param {string} proxyId - ID of the proxy server
     * @returns {Array} List of available servers
     */
    getAvailableServers(proxyId) {
        const allServers = this.serverManager.getAllServers();
        
        // Filter: only non-proxy servers
        return allServers.filter(server => {
            return server.type !== 'bungeecord' && 
                   server.type !== 'waterfall' && 
                   server.type !== 'velocity' &&
                   server.id !== proxyId;
        }).map(server => ({
            id: server.id,
            name: server.name,
            type: server.type,
            version: server.version,
            port: server.port,
            status: server.status
        }));
    }

    /**
     * Automatically add a server as backend to proxy
     * @param {Object} proxyServer - Proxy server object
     * @param {Object} backendServer - Backend server object
     * @returns {Object} Result with serverName
     */
    async autoAddServer(proxyServer, backendServer) {
        // Generate safe server name
        const serverName = backendServer.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const address = `localhost:${backendServer.port}`;
        const motd = backendServer.name;

        // Add to proxy config
        await this.proxyManager.addBackendServer(proxyServer.path, {
            name: serverName,
            address: address,
            motd: motd,
            restricted: false
        });

        return {
            serverName: serverName,
            address: address,
            motd: motd
        };
    }
}

module.exports = ProxyAutoAdd;
