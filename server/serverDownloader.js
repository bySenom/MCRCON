const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ServerDownloader {
    constructor() {
        this.apis = {
            paper: 'https://api.papermc.io/v2/projects/paper',
            waterfall: 'https://api.papermc.io/v2/projects/waterfall',
            velocity: 'https://api.papermc.io/v2/projects/velocity',
            bungeecord: 'https://ci.md-5.net/job/BungeeCord',
            spigot: 'https://hub.spigotmc.org/versions',
            fabric: 'https://meta.fabricmc.net/v2',
            forge: 'https://files.minecraftforge.net/net/minecraftforge/forge'
        };
    }

    async downloadVanilla(version, serverPath) {
        // Minecraft Vanilla Server Download
        const manifestUrl = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
        
        try {
            // Get version manifest
            const { data: manifest } = await axios.get(manifestUrl);
            const versionInfo = manifest.versions.find(v => v.id === version);
            
            if (!versionInfo) {
                throw new Error(`Version ${version} not found`);
            }

            // Get version details
            const { data: versionData } = await axios.get(versionInfo.url);
            const serverUrl = versionData.downloads.server.url;

            // Download server JAR
            console.log(`Downloading Vanilla ${version}...`);
            const response = await axios.get(serverUrl, { responseType: 'stream' });
            const jarPath = path.join(serverPath, 'server.jar');
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('✓ Vanilla server downloaded');
                    resolve(jarPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Failed to download Vanilla: ${error.message}`);
        }
    }

    async downloadPaper(version, serverPath) {
        try {
            console.log(`Downloading Paper ${version}...`);

            // Get latest build for version
            const { data: versionData } = await axios.get(`${this.apis.paper}/versions/${version}`);
            const latestBuild = versionData.builds[versionData.builds.length - 1];

            // Get build details
            const { data: buildData } = await axios.get(
                `${this.apis.paper}/versions/${version}/builds/${latestBuild}`
            );

            const jarName = buildData.downloads.application.name;
            const downloadUrl = `${this.apis.paper}/versions/${version}/builds/${latestBuild}/downloads/${jarName}`;

            // Download JAR
            const response = await axios.get(downloadUrl, { responseType: 'stream' });
            const jarPath = path.join(serverPath, 'server.jar');
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('✓ Paper server downloaded');
                    resolve(jarPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Failed to download Paper: ${error.message}`);
        }
    }

    async downloadSpigot(version, serverPath) {
        // Note: Spigot requires BuildTools, this is a simplified version
        throw new Error('Spigot requires BuildTools. Use Paper instead or manually build Spigot.');
    }

    async downloadFabric(mcVersion, serverPath) {
        try {
            console.log(`Downloading Fabric for MC ${mcVersion}...`);

            // Get latest loader version
            const { data: loaders } = await axios.get(`${this.apis.fabric}/versions/loader`);
            const latestLoader = loaders[0].version;

            // Get installer version
            const { data: installers } = await axios.get(`${this.apis.fabric}/versions/installer`);
            const latestInstaller = installers[0].version;

            // Download Fabric server launcher
            const downloadUrl = `${this.apis.fabric}/versions/loader/${mcVersion}/${latestLoader}/${latestInstaller}/server/jar`;
            
            const response = await axios.get(downloadUrl, { responseType: 'stream' });
            const jarPath = path.join(serverPath, 'server.jar');
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('✓ Fabric server downloaded');
                    resolve(jarPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Failed to download Fabric: ${error.message}`);
        }
    }

    async downloadForge(mcVersion, serverPath) {
        // Forge download is complex due to their download system
        throw new Error('Forge download not yet implemented. Please download manually from https://files.minecraftforge.net/');
    }

    async downloadWaterfall(version, serverPath) {
        try {
            console.log(`Downloading Waterfall ${version}...`);

            // Get latest build for version
            const { data: versionData } = await axios.get(`${this.apis.waterfall}/versions/${version}`);
            const latestBuild = versionData.builds[versionData.builds.length - 1];

            // Get build details
            const { data: buildData } = await axios.get(
                `${this.apis.waterfall}/versions/${version}/builds/${latestBuild}`
            );

            const jarName = buildData.downloads.application.name;
            const downloadUrl = `${this.apis.waterfall}/versions/${version}/builds/${latestBuild}/downloads/${jarName}`;

            // Download JAR
            const response = await axios.get(downloadUrl, { responseType: 'stream' });
            const jarPath = path.join(serverPath, 'server.jar');
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('✓ Waterfall proxy downloaded');
                    resolve(jarPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Failed to download Waterfall: ${error.message}`);
        }
    }

    async downloadBungeeCord(version, serverPath) {
        try {
            console.log(`Downloading BungeeCord (latest)...`);

            // BungeeCord uses Jenkins CI
            // Get latest successful build
            const { data: buildData } = await axios.get(`${this.apis.bungeecord}/lastSuccessfulBuild/api/json`);
            
            // Find BungeeCord.jar artifact
            const artifact = buildData.artifacts.find(a => a.fileName === 'BungeeCord.jar');
            
            if (!artifact) {
                throw new Error('BungeeCord.jar not found in latest build');
            }

            const downloadUrl = `${this.apis.bungeecord}/lastSuccessfulBuild/artifact/${artifact.relativePath}`;

            // Download JAR
            const response = await axios.get(downloadUrl, { responseType: 'stream' });
            const jarPath = path.join(serverPath, 'server.jar');
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('✓ BungeeCord proxy downloaded');
                    resolve(jarPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Failed to download BungeeCord: ${error.message}`);
        }
    }

    async downloadVelocity(version, serverPath) {
        try {
            console.log(`Downloading Velocity ${version}...`);

            // Get latest build for version
            const { data: versionData } = await axios.get(`${this.apis.velocity}/versions/${version}`);
            const latestBuild = versionData.builds[versionData.builds.length - 1];

            // Get build details
            const { data: buildData } = await axios.get(
                `${this.apis.velocity}/versions/${version}/builds/${latestBuild}`
            );

            const jarName = buildData.downloads.application.name;
            const downloadUrl = `${this.apis.velocity}/versions/${version}/builds/${latestBuild}/downloads/${jarName}`;

            // Download JAR
            const response = await axios.get(downloadUrl, { responseType: 'stream' });
            const jarPath = path.join(serverPath, 'velocity.jar');
            const writer = require('fs').createWriteStream(jarPath);

            response.data.pipe(writer);

            return new Promise((resolve, reject) => {
                writer.on('finish', () => {
                    console.log('✓ Velocity proxy downloaded');
                    resolve(jarPath);
                });
                writer.on('error', reject);
            });

        } catch (error) {
            throw new Error(`Failed to download Velocity: ${error.message}`);
        }
    }

    async downloadServer(type, version, serverPath) {
        // Ensure server path exists
        await fs.mkdir(serverPath, { recursive: true });

        // Accept EULA automatically (not needed for proxies)
        if (!['bungeecord', 'waterfall', 'velocity'].includes(type.toLowerCase())) {
            const eulaPath = path.join(serverPath, 'eula.txt');
            await fs.writeFile(eulaPath, 'eula=true\n');
        }

        switch (type.toLowerCase()) {
            case 'vanilla':
                return await this.downloadVanilla(version, serverPath);
            case 'paper':
                return await this.downloadPaper(version, serverPath);
            case 'spigot':
                return await this.downloadSpigot(version, serverPath);
            case 'fabric':
                return await this.downloadFabric(version, serverPath);
            case 'forge':
                return await this.downloadForge(version, serverPath);
            case 'waterfall':
                return await this.downloadWaterfall(version, serverPath);
            case 'velocity':
                return await this.downloadVelocity(version, serverPath);
            case 'bungeecord':
                return await this.downloadBungeeCord(version, serverPath);
            default:
                throw new Error(`Unknown server type: ${type}`);
        }
    }

    async getAvailableVersions(type) {
        try {
            // Helper function to sort versions in descending order (newest first)
            const sortVersions = (versions) => {
                return [...versions].sort((a, b) => {
                    const aParts = a.split('.').map(part => {
                        const match = part.match(/^(\d+)/);
                        return match ? Number(match[1]) : 0;
                    });
                    const bParts = b.split('.').map(part => {
                        const match = part.match(/^(\d+)/);
                        return match ? Number(match[1]) : 0;
                    });
                    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                        const aVal = aParts[i] || 0;
                        const bVal = bParts[i] || 0;
                        if (aVal !== bVal) return bVal - aVal; // Descending: newest first
                    }
                    return 0;
                });
            };

            switch (type.toLowerCase()) {
                case 'vanilla':
                case 'paper': {
                    const { data: paperVersions } = await axios.get(`${this.apis.paper}`);
                    return sortVersions(paperVersions.versions);
                }
                case 'waterfall': {
                    const { data: waterfallVersions } = await axios.get(`${this.apis.waterfall}`);
                    return sortVersions(waterfallVersions.versions);
                }
                case 'velocity': {
                    const { data: velocityVersions } = await axios.get(`${this.apis.velocity}`);
                    return sortVersions(velocityVersions.versions);
                }
                case 'bungeecord':
                    return ['latest']; // BungeeCord only has latest from CI
                case 'fabric': {
                    const { data: fabricVersions } = await axios.get(`${this.apis.fabric}/versions/game`);
                    const stableVersions = fabricVersions.filter(v => v.stable).map(v => v.version);
                    return sortVersions(stableVersions);
                }
                default:
                    return sortVersions(['1.20.4', '1.20.2', '1.20.1', '1.19.4', '1.19.2']); // Fallback
            }
        } catch (error) {
            console.error('Error fetching versions:', error);
            return ['1.20.4', '1.20.2', '1.20.1']; // Fallback
        }
    }
}

module.exports = new ServerDownloader();
