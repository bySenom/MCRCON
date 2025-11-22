# 🚀 Production Deployment Guide - Minecraft Server Manager

Complete guide for deploying the Minecraft Server Manager to a production environment.

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Application Configuration](#application-configuration)
4. [Reverse Proxy Setup (Nginx)](#reverse-proxy-setup-nginx)
5. [SSL/TLS Configuration](#ssltls-configuration)
6. [Process Management (PM2)](#process-management-pm2)
7. [Security Hardening](#security-hardening)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup Strategy](#backup-strategy)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **OS**: Ubuntu 20.04+ / Debian 11+ / CentOS 8+ (or Windows Server 2019+)
- **CPU**: 2+ cores recommended (4+ for multiple servers)
- **RAM**: 4GB minimum (8GB+ recommended)
- **Storage**: 50GB+ SSD (depends on number of Minecraft servers)
- **Node.js**: v16+ (v18+ recommended)
- **Java**: JRE 17+ for Minecraft servers

### Required Software

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Java (for Minecraft servers)
sudo apt install -y openjdk-17-jre-headless

# Install Nginx
sudo apt install -y nginx

# Install PM2 globally
sudo npm install -g pm2

# Install Git (if cloning from repository)
sudo apt install -y git
```

---

## Server Setup

### 1. Create Application User

```bash
# Create dedicated user for security
sudo adduser --system --group mcmanager
sudo usermod -aG sudo mcmanager

# Switch to user
sudo su - mcmanager
```

### 2. Clone/Upload Application

```bash
# Option A: Clone from Git
cd /opt
sudo git clone https://github.com/yourusername/minecraft-server-manager.git
sudo chown -R mcmanager:mcmanager minecraft-server-manager

# Option B: Upload via SCP
scp -r ./MCRCON user@server:/opt/minecraft-server-manager
```

### 3. Install Dependencies

```bash
cd /opt/minecraft-server-manager
npm install --production
```

---

## Application Configuration

### 1. Environment Variables

```bash
# Copy example file
cp .env.example .env

# Edit with your settings
nano .env
```

**Critical Settings for Production:**

```env
# Set to production
NODE_ENV=production

# Strong JWT secret (generate with: openssl rand -base64 32)
JWT_SECRET=YOUR_GENERATED_SECRET_HERE

# Your actual domain(s)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# Adjust rate limiting
RATE_LIMIT_MAX=200

# Set port (typically 3000, Nginx will reverse proxy)
PORT=3000
```

### 2. Create Data Directories

```bash
# Create necessary directories
mkdir -p data logs backups minecraft_servers

# Set proper permissions
chmod 755 data logs backups minecraft_servers
```

### 3. Initialize Database

```bash
# Create initial users.json
echo '[]' > data/users.json

# Create servers.json
echo '[]' > data/servers.json

# Create webhooks.json
echo '[]' > data/webhooks.json

# Set permissions
chmod 644 data/*.json
```

---

## Reverse Proxy Setup (Nginx)

### 1. Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/mcmanager
```

**Configuration:**

```nginx
# HTTP - Redirect to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Redirect all HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    # SSL Configuration (will be added by Certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy settings
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket timeouts
        proxy_connect_timeout 7d;
        proxy_send_timeout 7d;
        proxy_read_timeout 7d;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3000;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Max upload size (for backups, world uploads)
    client_max_body_size 500M;

    # Logs
    access_log /var/log/nginx/mcmanager_access.log;
    error_log /var/log/nginx/mcmanager_error.log;
}
```

### 2. Enable Configuration

```bash
# Test configuration
sudo nginx -t

# Enable site
sudo ln -s /etc/nginx/sites-available/mcmanager /etc/nginx/sites-enabled/

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL/TLS Configuration

### Using Let's Encrypt (Certbot)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate (interactive)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test automatic renewal
sudo certbot renew --dry-run

# Certbot will automatically update Nginx config
```

### Manual SSL Certificate

If using custom SSL certificate:

```nginx
ssl_certificate /path/to/your/certificate.crt;
ssl_certificate_key /path/to/your/private.key;
ssl_trusted_certificate /path/to/your/ca-bundle.crt;
```

---

## Process Management (PM2)

### 1. Start Application with PM2

```bash
cd /opt/minecraft-server-manager

# Start with PM2
pm2 start server/index.js --name mcmanager

# Save PM2 process list
pm2 save

# Enable PM2 startup on boot
pm2 startup systemd
# Run the command it outputs

# Verify it's running
pm2 list
pm2 logs mcmanager
```

### 2. PM2 Configuration File (Optional)

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'mcmanager',
    script: './server/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

Then start with:

```bash
pm2 start ecosystem.config.js
```

### 3. PM2 Useful Commands

```bash
# View logs
pm2 logs mcmanager

# Monitor resources
pm2 monit

# Restart application
pm2 restart mcmanager

# Reload (zero-downtime)
pm2 reload mcmanager

# Stop application
pm2 stop mcmanager

# Delete from PM2
pm2 delete mcmanager

# View detailed info
pm2 info mcmanager
```

---

## Security Hardening

### 1. Firewall Configuration (UFW)

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow Minecraft server ports (example range)
sudo ufw allow 25565:25600/tcp

# Deny all other incoming
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Verify rules
sudo ufw status verbose
```

### 2. Fail2Ban Setup

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Create jail for web app
sudo nano /etc/fail2ban/jail.local
```

```ini
[mcmanager]
enabled = true
port = http,https
filter = mcmanager
logpath = /var/log/nginx/mcmanager_access.log
maxretry = 5
bantime = 3600
findtime = 600
```

Create filter:

```bash
sudo nano /etc/fail2ban/filter.d/mcmanager.conf
```

```ini
[Definition]
failregex = ^<HOST> .* "(GET|POST).*" (401|403|429) .*$
ignoreregex =
```

Restart Fail2Ban:

```bash
sudo systemctl restart fail2ban
sudo fail2ban-client status mcmanager
```

### 3. Additional Security

```bash
# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart sshd

# Keep system updated
sudo apt update && sudo apt upgrade -y

# Enable automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## Monitoring & Logging

### 1. Application Logs

```bash
# View PM2 logs
pm2 logs mcmanager --lines 100

# View application logs
tail -f logs/*.log

# View Nginx logs
sudo tail -f /var/log/nginx/mcmanager_access.log
sudo tail -f /var/log/nginx/mcmanager_error.log
```

### 2. System Monitoring

```bash
# Monitor resources
htop

# Disk usage
df -h

# Check PM2 status
pm2 status

# Monitor Nginx
sudo systemctl status nginx
```

### 3. Log Rotation

Create logrotate config:

```bash
sudo nano /etc/logrotate.d/mcmanager
```

```
/opt/minecraft-server-manager/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 mcmanager mcmanager
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

---

## Backup Strategy

### 1. Database Backups

```bash
# Create backup script
nano /opt/minecraft-server-manager/backup-db.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/minecraft-server-manager/backups/db"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup data directory
tar -czf $BACKUP_DIR/data_$TIMESTAMP.tar.gz /opt/minecraft-server-manager/data

# Keep only last 7 days
find $BACKUP_DIR -type f -mtime +7 -delete

echo "Backup completed: data_$TIMESTAMP.tar.gz"
```

```bash
chmod +x backup-db.sh
```

### 2. Automated Backups (Cron)

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * /opt/minecraft-server-manager/backup-db.sh >> /opt/minecraft-server-manager/logs/backup.log 2>&1

# Backup Minecraft servers weekly (Sunday 3 AM)
0 3 * * 0 tar -czf /opt/minecraft-server-manager/backups/mc_servers_$(date +\%Y\%m\%d).tar.gz /opt/minecraft-server-manager/minecraft_servers
```

### 3. Off-site Backups

```bash
# Install rclone for cloud backups
curl https://rclone.org/install.sh | sudo bash

# Configure rclone (interactive)
rclone config

# Sync backups to cloud storage
rclone sync /opt/minecraft-server-manager/backups remote:mcmanager-backups
```

---

## Troubleshooting

### Common Issues

**1. Application won't start**
```bash
# Check logs
pm2 logs mcmanager

# Verify port is available
sudo netstat -tulpn | grep 3000

# Check Node.js version
node --version

# Verify environment variables
pm2 env mcmanager
```

**2. WebSocket connection fails**
```bash
# Check Nginx WebSocket config
sudo nginx -t

# Verify reverse proxy headers
curl -i http://localhost:3000

# Check firewall rules
sudo ufw status
```

**3. High memory usage**
```bash
# Monitor PM2 processes
pm2 monit

# Restart with memory limit
pm2 restart mcmanager --max-memory-restart 1G

# Check for memory leaks
pm2 logs mcmanager | grep "memory"
```

**4. SSL certificate issues**
```bash
# Test SSL
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal

# Check Nginx SSL config
sudo nginx -t
```

### Performance Optimization

```bash
# Enable Nginx caching
# Add to Nginx config:
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=mcmanager_cache:10m max_size=100m inactive=60m use_temp_path=off;

# Enable gzip compression
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
```

---

## Health Check Endpoints

The application provides health check endpoints:

```bash
# Check application status
curl http://localhost:3000/api/health

# Check from external (after deployment)
curl https://yourdomain.com/api/health
```

---

## Production Checklist

- [ ] Node.js 16+ installed
- [ ] Java 17+ installed (for Minecraft servers)
- [ ] Application cloned and dependencies installed
- [ ] `.env` configured with production values
- [ ] JWT_SECRET changed to strong random value
- [ ] NODE_ENV set to `production`
- [ ] ALLOWED_ORIGINS configured with actual domain(s)
- [ ] PM2 configured and application running
- [ ] PM2 startup script enabled
- [ ] Nginx installed and configured
- [ ] SSL certificate obtained and installed
- [ ] Firewall (UFW) configured
- [ ] Fail2Ban configured
- [ ] Log rotation configured
- [ ] Automated backups scheduled
- [ ] Monitoring setup (optional: Grafana, Prometheus)
- [ ] DNS records pointed to server
- [ ] Initial admin user created
- [ ] Tested all critical features
- [ ] Documentation reviewed

---

## Support & Maintenance

### Regular Maintenance Tasks

**Daily:**
- Check PM2 logs for errors
- Monitor system resources

**Weekly:**
- Review backup logs
- Check disk space
- Update dependencies (test first!)

**Monthly:**
- Security updates (`sudo apt update && sudo apt upgrade`)
- SSL certificate renewal check
- Review access logs for suspicious activity

### Getting Help

- Check application logs: `pm2 logs mcmanager`
- Check Nginx logs: `sudo tail -f /var/log/nginx/mcmanager_error.log`
- Check system logs: `sudo journalctl -u nginx -f`

---

## Example Production Setup

Complete example for Ubuntu 22.04:

```bash
# 1. Initial setup
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs openjdk-17-jre-headless nginx git
sudo npm install -g pm2

# 2. Create user and deploy
sudo adduser --system --group mcmanager
cd /opt
sudo git clone <your-repo> minecraft-server-manager
sudo chown -R mcmanager:mcmanager minecraft-server-manager
cd minecraft-server-manager
npm install --production

# 3. Configure
cp .env.example .env
nano .env  # Edit settings

# 4. Start with PM2
pm2 start server/index.js --name mcmanager
pm2 save
pm2 startup systemd

# 5. Setup Nginx
sudo nano /etc/nginx/sites-available/mcmanager  # Paste config
sudo ln -s /etc/nginx/sites-available/mcmanager /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 6. Get SSL
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com

# 7. Configure firewall
sudo ufw allow 22,80,443,25565:25600/tcp
sudo ufw enable

# 8. Setup backups
crontab -e  # Add backup jobs

# Done! Visit https://yourdomain.com
```

---

**Last Updated:** November 2025
**Version:** 3.11.0
