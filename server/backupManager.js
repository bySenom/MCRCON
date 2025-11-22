const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const BACKUPS_DIR = path.join(__dirname, '../backups');

// Ensure backups directory exists
if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

/**
 * Create a backup of a server
 * @param {string} serverId - Server UUID
 * @param {string} serverPath - Path to server directory
 * @param {string} backupName - Optional custom backup name
 * @returns {Promise<object>} Backup info
 */
async function createBackup(serverId, serverPath, backupName = null) {
    return new Promise((resolve, reject) => {
        // Create server backup directory
        const serverBackupDir = path.join(BACKUPS_DIR, serverId);
        if (!fs.existsSync(serverBackupDir)) {
            fs.mkdirSync(serverBackupDir, { recursive: true });
        }

        // Generate backup filename
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const name = backupName || `backup-${timestamp}`;
        const backupId = `${name}-${Date.now()}`;
        const backupFile = path.join(serverBackupDir, `${backupId}.zip`);

        // Create write stream
        const output = fs.createWriteStream(backupFile);
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        output.on('close', () => {
            const stats = fs.statSync(backupFile);
            resolve({
                id: backupId,
                name: name,
                serverId: serverId,
                timestamp: new Date().toISOString(),
                size: stats.size,
                path: backupFile
            });
        });

        archive.on('error', (err) => {
            reject(err);
        });

        // Pipe archive to file
        archive.pipe(output);

        // Exclude certain directories
        const excludeDirs = ['logs', 'crash-reports', 'debug'];
        
        // Add all files except excluded directories
        archive.glob('**/*', {
            cwd: serverPath,
            ignore: excludeDirs.map(dir => `${dir}/**`)
        });

        archive.finalize();
    });
}

/**
 * List all backups for a server
 * @param {string} serverId - Server UUID
 * @returns {Array<object>} Array of backup info
 */
function listBackups(serverId) {
    const serverBackupDir = path.join(BACKUPS_DIR, serverId);
    
    if (!fs.existsSync(serverBackupDir)) {
        return [];
    }

    const files = fs.readdirSync(serverBackupDir);
    const backups = files
        .filter(file => file.endsWith('.zip'))
        .map(file => {
            const filePath = path.join(serverBackupDir, file);
            const stats = fs.statSync(filePath);
            const backupId = file.replace('.zip', '');
            
            // Extract name from backup ID (remove timestamp suffix)
            const lastDash = backupId.lastIndexOf('-');
            const name = lastDash !== -1 ? backupId.substring(0, lastDash) : backupId;

            return {
                id: backupId,
                name: name,
                serverId: serverId,
                timestamp: stats.mtime.toISOString(),
                size: stats.size,
                path: filePath
            };
        })
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return backups;
}

/**
 * Restore a backup
 * @param {string} serverId - Server UUID
 * @param {string} backupId - Backup ID
 * @param {string} serverPath - Path to server directory
 * @returns {Promise<boolean>} Success
 */
async function restoreBackup(serverId, backupId, serverPath) {
    return new Promise((resolve, reject) => {
        const backupFile = path.join(BACKUPS_DIR, serverId, `${backupId}.zip`);

        if (!fs.existsSync(backupFile)) {
            return reject(new Error('Backup not found'));
        }

        // Create temporary extraction directory
        const tempDir = path.join(serverPath, '_restore_temp');
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tempDir, { recursive: true });

        const extract = require('extract-zip');
        
        extract(backupFile, { dir: tempDir })
            .then(() => {
                // Move files from temp to server directory
                const files = fs.readdirSync(tempDir);
                files.forEach(file => {
                    const sourcePath = path.join(tempDir, file);
                    const destPath = path.join(serverPath, file);
                    
                    // Remove existing file/folder
                    if (fs.existsSync(destPath)) {
                        fs.rmSync(destPath, { recursive: true, force: true });
                    }
                    
                    // Move from temp
                    fs.renameSync(sourcePath, destPath);
                });

                // Cleanup temp directory
                fs.rmSync(tempDir, { recursive: true, force: true });
                
                resolve(true);
            })
            .catch(reject);
    });
}

/**
 * Delete a backup
 * @param {string} serverId - Server UUID
 * @param {string} backupId - Backup ID
 * @returns {boolean} Success
 */
function deleteBackup(serverId, backupId) {
    const backupFile = path.join(BACKUPS_DIR, serverId, `${backupId}.zip`);
    
    if (!fs.existsSync(backupFile)) {
        throw new Error('Backup not found');
    }

    fs.unlinkSync(backupFile);
    return true;
}

/**
 * Get backup file path for download
 * @param {string} serverId - Server UUID
 * @param {string} backupId - Backup ID
 * @returns {string} Path to backup file
 */
function getBackupPath(serverId, backupId) {
    const backupFile = path.join(BACKUPS_DIR, serverId, `${backupId}.zip`);
    
    if (!fs.existsSync(backupFile)) {
        throw new Error('Backup not found');
    }

    return backupFile;
}

module.exports = {
    createBackup,
    listBackups,
    restoreBackup,
    deleteBackup,
    getBackupPath
};
