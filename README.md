# 🚀 P2P File Share

A privacy-first, browser-to-browser file sharing service using WebRTC DataChannels. True peer-to-peer transfers with short, shareable links. Deployed on OVH VPS with full infrastructure control.

**Current Status:** Single VPS deployment (testing phase). Designed for thousands of concurrent users with multi-VPS scaling path.

## ✨ **Features**

- 🔒 **End-to-end encrypted** - Files encrypted in your browser before transfer
- 🌐 **True P2P** - Direct browser-to-browser transfers, no server relay
- 🔗 **Short links** - 16-character shareable links (e.g., `p2p.red#aB3xK9mP12345678`)
- 💾 **Streaming to disk** - Files written directly to disk via File System Access API (no RAM limits)
- 🎨 **Beautiful UI** - Glassmorphism design with 11 themes
- 📱 **Mobile friendly** - Works on all modern browsers and devices
- 🖥️ **Self-hosted** - Complete control over infrastructure
- ⚡ **High performance** - Redis caching, PostgreSQL persistence, sub-10ms metadata retrieval

## 🛠️ **Technology Stack**

- **Frontend**: React + TypeScript + Vite
- **P2P Transport**: WebRTC DataChannels via PeerJS
- **Encryption**: Browser-native AES-GCM
- **Metadata Storage**: PostgreSQL + Redis caching
- **Short Links**: Node.js/Express API with Base62 encoding
- **Deployment**: OVH VPS + Docker + Nginx
- **Signaling**: Self-hosted PeerJS server
- **NAT Traversal**: coturn TURN server
- **SSL**: Let's Encrypt certificates

## 🚀 **Quick Start**

### For Users

