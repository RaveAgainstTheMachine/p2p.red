# p2p.red - Project Overview

## Project Stats

**Lines of Code:**
- Total: 4,419 lines (TypeScript/JavaScript)
- CSS: 106 lines
- Files: 26 TypeScript/React files

**Project Structure:**
- Components: 14 files
- Hooks: 3 files
- Services: 1 file
- Pages: 2 files
- Backend: Node.js/Express API

## Technology Stack

### Frontend
- **Framework:** React 18 with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **P2P:** PeerJS (WebRTC wrapper)
- **QR Codes:** qrcode.react
- **ZIP:** client-zip (streaming compression)

### Backend
- **Runtime:** Node.js 18
- **Framework:** Express
- **Database:** PostgreSQL
- **Cache:** Redis
- **Security:** bcrypt (PIN hashing)
- **CORS:** cors middleware

### Infrastructure
- **Web Server:** Nginx (reverse proxy)
- **Containerization:** Docker + Docker Compose
- **Signaling:** PeerJS Server (self-hosted)
- **TURN Server:** coturn (NAT traversal)
- **SSL:** Let's Encrypt
- **Hosting:** OVH VPS

### Development
- **Language:** TypeScript
- **Package Manager:** npm
- **Version Control:** Git
- **Linting:** ESLint + TypeScript compiler

## Core Capabilities

### File Transfer
- True peer-to-peer transfer (WebRTC DataChannels)
- No server relay (files never touch servers)
- Streaming ZIP compression (default for all files)
- Single files, multiple files, and folders supported
- Toggle to disable ZIP compression
- Real-time transfer progress
- Resume capability for interrupted transfers

### Security & Privacy
- End-to-end encryption (browser-native AES-GCM)
- Optional 4-digit PIN protection
- Rate limiting (5 PIN attempts per 15 minutes)
- No user tracking or analytics
- No cookies (localStorage only for consent)
- No IP logging
- No file content logging
- GDPR/PIPEDA/Law 25 compliant

### Sharing Options
- Short link generation (24-hour expiry)
- QR code generation
- Email sharing (pre-filled template)
- Social sharing (Facebook, Twitter, WhatsApp, Telegram, Discord)
- Native mobile share (AirDrop, Nearby Share)
- Copy to clipboard

### User Experience
- Drag-and-drop file selection
- File type warnings (executables, scripts)
- Connection status indicators
- Transfer progress visualization
- Mobile-optimized UI (44px touch targets)
- Responsive design
- Trust badges (E2E Encrypted, No Server Storage, No Relay)
- Cookie consent banner

### Monitoring
- Service status widget
- Uptime display
- Privacy-preserving (no user metrics)

## Architecture

### Data Flow
1. **Sender:** Selects files → Creates metadata → Gets short link
2. **Metadata API:** Stores peer ID, filename, size (24h expiry)
3. **Receiver:** Opens link → Fetches metadata → Connects to sender
4. **P2P Transfer:** Direct browser-to-browser via WebRTC
5. **Cleanup:** Metadata auto-deleted after 24 hours

### Privacy Design
- Files transfer directly between browsers
- Servers only store: peer IDs, filenames, file sizes, timestamps
- No file content ever reaches servers
- No user accounts or personal data
- Encryption keys generated client-side
- All metadata expires in 24 hours

## Modules & Dependencies

### Frontend Dependencies
```
react, react-dom
peerjs
client-zip
qrcode.react
lucide-react
tailwindcss
vite
typescript
```

### Backend Dependencies
```
express
pg (PostgreSQL client)
redis
bcrypt
cors
dotenv
```

### Infrastructure
```
nginx:alpine
postgres:15-alpine
redis:alpine
node:18-alpine
```

## Current Limitations

- Both users must be online simultaneously
- Links expire after 24 hours
- Corporate firewalls may block P2P connections
- Browser memory limits file sizes (typically 2-4GB)
- TURN server required for some NAT configurations

## Future Improvements

### Short-term (1-3 months)
- Magic byte validation for file type verification
- Enhanced file security warnings
- Patreon/Ko-fi integration
- "Support Us" page
- Improved mobile UX refinements

### Medium-term (3-6 months)
- User accounts (privacy-preserving)
- Premium tier (larger files, longer expiry)
- YARA rules for malware pattern detection
- Contextual advertising (EthicalAds)
- API access for developers
- Transfer history (sender only)

### Long-term (6-12 months)
- Team/Business plans
- Custom domains for teams
- White-label option
- Batch transfers
- Email notifications
- Custom PIN lengths
- Multi-language support
- ClamAV.js integration (optional malware scanning)

### Infrastructure
- Automated backups
- Load balancing for high traffic
- CDN integration
- Multiple TURN servers (geographic distribution)
- Monitoring and alerting system

## Monetization

NONE OF YOUR FUCKING BUSINESS

## Performance Metrics

- P2P connection setup: < 3 seconds
- File transfer speed: Limited by network bandwidth (not protocol)
  - LAN: 100-900 Mbps (hardware dependent)
  - WAN: 80-90% of slowest connection (e.g., 400 Mbps on 500 Mbps link)
  - No artificial rate limiting
  - WebRTC has no inherent speed cap
- UI animations: 60fps target
- Page load: < 2 seconds
- Memory usage: < 100MB idle
- VPS response time: < 200ms

## Compliance & Standards

- GDPR (EU) compliant
- PIPEDA (Canada) compliant
- Law 25 (Quebec) compliant
- W3C WebRTC standards
- WCAG 2.1 accessibility guidelines (in progress)
- No tracking or analytics
- Transparent privacy policy

## Repository Structure

```
/opt/p2p-file-share/
├── src/                    # Frontend source
│   ├── components/         # React components (14 files)
│   ├── hooks/             # Custom hooks (3 files)
│   ├── services/          # API clients (1 file)
│   ├── pages/             # Page components (2 files)
│   ├── utils/             # Utilities
│   ├── App.tsx            # Main app component
│   └── index.css          # Tailwind styles
├── metadata-api/          # Backend API
│   └── server.js          # Express server
├── nginx/                 # Web server config
├── docker-compose.yml       # Service orchestration
├── Dockerfile               # Container definitions
└── PROJECT_DOCUMENTATION/   # Documentation
    ├── MALWARE_SCANNING_PLAN.md
    ├── PRODUCTION_ZERO_DOWNTIME_PLAN.md
    ├── ARCHITECTURE.md
    └── PROJECT_OVERVIEW.md
```

## Key Design Decisions

1. **True P2P:** Files never touch servers (privacy-first)
2. **Self-hosted:** Complete control over infrastructure
3. **No tracking:** Zero analytics or user monitoring
4. **Streaming ZIP:** Memory-efficient compression
5. **WebRTC:** Industry-standard P2P protocol
6. **Docker:** Reproducible deployments
7. **TypeScript:** Type safety and better DX
8. **Tailwind:** Rapid UI development

## Success Metrics

- Uptime: 99%+ target
- Transfer success rate: 95%+ (with TURN)
- User satisfaction: Privacy-focused design
- Zero data breaches (no data to breach)
- Zero privacy complaints
- Community trust and word-of-mouth growth

---

**Built with privacy, security, and user trust as core principles.**
