# Security & Authentication

## Multi-User Authentication System

The Minecraft Server Manager now includes a complete multi-user authentication system with role-based access control.

### Features

#### User Roles
- **Admin**: Full access to all servers and users
- **User**: Access only to their own servers

#### Authentication Flow
1. User registers with username, password, and role
2. User logs in to receive JWT token (7-day expiration)
3. Token stored in localStorage
4. Token sent with every API request via Authorization header
5. Backend verifies token and attaches user info to request

### API Endpoints

#### Authentication Endpoints (Public)
- `POST /api/auth/register` - Create new user
  - Body: `{ username, password, role }`
  - Response: `{ success, message, user }`

- `POST /api/auth/login` - Login and get JWT token
  - Body: `{ username, password }`
  - Response: `{ success, token, user }`

- `GET /api/auth/verify` - Verify token validity (Protected)
  - Headers: `Authorization: Bearer <token>`
  - Response: `{ success, user }`

#### User Management Endpoints (Admin Only)
- `GET /api/auth/users` - List all users
- `DELETE /api/auth/users/:id` - Delete user

#### Protected Server Endpoints
All server management endpoints now require authentication:
- `GET /api/servers` - Returns filtered servers based on user role
- `GET /api/servers/:id` - Requires server access permission
- `POST /api/servers/create` - Creates server owned by current user
- `POST /api/servers/:id/start` - Requires server access
- `POST /api/servers/:id/stop` - Requires server access
- `POST /api/servers/:id/restart` - Requires server access
- `DELETE /api/servers/:id` - Requires server access
- All backup, plugin, config, and file endpoints require server access

### Access Control

#### Server Ownership
- Each server has a `userId` field identifying the owner
- Owner is automatically set when creating a server
- Existing servers (with null userId) are accessible to all until assigned

#### Permission Checks
- **Admin users**: Can access all servers regardless of ownership
- **Regular users**: Can only access servers where `server.userId === user.id`
- 403 Forbidden returned when user lacks permission

### Frontend Integration

#### Authentication Headers
All API requests include JWT token:
```javascript
headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
}
```

#### Protected Routes
- Dashboard checks authentication on page load
- Redirects to login if token is invalid or missing
- Logout button clears token and redirects to login

### Security Features

#### Password Security
- Passwords hashed with bcryptjs (10 salt rounds)
- Plaintext passwords never stored
- Password strength indicator in registration UI

#### Token Security
- JWT tokens signed with secret key
- 7-day expiration
- Token verification on every protected endpoint
- No token refresh (user must login again after expiration)

#### API Protection
- All sensitive endpoints protected with middleware
- Role-based access control (RBAC)
- Per-server permission checks

### Files Changed

#### Backend
- `server/authManager.js` (NEW) - Authentication logic and middleware
- `server/serverManager.js` - Added userId field and access control methods
- `server/index.js` - Protected all server management endpoints

#### Frontend
- `public/login.html` (NEW) - Login interface
- `public/register.html` (NEW) - Registration interface
- `public/js/dashboard.js` - Auth check and token handling
- `public/js/serverDetails.js` - Auth headers on all requests
- `public/js/plugins.js` - Auth headers on all requests
- `public/dashboard.html` - User info display and logout button

### Database Schema

#### Users Database (`data/users.json`)
```json
{
  "users": [
    {
      "id": "uuid-v4",
      "username": "string",
      "password": "bcrypt-hashed",
      "role": "admin|user",
      "createdAt": "ISO8601"
    }
  ]
}
```

#### Server Schema (Updated)
```json
{
  "id": "uuid-v4",
  "name": "string",
  "userId": "uuid-v4",  // NEW: Owner's user ID
  // ... other fields
}
```

### Testing

1. Open http://localhost:3000/register.html
2. Create an admin user
3. Login at http://localhost:3000/login.html
4. Verify dashboard loads with user info in header
5. Create a server (should be owned by you)
6. Logout and create a new regular user
7. Login as regular user
8. Verify you only see your own servers (not admin's servers)
9. Try accessing admin's server by URL (should get 403)

### Migration Notes

**Existing Servers**: Servers created before authentication was implemented have `userId: null`. These servers are currently accessible to all users. To assign ownership:

1. Manually edit `data/servers.json`
2. Set `userId` field to the appropriate user's ID
3. Restart the server

Or create a migration script to bulk assign servers to a specific admin user.

### Future Enhancements

- Token refresh mechanism
- Password reset functionality
- Email verification
- Two-factor authentication (2FA)
- Session management (force logout)
- Audit logging (track all actions)
- IP whitelisting
- Rate limiting on auth endpoints
- OAuth integration (GitHub, Discord, etc.)
