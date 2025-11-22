const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class TaskScheduler {
    constructor() {
        this.tasks = new Map(); // Map of taskId -> { task, cronJob, config }
        this.tasksFile = path.join(__dirname, '../data/tasks.json');
        this.serverManager = null;
        this.backupManager = null;
        this.executionLog = []; // Store last 100 executions
        this.maxLogEntries = 100;
    }

    setServerManager(serverManager) {
        this.serverManager = serverManager;
    }

    setBackupManager(backupManager) {
        this.backupManager = backupManager;
    }

    async initialize() {
        try {
            await this.loadTasks();
            console.log(`✓ Loaded ${this.tasks.size} scheduled tasks`);
        } catch (error) {
            console.error('Failed to initialize task scheduler:', error);
        }
    }

    async loadTasks() {
        try {
            const data = await fs.readFile(this.tasksFile, 'utf8');
            const tasks = JSON.parse(data);
            
            for (const task of tasks) {
                if (task.enabled) {
                    this.scheduleTask(task);
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, create empty array
                await this.saveTasks([]);
            } else {
                throw error;
            }
        }
    }

    async saveTasks(tasks) {
        const dataDir = path.dirname(this.tasksFile);
        try {
            await fs.access(dataDir);
        } catch {
            await fs.mkdir(dataDir, { recursive: true });
        }
        
        await fs.writeFile(this.tasksFile, JSON.stringify(tasks, null, 2));
    }

    async getAllTasks() {
        try {
            const data = await fs.readFile(this.tasksFile, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    scheduleTask(taskConfig) {
        const { id, cronExpression, type, serverId, command, name } = taskConfig;

        // Validate cron expression
        if (!cron.validate(cronExpression)) {
            throw new Error(`Invalid cron expression: ${cronExpression}`);
        }

        // Cancel existing task if any
        if (this.tasks.has(id)) {
            this.cancelTask(id);
        }

        // Create cron job
        const cronJob = cron.schedule(cronExpression, async () => {
            console.log(`⏰ Executing scheduled task: ${name} (${type})`);
            await this.executeTask(taskConfig);
        }, {
            scheduled: true,
            timezone: "Europe/Berlin"
        });

        this.tasks.set(id, {
            config: taskConfig,
            cronJob
        });

        console.log(`✓ Scheduled task: ${name} (${cronExpression})`);
    }

    async executeTask(taskConfig) {
        const { id, type, serverId, command, name } = taskConfig;
        const executionId = uuidv4();
        const startTime = new Date();

        try {
            let result = null;

            switch (type) {
                case 'backup':
                    if (this.backupManager) {
                        result = await this.backupManager.createBackup(serverId, `Auto-Backup: ${name}`);
                    } else {
                        throw new Error('Backup manager not available');
                    }
                    break;

                case 'restart':
                    if (this.serverManager) {
                        await this.serverManager.restartServer(serverId);
                        result = { success: true, message: 'Server restarted' };
                    } else {
                        throw new Error('Server manager not available');
                    }
                    break;

                case 'command':
                    if (this.serverManager) {
                        result = await this.serverManager.sendCommand(serverId, command);
                    } else {
                        throw new Error('Server manager not available');
                    }
                    break;

                case 'start':
                    if (this.serverManager) {
                        result = await this.serverManager.startServer(serverId);
                    } else {
                        throw new Error('Server manager not available');
                    }
                    break;

                case 'stop':
                    if (this.serverManager) {
                        result = await this.serverManager.stopServer(serverId);
                    } else {
                        throw new Error('Server manager not available');
                    }
                    break;

                default:
                    throw new Error(`Unknown task type: ${type}`);
            }

            const endTime = new Date();
            const duration = endTime - startTime;

            this.addExecutionLog({
                id: executionId,
                taskId: id,
                taskName: name,
                type,
                serverId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration,
                success: true,
                result
            });

            console.log(`✓ Task completed: ${name} (${duration}ms)`);
        } catch (error) {
            const endTime = new Date();
            const duration = endTime - startTime;

            this.addExecutionLog({
                id: executionId,
                taskId: id,
                taskName: name,
                type,
                serverId,
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
                duration,
                success: false,
                error: error.message
            });

            console.error(`✗ Task failed: ${name} - ${error.message}`);
        }
    }

    addExecutionLog(entry) {
        this.executionLog.unshift(entry);
        if (this.executionLog.length > this.maxLogEntries) {
            this.executionLog = this.executionLog.slice(0, this.maxLogEntries);
        }
    }

    getExecutionLog(limit = 50) {
        return this.executionLog.slice(0, limit);
    }

    cancelTask(taskId) {
        const task = this.tasks.get(taskId);
        if (task && task.cronJob) {
            task.cronJob.stop();
            this.tasks.delete(taskId);
            console.log(`✓ Cancelled task: ${taskId}`);
        }
    }

    async createTask(taskData) {
        const tasks = await this.getAllTasks();
        const newTask = {
            id: uuidv4(),
            name: taskData.name,
            type: taskData.type,
            serverId: taskData.serverId,
            cronExpression: taskData.cronExpression,
            command: taskData.command || null,
            enabled: taskData.enabled !== false,
            createdAt: new Date().toISOString(),
            lastRun: null
        };

        tasks.push(newTask);
        await this.saveTasks(tasks);

        if (newTask.enabled) {
            this.scheduleTask(newTask);
        }

        return newTask;
    }

    async updateTask(taskId, updates) {
        const tasks = await this.getAllTasks();
        const taskIndex = tasks.findIndex(t => t.id === taskId);

        if (taskIndex === -1) {
            throw new Error('Task not found');
        }

        const updatedTask = { ...tasks[taskIndex], ...updates };
        tasks[taskIndex] = updatedTask;
        await this.saveTasks(tasks);

        // Reschedule if enabled
        this.cancelTask(taskId);
        if (updatedTask.enabled) {
            this.scheduleTask(updatedTask);
        }

        return updatedTask;
    }

    async deleteTask(taskId) {
        const tasks = await this.getAllTasks();
        const filteredTasks = tasks.filter(t => t.id !== taskId);

        if (tasks.length === filteredTasks.length) {
            throw new Error('Task not found');
        }

        await this.saveTasks(filteredTasks);
        this.cancelTask(taskId);
    }

    async toggleTask(taskId) {
        const tasks = await this.getAllTasks();
        const task = tasks.find(t => t.id === taskId);

        if (!task) {
            throw new Error('Task not found');
        }

        task.enabled = !task.enabled;
        await this.saveTasks(tasks);

        if (task.enabled) {
            this.scheduleTask(task);
        } else {
            this.cancelTask(taskId);
        }

        return task;
    }

    stopAll() {
        this.tasks.forEach((task, taskId) => {
            if (task.cronJob) {
                task.cronJob.stop();
            }
        });
        this.tasks.clear();
        console.log('✓ All scheduled tasks stopped');
    }
}

module.exports = new TaskScheduler();
