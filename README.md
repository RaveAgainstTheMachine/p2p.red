# 🚀 P2P File Share

A privacy-first, browser-to-browser file sharing service using WebRTC DataChannels. Deployed on OVH VPS with full infrastructure control.

## ✨ **Features**

- 🔒 **End-to-end encrypted** - Files encrypted in your browser before transfer
- 🌐 **True P2P** - Direct browser-to-browser transfers, no server relay
- 🎨 **Beautiful UI** - Glassmorphism design with 11 themes
- 📱 **Mobile friendly** - Works on all modern browsers and devices
- 🖥️ **Self-hosted** - Complete control over infrastructure
- 🚀 **Production ready** - Proper monitoring, logging, and security

## 🛠️ **Technology Stack**

- **Frontend**: React + TypeScript + Vite
- **P2P Transport**: WebRTC DataChannels via PeerJS
- **Encryption**: Browser-native AES-GCM
- **Deployment**: OVH VPS + Docker + Nginx
- **Signaling**: Self-hosted PeerJS server
- **NAT Traversal**: coturn TURN server
- **SSL**: Let's Encrypt certificates

## 🚀 **Quick Start**

### For Users

1. Open [p2p.red](https://p2p.red)
2. Drag and drop a file to share
3. Copy the generated share link
4. Send the link to anyone
5. They open the link to download directly from your browser

### For Developers

```bash
# Clone and install
git clone https://github.com/yourusername/p2p-file-share
cd p2p-file-share
npm install

# Run development server
npm run dev

# Deploy to VPS
./deploy.sh
```

## 🌐 **Environments**

| Environment | URL | Purpose | Cost |
|-------------|-----|---------|------|
| Development | localhost:5173 | Local development | Free |
| Production | [p2p.red](https://p2p.red) | Live service | $5-15/month |

## 📊 **Browser Support**

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | All versions |
| Firefox | ✅ Full | All versions |
| Safari | ✅ Full | All versions |
| Edge | ✅ Full | All versions |
| Mobile | ✅ Full | iOS Safari, Android Chrome |

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

```
Browser A ←── Direct WebRTC P2P Connection ──→ Browser B
     ↓                                           ↓
Signaling Server (coordination only, no file data)
     ↓
OVH VPS (p2p.red) - Docker + Nginx + PeerJS + TURN
```

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
│   └── useFileTransfer.ts # Enhanced file transfer
├── config/             # Environment configuration
│   └── environments.ts # Dev/prod settings
├── utils/              # Utility functions
│   ├── encryption.ts   # Crypto operations
│   └── themes.ts       # UI theme definitions
└── styles/             # CSS and themes
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
# Make deploy script executable
chmod +x deploy.sh

# Deploy to VPS
./deploy.sh
```

### Manual Deployment

```bash
# Build application
npm run build

# Copy to VPS
scp -r dist/ ubuntu@p2p.red:/opt/p2p-file-share/

# Restart services
ssh ubuntu@p2p.red "cd /opt/p2p-file-share && sudo docker-compose restart"
```

## 📊 **Monitoring & Logging**

### Application Monitoring
```bash
# View logs
ssh ubuntu@p2p.red "sudo docker-compose logs -f"

# Check service status
ssh ubuntu@p2p.red "sudo docker-compose ps"

# System monitoring
ssh ubuntu@p2p.red "htop"
ssh ubuntu@p2p.red "df -h"
```

### Log Management
- **Docker logs**: Container stdout/stderr
- **Nginx logs**: Web server access/error logs
- **TURN logs**: Connection and relay logs
- **Application logs**: WebRTC connection events

## 💰 **Cost Management**

### VPS Costs
- **OVH VPS**: $5-15/month (depending on specs)
- **Domain**: $10-15/year
- **SSL**: Free (Let's Encrypt)
- **Total**: $70-180/year

### Benefits
- **Full control**: Complete server administration
- **Cost effective**: Single server vs cloud services
- **Performance**: Dedicated resources
- **Privacy**: No third-party data sharing

## 🔧 **Configuration Files**

- `docker-compose.yml` - Multi-service orchestration
- `Dockerfile` - Application container
- `nginx.conf` - Reverse proxy configuration
- `turnserver.conf` - TURN server settings
- `deploy.sh` - Automated deployment script

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
