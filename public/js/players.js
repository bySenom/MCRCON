// Player Management Module
// Use global API_URL from dashboard.js
(function() {
    'use strict';

    let currentServerId = null;
    let allPlayers = [];
    let selectedPlayer = null;

    // Auth helper
    function getAuthHeaders() {
        const token = localStorage.getItem('auth_token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

/**
 * Initialize player management for a server
 */
function initializePlayerManagement(serverId) {
    currentServerId = serverId;
    loadPlayers();
}

/**
 * Load all players for current server
 */
async function loadPlayers() {
    if (!currentServerId) return;

    try {
        showLoadingState();

        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            allPlayers = data.players;
            renderPlayerList(allPlayers);
        } else {
            showError('Failed to load players');
        }
    } catch (error) {
        showError('Error loading players');
    }
}

/**
 * Render player list
 */
function renderPlayerList(players) {
    const container = document.getElementById('playerList');
    if (!container) return;

    if (players.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No players found</p>
            </div>
        `;
        return;
    }

    // Sort: online first, then alphabetically
    players.sort((a, b) => {
        if (a.online !== b.online) return b.online - a.online;
        return a.name.localeCompare(b.name);
    });

    container.innerHTML = players.map(player => `
        <div class="player-card ${player.online ? 'online' : 'offline'}" data-player="${player.name}">
            <div class="player-header">
                <div class="player-info">
                    <div class="player-avatar">
                        <img src="https://crafatar.com/avatars/${player.uuid || '8667ba71b85a4004af54457a9734eed7'}?size=40&overlay" 
                             alt="${player.name}"
                             onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22><rect width=%2240%22 height=%2240%22 fill=%22%23555%22/></svg>'">
                    </div>
                    <div class="player-details">
                        <div class="player-name">${player.name}</div>
                        <div class="player-status-badges">
                            ${player.online ? '<span class="badge badge-success">Online</span>' : '<span class="badge badge-secondary">Offline</span>'}
                            ${player.op ? '<span class="badge badge-warning">OP</span>' : ''}
                            ${player.whitelisted ? '<span class="badge badge-info">Whitelisted</span>' : ''}
                            ${player.banned ? '<span class="badge badge-danger">Banned</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="player-actions">
                    <button class="btn btn-sm btn-primary" onclick="viewPlayerDetails('${player.name}')">
                        <i class="fas fa-info-circle"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary dropdown-toggle" onclick="togglePlayerMenu('${player.name}')">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="player-menu" id="menu-${player.name}" style="display: none;">
                        ${player.online ? `<a onclick="kickPlayer('${player.name}')"><i class="fas fa-door-open"></i> Kick</a>` : ''}
                        ${!player.banned ? `<a onclick="banPlayer('${player.name}')"><i class="fas fa-ban"></i> Ban</a>` : ''}
                        ${player.banned ? `<a onclick="pardonPlayer('${player.name}')"><i class="fas fa-check"></i> Pardon</a>` : ''}
                        ${!player.op ? `<a onclick="opPlayer('${player.name}')"><i class="fas fa-crown"></i> Make OP</a>` : ''}
                        ${player.op ? `<a onclick="deopPlayer('${player.name}')"><i class="fas fa-user"></i> Remove OP</a>` : ''}
                        ${!player.whitelisted ? `<a onclick="whitelistAdd('${player.name}')"><i class="fas fa-plus"></i> Add to Whitelist</a>` : ''}
                        ${player.whitelisted ? `<a onclick="whitelistRemove('${player.name}')"><i class="fas fa-minus"></i> Remove from Whitelist</a>` : ''}
                    </div>
                </div>
            </div>
            ${player.banReason ? `<div class="player-ban-reason">Ban Reason: ${player.banReason}</div>` : ''}
        </div>
    `).join('');

    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.player-actions')) {
            document.querySelectorAll('.player-menu').forEach(menu => {
                menu.style.display = 'none';
            });
        }
    });
}

/**
 * Toggle player action menu
 */
function togglePlayerMenu(playerName) {
    const menu = document.getElementById(`menu-${playerName}`);
    const allMenus = document.querySelectorAll('.player-menu');
    
    allMenus.forEach(m => {
        if (m !== menu) m.style.display = 'none';
    });
    
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

/**
 * View player details (statistics)
 */
async function viewPlayerDetails(playerName) {
    selectedPlayer = allPlayers.find(p => p.name === playerName);
    if (!selectedPlayer) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/stats`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showPlayerStatsModal(selectedPlayer, data.stats);
        } else {
            showPlayerStatsModal(selectedPlayer, null);
        }
    } catch (error) {
        showPlayerStatsModal(selectedPlayer, null);
    }
}

/**
 * Show player statistics modal
 */
function showPlayerStatsModal(player, stats) {
    const modal = document.getElementById('playerStatsModal');
    const content = document.getElementById('playerStatsContent');

    if (!modal || !content) return;

    content.innerHTML = `
        <div class="player-stats-header">
            <img src="https://crafatar.com/avatars/${player.uuid || '8667ba71b85a4004af54457a9734eed7'}?size=128&overlay" 
                 alt="${player.name}"
                 class="player-stats-avatar"
                 onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22128%22 height=%22128%22><rect width=%22128%22 height=%22128%22 fill=%22%23555%22/></svg>'">
            <div class="player-stats-info">
                <h3>${player.name}</h3>
                <div class="player-stats-badges">
                    ${player.online ? '<span class="badge badge-success">Online</span>' : '<span class="badge badge-secondary">Offline</span>'}
                    ${player.op ? '<span class="badge badge-warning">OP</span>' : ''}
                    ${player.whitelisted ? '<span class="badge badge-info">Whitelisted</span>' : ''}
                    ${player.banned ? '<span class="badge badge-danger">Banned</span>' : ''}
                </div>
                ${player.uuid ? `<div class="player-uuid">UUID: ${player.uuid}</div>` : ''}
            </div>
        </div>

        ${stats ? `
            <div class="player-stats-grid">
                <div class="stat-card">
                    <div class="stat-label">Play Time</div>
                    <div class="stat-value">${stats.playTime}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Deaths</div>
                    <div class="stat-value">${stats.deaths}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Mob Kills</div>
                    <div class="stat-value">${stats.mobKills}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Player Kills</div>
                    <div class="stat-value">${stats.playerKills}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Damage Dealt</div>
                    <div class="stat-value">${Math.round(stats.damageDealt / 2)} ❤</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Damage Taken</div>
                    <div class="stat-value">${Math.round(stats.damageTaken / 2)} ❤</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Distance Walked</div>
                    <div class="stat-value">${stats.distanceWalked}m</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Distance Flown</div>
                    <div class="stat-value">${stats.distanceFlown}m</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Jumps</div>
                    <div class="stat-value">${stats.jumps}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Time Since Death</div>
                    <div class="stat-value">${stats.timeSinceLastDeath}</div>
                </div>
            </div>
        ` : `
            <div class="empty-state">
                <p>No statistics available for this player yet.</p>
                <p class="text-muted">Statistics are generated after the player joins the server.</p>
            </div>
        `}
    `;

    modal.style.display = 'block';
}

/**
 * Kick player
 */
async function kickPlayer(playerName) {
    const reason = prompt('Enter kick reason (optional):') || 'Kicked by an operator';
    
    if (!confirm(`Kick player ${playerName}?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/kick`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} kicked`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to kick player');
        }
    } catch (error) {
        showError('Error kicking player');
    }
}

/**
 * Ban player
 */
async function banPlayer(playerName) {
    const reason = prompt('Enter ban reason:') || 'Banned by an operator';
    
    if (!confirm(`Ban player ${playerName}?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/ban`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ reason })
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} banned`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to ban player');
        }
    } catch (error) {
        showError('Error banning player');
    }
}

/**
 * Pardon player
 */
async function pardonPlayer(playerName) {
    if (!confirm(`Pardon player ${playerName}?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/pardon`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} pardoned`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to pardon player');
        }
    } catch (error) {
        showError('Error pardoning player');
    }
}

/**
 * Op player
 */
async function opPlayer(playerName) {
    if (!confirm(`Give operator permissions to ${playerName}?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/op`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} is now an operator`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to op player');
        }
    } catch (error) {
        showError('Error opping player');
    }
}

/**
 * Deop player
 */
async function deopPlayer(playerName) {
    if (!confirm(`Remove operator permissions from ${playerName}?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/deop`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} is no longer an operator`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to deop player');
        }
    } catch (error) {
        showError('Error deopping player');
    }
}

/**
 * Add player to whitelist
 */
async function whitelistAdd(playerName) {
    if (!confirm(`Add ${playerName} to whitelist?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/whitelist`, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} added to whitelist`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to add to whitelist');
        }
    } catch (error) {
        showError('Error adding to whitelist');
    }
}

