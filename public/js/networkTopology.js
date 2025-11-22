/**
 * Network Topology Visualization
 * Canvas-based interactive network diagram
 */

(function() {
    'use strict';

    const API_URL = window.location.origin + '/api';
    let currentProxyId = null;
    let canvas = null;
    let ctx = null;
    let nodes = [];
    let proxyNode = null;
    let animationFrame = null;
    let isDragging = false;
    let draggedNode = null;
    let mouseX = 0;
    let mouseY = 0;

    // Node class
    class Node {
        constructor(id, name, type, x, y) {
            this.id = id;
            this.name = name;
            this.type = type; // 'proxy' or 'backend'
            this.x = x;
            this.y = y;
            this.vx = 0;
            this.vy = 0;
            this.radius = type === 'proxy' ? 40 : 30;
            this.color = type === 'proxy' ? '#6366f1' : '#10b981';
            this.online = true;
            this.playerCount = 0;
            this.maxPlayers = 0;
            this.tps = 0;
            this.latency = 0;
            this.restricted = false;
        }

        update(status) {
            if (status) {
                this.online = status.online || false;
                this.playerCount = status.playerCount || 0;
                this.maxPlayers = status.maxPlayers || 0;
                this.tps = status.tps || 0;
                this.latency = status.latency || 0;
                this.restricted = status.restricted || false;
                this.color = this.online ? '#10b981' : '#ef4444';
            }
        }

        draw(ctx, isHovered = false) {
            // Shadow for depth
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;

            // Main circle
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            // Border
            ctx.strokeStyle = isHovered ? '#fff' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = isHovered ? 3 : 2;
            ctx.stroke();

            ctx.shadowColor = 'transparent';

            // Icon
            ctx.fillStyle = '#fff';
            ctx.font = `${this.radius}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.type === 'proxy' ? '🌐' : '🎮', this.x, this.y);

            // Name
            ctx.font = 'bold 14px Arial';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.fillText(this.name, this.x, this.y + this.radius + 20);

            // Status info for backend servers
            if (this.type === 'backend') {
                const statusY = this.y + this.radius + 40;
                ctx.font = '11px Arial';
                ctx.fillStyle = this.online ? '#10b981' : '#ef4444';
                ctx.fillText(this.online ? '● Online' : '● Offline', this.x, statusY);

                if (this.online) {
                    ctx.fillStyle = '#94a3b8';
                    ctx.fillText(`👥 ${this.playerCount}/${this.maxPlayers}`, this.x, statusY + 15);
                    
                    if (this.latency > 0) {
                        ctx.fillText(`${this.latency}ms`, this.x, statusY + 30);
                    }
                }

                if (this.restricted) {
                    ctx.fillStyle = '#f59e0b';
                    ctx.fillText('🔒 Restricted', this.x, statusY + 45);
                }
            }
        }

        contains(x, y) {
            const dx = x - this.x;
            const dy = y - this.y;
            return Math.sqrt(dx * dx + dy * dy) <= this.radius;
        }

        applyForce(fx, fy) {
            this.vx += fx;
            this.vy += fy;
        }

        updatePosition(width, height) {
            // Apply velocity
            this.x += this.vx;
            this.y += this.vy;

            // Damping
            this.vx *= 0.9;
            this.vy *= 0.9;

            // Keep in bounds
            const margin = this.radius + 20;
            if (this.x < margin) {
                this.x = margin;
                this.vx = 0;
            }
            if (this.x > width - margin) {
                this.x = width - margin;
                this.vx = 0;
            }
            if (this.y < margin + 60) { // Extra margin for text
                this.y = margin + 60;
                this.vy = 0;
            }
            if (this.y > height - margin - 60) {
                this.y = height - margin - 60;
                this.vy = 0;
            }
        }
    }

    /**
     * Initialize topology visualization
     */
    function initializeTopology(proxyId, proxyName) {
        currentProxyId = proxyId;
        const container = document.getElementById('networkTopology');
        
        if (!container) return;

        // Clear existing canvas
        container.innerHTML = '';

        // Create canvas
        canvas = document.createElement('canvas');
        canvas.width = container.clientWidth;
        canvas.height = 600;
        canvas.style.display = 'block';
        container.appendChild(canvas);

        ctx = canvas.getContext('2d');

        // Create proxy node in center
        proxyNode = new Node('proxy', proxyName, 'proxy', canvas.width / 2, canvas.height / 2);
        nodes = [];

        // Setup mouse events
        setupMouseEvents();

        // Load backend servers
        loadTopologyData();

        // Start animation
        animate();

        // Auto-refresh if enabled
        const autoRefresh = document.getElementById('topologyAutoRefresh');
        if (autoRefresh && autoRefresh.checked) {
            setInterval(() => {
                loadTopologyData(false); // Update without recreating nodes
            }, 5000);
        }
    }

    /**
     * Setup mouse events for dragging
     */
    function setupMouseEvents() {
        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // Check proxy node
            if (proxyNode.contains(x, y)) {
                isDragging = true;
                draggedNode = proxyNode;
                return;
            }

            // Check backend nodes
            for (const node of nodes) {
                if (node.contains(x, y)) {
                    isDragging = true;
                    draggedNode = node;
                    break;
                }
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouseX = e.clientX - rect.left;
            mouseY = e.clientY - rect.top;

            if (isDragging && draggedNode) {
                draggedNode.x = mouseX;
                draggedNode.y = mouseY;
                draggedNode.vx = 0;
                draggedNode.vy = 0;
            }
        });

        canvas.addEventListener('mouseup', () => {
            isDragging = false;
            draggedNode = null;
        });

        canvas.addEventListener('mouseleave', () => {
            isDragging = false;
            draggedNode = null;
        });
    }

    /**
     * Load topology data from API
     */
    async function loadTopologyData(recreateNodes = true) {
        if (!currentProxyId) return;

        try {
            const token = localStorage.getItem('auth_token');
            
            // Get backend servers config
            const serversResponse = await fetch(`${API_URL}/servers/${currentProxyId}/proxy/servers`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const serversData = await serversResponse.json();

            // Get backend status
            const statusResponse = await fetch(`${API_URL}/servers/${currentProxyId}/proxy/status`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const statusData = await statusResponse.json();

            if (serversData.success && statusData.success) {
                const servers = serversData.servers || [];
                const statusMap = new Map(statusData.backends.map(b => [b.name, b]));

                if (recreateNodes) {
                    // Create nodes in circle around proxy
                    nodes = [];
                    const angleStep = (Math.PI * 2) / Math.max(servers.length, 1);
                    const radius = Math.min(canvas.width, canvas.height) * 0.3;

                    servers.forEach((server, index) => {
                        const angle = index * angleStep - Math.PI / 2;
                        const x = proxyNode.x + Math.cos(angle) * radius;
                        const y = proxyNode.y + Math.sin(angle) * radius;
                        
                        const node = new Node(server.name, server.name, 'backend', x, y);
                        const status = statusMap.get(server.name);
                        node.update(status);
                        nodes.push(node);
                    });
                } else {
                    // Just update status
                    nodes.forEach(node => {
                        const status = statusMap.get(node.id);
                        node.update(status);
                    });
                }
            }
        } catch (error) {
        }
    }

    /**
     * Apply physics forces
     */
    function applyForces() {
        const springStrength = 0.01;
        const repulsionStrength = 500;
        const idealDistance = 150;

        // Spring force to proxy
        nodes.forEach(node => {
            const dx = proxyNode.x - node.x;
            const dy = proxyNode.y - node.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const force = (distance - idealDistance) * springStrength;
                node.applyForce((dx / distance) * force, (dy / distance) * force);
            }
        });

        // Repulsion between backend nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const dx = nodes[j].x - nodes[i].x;
                const dy = nodes[j].y - nodes[i].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0 && distance < 200) {
                    const force = repulsionStrength / (distance * distance);
                    nodes[i].applyForce(-(dx / distance) * force, -(dy / distance) * force);
                    nodes[j].applyForce((dx / distance) * force, (dy / distance) * force);
                }
            }
        }
    }

    /**
     * Draw connections
     */
    function drawConnections() {
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.3)';
        ctx.lineWidth = 2;

        nodes.forEach(node => {
            // Draw line from proxy to backend
            ctx.beginPath();
            ctx.moveTo(proxyNode.x, proxyNode.y);
            ctx.lineTo(node.x, node.y);
            
            // Dashed if offline
            if (!node.online) {
                ctx.setLineDash([5, 5]);
            } else {
                ctx.setLineDash([]);
            }
            
            ctx.stroke();
        });

        ctx.setLineDash([]);
    }

    /**
     * Animation loop
     */
    function animate() {
        if (!canvas || !ctx) return;

        // Clear canvas
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = 'rgba(100, 116, 139, 0.1)';
        ctx.lineWidth = 1;
        for (let x = 0; x < canvas.width; x += 50) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y < canvas.height; y += 50) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }

        // Apply physics if not dragging
        if (!isDragging) {
            applyForces();
            nodes.forEach(node => node.updatePosition(canvas.width, canvas.height));
        }

        // Draw connections
        drawConnections();

        // Draw nodes
        proxyNode.draw(ctx, proxyNode.contains(mouseX, mouseY));
        nodes.forEach(node => {
            const isHovered = node.contains(mouseX, mouseY);
            node.draw(ctx, isHovered);
        });

        // Stats overlay
        drawStatsOverlay();

        animationFrame = requestAnimationFrame(animate);
    }

    /**
     * Draw stats overlay
     */
    function drawStatsOverlay() {
        const totalServers = nodes.length;
        const onlineServers = nodes.filter(n => n.online).length;
        const totalPlayers = nodes.reduce((sum, n) => sum + n.playerCount, 0);

        ctx.font = '14px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'left';
        
        const padding = 15;
        const lineHeight = 20;
        let y = padding + lineHeight;

        ctx.fillText(`📊 Netzwerk-Übersicht`, padding, y);
        y += lineHeight;
        ctx.fillText(`Server: ${onlineServers}/${totalServers} online`, padding, y);
        y += lineHeight;
        ctx.fillText(`Spieler: ${totalPlayers}`, padding, y);
    }

    /**
     * Cleanup
     */
    function cleanup() {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        nodes = [];
        proxyNode = null;
        canvas = null;
        ctx = null;
    }

    // Export to global
    window.NetworkTopology = {
        initialize: initializeTopology,
        cleanup: cleanup
    };

})();
