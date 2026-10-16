<div align="center">

# 🚀 PRODUCTION DEPLOYMENT & OPERATIONS GUIDE
### Enterprise Deployment Strategies for Ira Music & Atlantis Bot

</div>

---

## 📋 Prerequisites & Sizing

| Component | Minimum Spec (Dev / Small) | Recommended Spec (Production 1K+ Guilds) |
|---|---|---|
| **CPU** | 1 vCPU (2.0 GHz+) | 4+ vCPUs (High single-thread performance) |
| **RAM** | 1 GB RAM | 4 GB - 8 GB RAM |
| **Disk** | 10 GB SSD | 30 GB NVMe SSD |
| **Node.js** | v18.16.0 LTS | v20.x or v22.x LTS |
| **MongoDB** | MongoDB 6.0+ (Local / Docker) | MongoDB Atlas (M10+ Replica Set) |
| **Lavalink** | 1x Lavalink v4 Node | 2+ Lavalink v4 Nodes in Different Regions |

---

## 🐳 Option 1: Docker Compose (Fastest & Recommended)

The project includes a ready-to-run multi-container `docker-compose.yml` orchestrating the Discord Bot, Lavalink v4, and MongoDB.

### 1. Clone & Prepare Environment
```bash
git clone https://github.com/oyy-gus/ira-music.git
cd bot
cp .env.example .env
nano .env # Add your DISCORD_TOKEN, OWNER_ID, etc.
```

### 2. Launch Complete Stack
```bash
docker-compose up -d --build
```

### 3. Verify Containers
```bash
docker-compose ps
docker-compose logs -f bot
```

---

## 💻 Option 2: Linux VPS / Bare Metal Deployment (PM2)

For maximum audio throughput and minimal network latency, running natively via PM2 is optimal.

### 1. Install Node.js LTS & Essential System Packages
```bash
# Ubuntu / Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential git fontconfig

# Install Emoji & System Fonts (Prevents broken emoji characters on Canvas cards)
sudo apt-get install -y fonts-noto-color-emoji fonts-dejavu-core
sudo fc-cache -f -v
```

### 2. Install PM2 Globally
```bash
sudo npm install -g pm2
```

### 3. Clone Repository & Install Dependencies
```bash
git clone https://github.com/oyy-gus/ira-music.git /opt/ira-music
cd /opt/ira-music
npm install --omit=dev
```

### 4. Configure Environment
```bash
cp .env.example .env
nano .env
```

### 5. Start with PM2
```bash
# Single Process Deployment
pm2 start src/index.js --name "ira-music" --time --max-memory-restart 1G

# OR Multi-Process Sharded Deployment (For >2,500 Guilds)
pm2 start src/sharder.js --name "ira-sharded" --time --max-memory-restart 2G

# Save PM2 process list to restore on server reboots
pm2 save
pm2 startup
```

---

## 🔊 Lavalink v4 Setup

The bot connects to Lavalink v4 servers. If hosting your own Lavalink node:

1. **Install Java 17 or Java 21**:
   ```bash
   sudo apt-get install -y openjdk-17-jre-headless
   ```
2. **Download Lavalink.jar & Plugins**:
   Place `Lavalink.jar` and `application.yml` inside the `lavalink/` directory.
3. **Run Lavalink**:
   ```bash
   cd lavalink
   java -jar Lavalink.jar
   ```

Sample `application.yml` snippet:
```yaml
server:
  port: 2333
  address: 0.0.0.0
lavalink:
  plugins:
    - dependency: "com.github.topi314.lavasrc:lavasrc-plugin:4.2.0"
      repository: "https://maven.lavalink.dev/releases"
    - dependency: "dev.lavalink.youtube:youtube-plugin:1.5.2"
      repository: "https://maven.lavalink.dev/releases"
  server:
    password: "youshallnotpass"
    playerUpdateInterval: 5
    bufferDurationMs: 400
```

---

## 🔒 Nginx Reverse Proxy with SSL (For Web Dashboard)

To serve the Web Dashboard (`/members`, `/servers`) securely with HTTPS:

```nginx
server {
    server_name bot.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable SSL via Certbot:
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d bot.yourdomain.com
```

---

## 📈 Monitoring & Health Checks

The embedded Express web server exposes standardized health endpoints for monitoring systems (Uptime Kuma, Prometheus, Datadog):

- **`GET http://localhost:3000/health`**
  ```json
  { "status": "ok", "uptime": 86400, "timestamp": "2026-10-16T17:00:00Z" }
  ```
- **`GET http://localhost:3000/ready`**
  ```json
  { "status": "ready", "discord": "READY", "database": "CONNECTED", "lavalinkNodes": 3 }
  ```
- **`GET http://localhost:3000/metrics`**
  Returns Prometheus gauge and counter metrics for real-time alerting.

---

## 🔄 Zero-Downtime Update Procedure

To update the bot without disrupting active listening sessions:

```bash
cd /opt/ira-music
git pull origin master
npm install --omit=dev
npm test -- --forceExit

# Reload process gracefully with PM2
pm2 reload ira-music
```
*Note: Due to the built-in SessionPersistence and RecoveryManager, voice connections and queues automatically restore within seconds upon process restart.*
