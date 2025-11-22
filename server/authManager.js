const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const USERS_FILE = path.join(__dirname, '../data/users.json');
const JWT_SECRET = process.env.JWT_SECRET || 'minecraft-server-manager-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d'; // Token valid for 7 days

// Ensure users file exists
if (!fs.existsSync(USERS_FILE)) {
    const dataDir = path.dirname(USERS_FILE);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify({ users: [] }, null, 2));
}

/**
 * Load users from file
 */
function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data).users || [];
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

/**
 * Save users to file
 */
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving users:', error);
        return false;
    }
}

/**
 * Register a new user
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @param {string} role - User role (admin or user)
 * @returns {Promise<object>} User object (without password)
 */
async function register(username, password, role = 'user') {
    const users = loadUsers();

    // Check if username already exists
    if (users.find(u => u.username === username)) {
        throw new Error('Username already exists');
    }

    // Validate role
    if (!['admin', 'user'].includes(role)) {
        throw new Error('Invalid role. Must be admin or user');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user object
    const user = {
        id: Date.now().toString(),
        username: username,
        password: hashedPassword,
        role: role,
        createdAt: new Date().toISOString()
    };

    // Save user
    users.push(user);
    saveUsers(users);

    // Return user without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

/**
 * Login user
 * @param {string} username - Username
 * @param {string} password - Plain text password
 * @returns {Promise<object>} Object with token and user info
 */
async function login(username, password) {
    const users = loadUsers();

    // Find user
    const user = users.find(u => u.username === username);
    if (!user) {
        throw new Error('Invalid username or password');
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        throw new Error('Invalid username or password');
    }

    // Generate JWT token
    const token = jwt.sign(
        { 
            id: user.id, 
            username: user.username, 
            role: user.role 
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    // Return token and user info (without password)
    const { password: _, ...userWithoutPassword } = user;
    return {
        token,
        user: userWithoutPassword
    };
}

/**
 * Verify JWT token
 * @param {string} token - JWT token
 * @returns {object} Decoded token payload
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
}

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {object} User object (without password)
 */
function getUserById(userId) {
    const users = loadUsers();
    const user = users.find(u => u.id === userId);
    
    if (!user) {
        throw new Error('User not found');
    }

    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
}

/**
 * Get all users (admin only)
 * @returns {Array<object>} Array of users (without passwords)
 */
function getAllUsers() {
    const users = loadUsers();
    return users.map(({ password: _, ...user }) => user);
}

/**
 * Delete user (admin only)
 * @param {string} userId - User ID to delete
 * @returns {boolean} Success
 */
function deleteUser(userId) {
    let users = loadUsers();
    const initialLength = users.length;
    
    users = users.filter(u => u.id !== userId);
    
    if (users.length === initialLength) {
        throw new Error('User not found');
    }

    saveUsers(users);
    return true;
}

/**
 * Middleware to verify JWT token from request
 */
function authMiddleware(req, res, next) {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Verify token
        const decoded = verifyToken(token);
        
        // Attach user info to request
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
}

/**
 * Middleware to check if user is admin
 */
function adminMiddleware(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
    }
    next();
}

module.exports = {
    register,
    login,
    verifyToken,
    getUserById,
    getAllUsers,
    deleteUser,
    authMiddleware,
    adminMiddleware
};