1. Open [p2p.red](https://p2p.red)
2. Drag and drop a file to share
3. Copy the short share link (e.g., `https://p2p.red#aB3xK9mP12345678`)
4. Send the link to anyone
5. They open the link and choose save location
6. File transfers directly from your browser to theirs (P2P)

**Note:** Both sender and receiver must keep their browsers open during transfer.

### For Developers (Local)

```bash
# Clone and install
git clone https://github.com/yourusername/p2p-file-share
cd p2p-file-share
pnpm install

# Start dev services (metadata API + Redis + Postgres + PeerJS)
docker compose -f docker-compose.e2e.yml up -d --build

# Run Vite on 127.0.0.1:3000
npm run dev -- --host 127.0.0.1 --port 3000
```

Local env defaults live in `.env.local` (expected for dev):

```bash
VITE_API_URL=http://127.0.0.1:3001
VITE_PEERJS_HOST=127.0.0.1
VITE_PEERJS_PORT=3000
VITE_PEERJS_SECURE=false
```

### Automation

- Scripts and usage: [`automation/README.md`](automation/README.md)
- Make targets:
  - `make deploy-all`
  - `make deploy-and-test`
  - `./automation/deploy-zero-downtime.sh` (blue/green)
  - `make public-sync PUBLIC_REPO=/path/to/public-repo`
- Public repo dry run:
  - `PUBLIC_SYNC_DRY_RUN=1 make public-sync PUBLIC_REPO=/path/to/public-repo`

## 🌐 **Environments**

| Environment | URL                        | Purpose            | Cost        |
|-------------|----------------------------|--------------------|-------------|
| Development | 127.0.0.1:3000             | Local development  | Free        |
| Production  | [p2p.red](https://p2p.red) | Live service       | $5-15/month |

## 📊 **Browser Support**

| Browser | Support | Notes                      |
|---------|---------|----------------------------|
| Chrome  | ✅ Full | All versions               |
| Firefox | ✅ Full | All versions               |
| Safari  | ✅ Full | All versions               |
| Edge    | ✅ Full | All versions               |
| Mobile  | ✅ Full | iOS Safari, Android Chrome |

## 🔐 **Privacy & Security**

- **Zero-knowledge**: Files never touch our servers
- **End-to-end encryption**: AES-GCM 256-bit
- **Ephemeral**: No data stored after transfer
- **Open source**: Code available for audit
- **Self-hosted**: Complete control over data

## 📈 **Connection Success**

- **STUN only**: 70-80% success rate (free)
- **STUN + TURN**: 95%+ success rate (self-hosted)
- **Most home networks**: Work perfectly
- **Corporate networks**: TURN server helps

## 🏗️ **Architecture**

### Current (Single VPS)
```
Sender Browser                               Receiver Browser
      |                                             |
      | 1. Create short link                        |
      |-------------------------------------------> |
      |    POST /api/metadata                       |
      |    (peerId, fileName, fileSize)             |
      |                                             |
      | 2. Share link: p2p.red#aB3xK9mP12345678     |
      |-------------------------------------------> |
      |                                             |
      |                                             | 3. Retrieve metadata
      |                                             |-------------------->
      |                                             | GET /api/metadata/:key
      |                                             |
      | 4. Direct P2P WebRTC Connection (file data) |
      |<------------------------------------------->|
      |        (No server relay - true P2P)         |
      v                                             v
      
      Metadata API (PostgreSQL + Redis)
           │
           ├─ Short link generation (Base62)
           ├─ Metadata storage (24h expiry)
           └─ Redis caching (<10ms reads)
```

### Production Target (Multi-VPS)
See [ARCHITECTURE.md](PROJECT_DOCUMENTATION/ARCHITECTURE.md) for detailed scaling plan to thousands of concurrent users.

## 📁 **Project Structure**

```
src/
├── components/          # React components
│   ├── DropZone.tsx    # File upload area
│   ├── ShareLink.tsx   # Share link display
│   ├── ProgressBar.tsx # Transfer progress
│   └── ConnectionStatus.tsx # Connection state
├── hooks/              # Custom React hooks
│   ├── useWebRTC.ts    # WebRTC connection logic
│   ├── useEncryption.ts # File encryption/decryption
│   └── useFileTransfer.ts # Streaming file transfer
├── services/           # API clients
│   └── metadataApi.ts  # Short link API client
├── config/             # Environment configuration
│   └── environments.ts # Dev/prod settings
├── utils/              # Utility functions
│   ├── encryption.ts   # Crypto operations
│   ├── streamingZip.ts # Folder compression
│   └── themes.ts       # UI theme definitions
└── styles/             # CSS and themes

metadata-api/           # Short link backend
├── server.js           # Express API server
├── db/
│   └── init.sql        # PostgreSQL schema
├── package.json        # Dependencies
└── Dockerfile          # Container image
```

## 🚀 **Deployment**

### VPS Setup

```bash
# Connect to VPS
ssh ubuntu@p2p.red

# Install Docker and dependencies
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d p2p.red -d www.p2p.red

# Open firewall ports
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 3478/udp    # TURN server
sudo ufw enable
```

### Application Deployment

```bash
# Deploy metadata API stack (PostgreSQL + Redis + API)
./deploy-metadata-api.sh

# Deploy frontend and main services
./deploy.sh

# Zero-downtime blue/green deploy
./automation/deploy-zero-downtime.sh
```

### Full Stack Deployment

```bash
# 1. Deploy metadata services
docker compose -f docker-compose.metadata.yml up -d

# 2. Initialize database
docker exec -i p2p-postgres psql -U p2p_api_user -d p2p_metadata < metadata-api/db/init.sql

# 3. Build and deploy frontend
npm run build
./deploy.sh
```

### Manual Deployment

```bash
# Build application
npm run build

# Copy to VPS
scp -r dist/ ubuntu@p2p.red:/opt/p2p-file-share/

# Restart services
ssh ubuntu@p2p.red "cd /opt/p2p-file-share && sudo docker compose restart"
```

## 📊 **Monitoring & Logging**

### Application Monitoring
```bash
# View all logs
docker compose logs -f
docker compose -f docker-compose.metadata.yml logs -f

# Check service status
docker compose ps
docker compose -f docker-compose.metadata.yml ps

# Test metadata API
curl http://localhost:3001/health

# System monitoring
htop
df -h
```

### Metadata API Monitoring
```bash
# Check API health
curl http://localhost:3001/health | jq

# View statistics
curl http://localhost:3001/api/stats | jq

# Database queries
docker exec -it p2p-postgres psql -U p2p_api_user -d p2p_metadata

# Redis cache stats
docker exec -it p2p-redis redis-cli INFO stats
```

### Log Management
- **Docker logs**: Container stdout/stderr
- **Nginx logs**: Web server access/error logs
- **TURN logs**: Connection and relay logs
- **Application logs**: WebRTC connection events
- **Metadata API logs**: Short link creation/retrieval
- **PostgreSQL logs**: Database queries and errors
- **Redis logs**: Cache operations

## 💰 **Cost Management**

### Current Costs (Single VPS)
- **OVH VPS**: $15/month (2 vCPU, 4GB RAM)
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)
- **Total**: ~$200/year

### Production Costs (Multi-VPS for 3K+ users)
- **Load Balancer**: $5-10/month
- **Web VPS x3**: $30-45/month
- **Database VPS**: $20-30/month
- **TURN VPS**: $10-20/month
- **Monitoring VPS**: $10-15/month
- **Total**: $75-120/month (~$900-1,440/year)

See [ARCHITECTURE.md](PROJECT_DOCUMENTATION/ARCHITECTURE.md) for detailed scaling costs.

### Benefits
- **Full control**: Complete server administration
- **Cost effective**: Single server vs cloud services
- **Performance**: Dedicated resources
- **Privacy**: No third-party data sharing

## 🔧 **Configuration Files**

- `docker-compose.yml` - Main services (frontend, PeerJS, TURN)
- `docker-compose.metadata.yml` - Metadata stack (PostgreSQL, Redis, API)
- `Dockerfile` - Application container
- `nginx.conf` - Reverse proxy configuration
- `turnserver.conf` - TURN server settings
- `metadata-api/.env` - API configuration
- `deploy-metadata-api.sh` - Metadata stack deployment
- `deploy.sh` - Frontend deployment script

## 🤝 **Contributing**

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 **License**

MIT License - see [LICENSE](LICENSE) file for details.

## 🔗 **Related Projects**

- [PeerJS](https://peerjs.com/) - WebRTC abstraction library
- [WebRTC](https://webrtc.org/) - Real-time communication in browsers
- [coturn](https://github.com/coturn/coturn) - TURN server implementation
- [OVH VPS](https://www.ovhcloud.com/en/vps/) - Virtual private servers
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Browser cryptography

---

**Made with ❤️ for privacy-conscious file sharing | Self-hosted on OVH VPS**
