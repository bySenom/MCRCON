/**
 * WebSocket Client Manager
 */

const WebSocketManager = (function() {
    let socket = null;
    let connected = false;
    let subscribedServers = new Set();

    function init() {
        // Connect to Socket.IO server
        socket = io('http://localhost:3000');

        socket.on('connect', () => {
            connected = true;
            
            // Resubscribe to servers if reconnecting
            subscribedServers.forEach(serverId => {
                socket.emit('subscribe-server', serverId);
            });
        });

        socket.on('disconnect', () => {
            connected = false;
        });

        socket.on('console-log', (data) => {
            handleConsoleLog(data);
        });

        socket.on('server-status', (data) => {
            handleStatusChange(data);
        });

        socket.on('resource-update', (data) => {
            handleResourceUpdate(data);
        });
    }

    function subscribeToServer(serverId) {
        if (socket && connected) {
            socket.emit('subscribe-server', serverId);
            subscribedServers.add(serverId);
        }
    }

    function unsubscribeFromServer(serverId) {
        if (socket && connected) {
            socket.emit('unsubscribe-server', serverId);
            subscribedServers.delete(serverId);
        }
    }

    function handleConsoleLog(data) {
        // Dispatch custom event for console logs
        const event = new CustomEvent('server-console-log', { detail: data });
        document.dispatchEvent(event);
    }

    function handleStatusChange(data) {
        // Dispatch custom event for status changes
        const event = new CustomEvent('server-status-change', { detail: data });
        document.dispatchEvent(event);
        
        // Update dashboard if visible
        if (typeof Dashboard !== 'undefined' && Dashboard.updateServerStatus) {
            Dashboard.updateServerStatus(data.serverId, data.status);
        }
    }

    function handleResourceUpdate(data) {
        // Dispatch custom event for resource updates
        const event = new CustomEvent('server-resource-update', { detail: data });
        document.dispatchEvent(event);
    }

    function isConnected() {
        return connected;
    }

    function getSocket() {
        return socket;
    }

    return {
        init,
        subscribeToServer,
        unsubscribeFromServer,
        isConnected,
        getSocket
    };
})();

// Auto-initialize when loaded
document.addEventListener('DOMContentLoaded', () => {
    WebSocketManager.init();
});