/**
 * Remove player from whitelist
 */
async function whitelistRemove(playerName) {
    if (!confirm(`Remove ${playerName} from whitelist?`)) return;

    try {
        const response = await fetch(`${window.location.origin}/api/servers/${currentServerId}/players/${playerName}/whitelist`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            showSuccess(`Player ${playerName} removed from whitelist`);
            setTimeout(() => loadPlayers(), 1000);
        } else {
            showError(data.message || 'Failed to remove from whitelist');
        }
    } catch (error) {
        showError('Error removing from whitelist');
    }
}

/**
 * Filter players
 */
function filterPlayers() {
    const searchTerm = document.getElementById('playerSearch')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('playerStatusFilter')?.value || 'all';

    let filtered = allPlayers.filter(player => {
        const matchesSearch = player.name.toLowerCase().includes(searchTerm);
        
        let matchesStatus = true;
        if (statusFilter === 'online') matchesStatus = player.online;
        else if (statusFilter === 'offline') matchesStatus = !player.online;
        else if (statusFilter === 'banned') matchesStatus = player.banned;
        else if (statusFilter === 'whitelisted') matchesStatus = player.whitelisted;
        else if (statusFilter === 'op') matchesStatus = player.op;

        return matchesSearch && matchesStatus;
    });

    renderPlayerList(filtered);
}

