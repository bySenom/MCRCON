// World Management Module
const WorldManager = (function() {
    'use strict';

    let currentServerId = null;

    // Helper to get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    // Initialize world management
    function init(serverId) {
        currentServerId = serverId;
        loadWorldInfo();
        loadGamerules();
        loadWorldBorder();
    }

    // Load world information
    async function loadWorldInfo() {
        if (!currentServerId) return;

        try {
            const response = await fetch(`/api/servers/${currentServerId}/world/info`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to load world info');

            const data = await response.json();
            renderWorldInfo(data.worldInfo, data.worlds);
        } catch (error) {
            showError('Failed to load world information');
        }
    }

    // Render world information cards
    function renderWorldInfo(worldInfo, worlds) {
        const worldInfoDiv = document.getElementById('world-info');
        if (!worldInfoDiv) return;

        let html = '<div class="world-cards">';

        // Render main world
        if (worldInfo) {
            html += `
                <div class="world-card">
                    <div class="world-card-header">
                        <h3>🌍 Overworld</h3>
                        <span class="world-size">${worldInfo.size}</span>
                    </div>
                    <div class="world-card-body">
                        <p><strong>Files:</strong> ${worldInfo.files}</p>
                        <p><strong>Modified:</strong> ${new Date(worldInfo.modified).toLocaleString()}</p>
                    </div>
                    <div class="world-card-actions">
                        <button onclick="WorldManager.downloadWorld('world')" class="btn btn-sm btn-primary">
                            📥 Download
                        </button>
                        <button onclick="WorldManager.confirmResetWorld('world')" class="btn btn-sm btn-danger">
                            🗑️ Reset
                        </button>
                    </div>
                </div>
            `;
        }

        // Render other worlds
        if (worlds && worlds.length > 0) {
            worlds.forEach(world => {
                const icon = world.name.includes('nether') ? '🔥' : 
                            world.name.includes('end') ? '🌌' : '🌍';
                const displayName = world.name.includes('nether') ? 'Nether' :
                                   world.name.includes('end') ? 'The End' : world.name;

                html += `
                    <div class="world-card">
                        <div class="world-card-header">
                            <h3>${icon} ${displayName}</h3>
                            <span class="world-size">${world.size}</span>
                        </div>
                        <div class="world-card-body">
                            <p><strong>Files:</strong> ${world.files}</p>
                            <p><strong>Modified:</strong> ${new Date(world.modified).toLocaleString()}</p>
                        </div>
                        <div class="world-card-actions">
                            <button onclick="WorldManager.downloadWorld('${world.name}')" class="btn btn-sm btn-primary">
                                📥 Download
                            </button>
                            <button onclick="WorldManager.confirmResetWorld('${world.name}')" class="btn btn-sm btn-danger">
                                🗑️ Reset
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        worldInfoDiv.innerHTML = html;
    }

    // Download world
    function downloadWorld(worldName) {
        if (!currentServerId) return;

        const token = localStorage.getItem('auth_token');
        const url = `/api/servers/${currentServerId}/world/download?world=${worldName}`;
        
        // Create temporary link for download
        const link = document.createElement('a');
        link.href = `${url}&token=${token}`;
        link.download = `${worldName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showSuccess(`Downloading ${worldName}...`);
    }

    // Confirm reset world
    function confirmResetWorld(worldName) {
        if (!confirm(`⚠️ WARNING: This will delete the ${worldName} and create a backup.\n\nAre you sure you want to reset this world?`)) {
            return;
        }

        resetWorld(worldName);
    }

    // Reset world
    async function resetWorld(worldName) {
        if (!currentServerId) return;

        try {
            const response = await fetch(`/api/servers/${currentServerId}/world/reset`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ world: worldName })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to reset world');
            }

            showSuccess(`World ${worldName} has been reset. Backup created at: ${data.backupPath}`);
            loadWorldInfo(); // Reload world info
        } catch (error) {
            showError(error.message);
        }
    }

    // Load gamerules
    async function loadGamerules() {
        if (!currentServerId) return;

        try {
            const response = await fetch(`/api/servers/${currentServerId}/world/gamerules`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to load gamerules');

            const data = await response.json();
            renderGamerules(data.gamerules);
        } catch (error) {
            showError('Failed to load gamerules');
        }
    }

    // Render gamerules table
    function renderGamerules(gamerules) {
        const gamerarulesDiv = document.getElementById('gamerules-list');
        if (!gamerarulesDiv) return;

        let html = `
            <div class="gamerules-header">
                <p>⚠️ Server must be <strong>running</strong> to change gamerules</p>
            </div>
            <table class="gamerules-table">
                <thead>
                    <tr>
                        <th>Rule</th>
                        <th>Value</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
        `;

        Object.entries(gamerules).forEach(([rule, value]) => {
            const inputType = typeof value === 'boolean' ? 'checkbox' : 'number';
            const checked = typeof value === 'boolean' && value ? 'checked' : '';
            const displayValue = typeof value === 'boolean' ? '' : value;

            html += `
                <tr>
                    <td class="rule-name">${rule}</td>
                    <td class="rule-value">
                        <input 
                            type="${inputType}" 
                            id="gamerule-${rule}" 
                            value="${displayValue}"
                            ${checked}
                            ${inputType === 'number' ? 'min="0"' : ''}
                        >
                    </td>
                    <td>
                        <button onclick="WorldManager.updateGamerule('${rule}')" class="btn btn-sm btn-primary">
                            Update
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                </tbody>
            </table>
        `;

        gamerarulesDiv.innerHTML = html;
    }

    // Update gamerule
    async function updateGamerule(rule) {
        if (!currentServerId) return;

        const input = document.getElementById(`gamerule-${rule}`);
        if (!input) return;

        const value = input.type === 'checkbox' ? input.checked : parseInt(input.value);

        try {
            const response = await fetch(`/api/servers/${currentServerId}/world/gamerules`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ rule, value })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update gamerule');
            }

            showSuccess(`Gamerule ${rule} updated to ${value}`);
        } catch (error) {
            showError(error.message);
        }
    }

    // Load world border
    async function loadWorldBorder() {
        if (!currentServerId) return;

        try {
            const response = await fetch(`/api/servers/${currentServerId}/world/border`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error('Failed to load world border');

            const data = await response.json();
            renderWorldBorder(data.border);
        } catch (error) {
            showError('Failed to load world border');
        }
    }

    // Render world border form
    function renderWorldBorder(border) {
        const borderDiv = document.getElementById('world-border-config');
        if (!borderDiv) return;

        // Set default values if undefined
        const size = border?.size || 60000000;
        const centerX = border?.centerX || 0;
        const centerZ = border?.centerZ || 0;

        borderDiv.innerHTML = `
            <div class="world-border-header">
                <p>⚠️ Server must be <strong>running</strong> to change world border</p>
            </div>
            <div class="world-border-form">
                <div class="form-group">
                    <label for="border-size">Border Size (blocks):</label>
                    <input type="number" id="border-size" class="form-control" value="${size}" min="1" max="60000000">
                </div>
                <div class="form-group">
                    <label for="border-centerX">Center X:</label>
                    <input type="number" id="border-centerX" class="form-control" value="${centerX}">
                </div>
                <div class="form-group">
                    <label for="border-centerZ">Center Z:</label>
                    <input type="number" id="border-centerZ" class="form-control" value="${centerZ}">
                </div>
                <button onclick="WorldManager.updateWorldBorder()" class="btn btn-primary">
                    🌐 Update World Border
                </button>
            </div>
        `;
    }

    // Update world border
    async function updateWorldBorder() {
        if (!currentServerId) return;

        const size = parseInt(document.getElementById('border-size').value);
        const centerX = parseInt(document.getElementById('border-centerX').value);
        const centerZ = parseInt(document.getElementById('border-centerZ').value);

        if (isNaN(size) || isNaN(centerX) || isNaN(centerZ)) {
            showError('Please enter valid numbers for all fields');
            return;
        }

        try {
            const response = await fetch(`/api/servers/${currentServerId}/world/border`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ size, centerX, centerZ })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Failed to update world border');
            }

            showSuccess('World border updated successfully');
        } catch (error) {
            showError(error.message);
        }
    }

    // Utility functions
    function showSuccess(message) {
        alert(`✅ ${message}`);
    }

    function showError(message) {
        alert(`❌ ${message}`);
    }

    // Public API
    return {
        init,
        downloadWorld,
        confirmResetWorld,
        updateGamerule,
        updateWorldBorder,
        refresh: loadWorldInfo
    };
})();
