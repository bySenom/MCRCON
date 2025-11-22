const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class PluginManager {
    constructor() {
        this.apis = {
            modrinth: 'https://api.modrinth.com/v2',
            spigot: 'https://api.spiget.org/v2',
            hangar: 'https://hangar.papermc.io/api/v1'
        };
    }

    /**
     * Search for plugins on Modrinth
     * @param {string} query - Search query
     * @param {string} loader - 'paper', 'spigot', 'fabric', 'forge'
     * @param {string} version - Minecraft version
     */
    async searchModrinth(query, loader = 'paper', version = null) {
        try {
            const facets = [
                ['project_type:mod', 'project_type:plugin']
            ];

            if (loader) {
                const loaderMap = {
                    paper: 'paper',
                    spigot: 'bukkit',
                    fabric: 'fabric',
                    forge: 'forge'
                };
                facets.push([`categories:${loaderMap[loader]}`]);
            }

            if (version) {
                facets.push([`versions:${version}`]);
            }

            const params = {
                query,
                facets: JSON.stringify(facets),
                limit: 20
            };

            const { data } = await axios.get(`${this.apis.modrinth}/search`, { params });

            return data.hits.map(hit => ({
                id: hit.project_id,
                slug: hit.slug,
                name: hit.title,
                description: hit.description,
                author: hit.author,
                downloads: hit.downloads,
                icon: hit.icon_url,
                categories: hit.categories,
                source: 'modrinth'
            }));
        } catch (error) {
            console.error('Modrinth search error:', error.message);
            return [];
        }
    }

    /**
     * Search for plugins on SpigotMC
     * @param {string} query - Search query
     */
    async searchSpigot(query) {
        try {
            const { data } = await axios.get(`${this.apis.spigot}/search/resources/${encodeURIComponent(query)}?size=20`);

            return data.map(resource => ({
                id: resource.id,
                name: resource.name,
                tag: resource.tag,
                author: resource.author?.name || 'Unknown',
                downloads: resource.downloads,
                rating: resource.rating?.average || 0,
                icon: resource.icon?.url,
                source: 'spigot'
            }));
        } catch (error) {
            console.error('Spigot search error:', error.message);
            return [];
        }
    }

    /**
     * Get plugin versions from Modrinth
     * @param {string} projectId - Modrinth project ID
     * @param {string} mcVersion - Minecraft version filter
     */
    async getModrinthVersions(projectId, mcVersion = null) {
        try {
            const params = mcVersion ? { game_versions: `["${mcVersion}"]` } : {};
            const { data } = await axios.get(`${this.apis.modrinth}/project/${projectId}/version`, { params });

            return data.map(version => ({
                id: version.id,
                name: version.name,
                version: version.version_number,
                mcVersions: version.game_versions,
                loaders: version.loaders,
                downloads: version.downloads,
                published: version.date_published,
                files: version.files.map(f => ({
                    url: f.url,
                    filename: f.filename,
                    size: f.size,
                    primary: f.primary
                }))
            }));
        } catch (error) {
            console.error('Error fetching Modrinth versions:', error.message);
            return [];
        }
    }

    /**
     * Get plugin details from Spigot
     * @param {number} resourceId - Spigot resource ID
     */
    async getSpigotDetails(resourceId) {
        try {
            const { data } = await axios.get(`${this.apis.spigot}/resources/${resourceId}`);
            const versions = await axios.get(`${this.apis.spigot}/resources/${resourceId}/versions`);

            return {
                id: data.id,
                name: data.name,
                tag: data.tag,
                description: data.description,
                author: data.author?.name,
                downloads: data.downloads,
                rating: data.rating?.average || 0,
                versions: versions.data.map(v => ({
                    id: v.id,
                    name: v.name,
                    published: v.releaseDate
                })),
                downloadUrl: `https://api.spiget.org/v2/resources/${resourceId}/download`
            };
        } catch (error) {
            console.error('Error fetching Spigot details:', error.message);
            return null;
        }
    }

    /**
     * Download plugin/mod file
     * @param {string} url - Download URL
     * @param {string} destination - Destination path (plugins/mods folder)
     * @param {string} filename - File name
     */
    async downloadFile(url, destination, filename) {
        try {
            console.log(`Downloading ${filename}...`);

            // Ensure destination directory exists
            await fs.mkdir(destination, { recursive: true });

            const response = await axios.get(url, {
                responseType: 'stream',
                headers: {
                    'User-Agent': 'MinecraftServerManager/2.0'
                }
            });

            const filePath = path.join(destination, filename);
            const writer = require('fs').createWriteStream(filePath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log(`✓ Downloaded ${filename}`);
                    resolve(filePath);
                });
                writer.on('error', reject);
            });
        } catch (error) {
            throw new Error(`Failed to download: ${error.message}`);
        }
    }

    /**
     * Install plugin/mod to server
     * @param {string} serverId - Server ID
     * @param {string} serverPath - Server directory path
     * @param {string} serverType - Server type (paper/fabric/forge)
     * @param {object} fileInfo - File info {url, filename}
     */
    async installToServer(serverId, serverPath, serverType, fileInfo) {
        try {
            // Determine folder based on server type
            const folder = (serverType === 'fabric' || serverType === 'forge') ? 'mods' : 'plugins';
            const destination = path.join(serverPath, folder);

            // Download file
            const filePath = await this.downloadFile(fileInfo.url, destination, fileInfo.filename);

            return {
                success: true,
                path: filePath,
                folder
            };
        } catch (error) {
            throw new Error(`Installation failed: ${error.message}`);
        }
    }

    /**
     * List installed plugins/mods for a server
     * @param {string} serverPath - Server directory path
     * @param {string} serverType - Server type
     */
    async listInstalled(serverPath, serverType) {
        try {
            const folder = (serverType === 'fabric' || serverType === 'forge') ? 'mods' : 'plugins';
            const targetPath = path.join(serverPath, folder);

            try {
                const files = await fs.readdir(targetPath);
                const jarFiles = files.filter(f => f.endsWith('.jar'));

                const stats = await Promise.all(
                    jarFiles.map(async (file) => {
                        const filePath = path.join(targetPath, file);
                        const stat = await fs.stat(filePath);
                        return {
                            name: file,
                            size: stat.size,
                            modified: stat.mtime
                        };
                    })
                );

                return stats;
            } catch (error) {
                // Folder doesn't exist yet
                return [];
            }
        } catch (error) {
            console.error('Error listing installed:', error.message);
            return [];
        }
    }

    /**
     * Delete plugin/mod from server
     * @param {string} serverPath - Server directory path
     * @param {string} serverType - Server type
     * @param {string} filename - Plugin filename
     */
    async uninstall(serverPath, serverType, filename) {
        try {
            const folder = (serverType === 'fabric' || serverType === 'forge') ? 'mods' : 'plugins';
            const filePath = path.join(serverPath, folder, filename);

            await fs.unlink(filePath);
            console.log(`✓ Deleted ${filename}`);

            return true;
        } catch (error) {
            throw new Error(`Failed to delete: ${error.message}`);
        }
    }
}

module.exports = new PluginManager();