/**
 * Close player stats modal
 */
function closePlayerStatsModal() {
    const modal = document.getElementById('playerStatsModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Show loading state
 */
function showLoadingState() {
    const container = document.getElementById('playerList');
    if (container) {
        container.innerHTML = '<div class="loading"><div class="spinner"></div><p>Loading players...</p></div>';
    }
}

/**
 * Show success message
 */
function showSuccess(message) {
    // Use existing notification system from dashboard
    if (window.showNotification) {
        window.showNotification(message, 'success');
    } else {
        alert(message);
    }
}

/**
 * Show error message
 */
function showError(message) {
    // Use existing notification system from dashboard
    if (window.showNotification) {
        window.showNotification(message, 'error');
    } else {
        alert(message);
    }
}

// Export functions to global scope
window.initializePlayerManagement = initializePlayerManagement;
window.loadPlayers = loadPlayers;
window.viewPlayerDetails = viewPlayerDetails;
window.kickPlayer = kickPlayer;
window.banPlayer = banPlayer;
window.pardonPlayer = pardonPlayer;
window.opPlayer = opPlayer;
window.deopPlayer = deopPlayer;
window.whitelistAdd = whitelistAdd;
window.whitelistRemove = whitelistRemove;
window.filterPlayers = filterPlayers;
window.closePlayerStatsModal = closePlayerStatsModal;
window.togglePlayerMenu = togglePlayerMenu;

// Close modal when clicking outside
const playerModalClickHandler = function(event) {
    const modal = document.getElementById('playerStatsModal');
    if (event.target === modal) {
        closePlayerStatsModal();
    }
};

// Add modal handler
if (!window.playerModalHandlerAdded) {
    window.addEventListener('click', playerModalClickHandler);
    window.playerModalHandlerAdded = true;
}

})(); // End of IIFE

