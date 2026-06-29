---
trigger: always_on
---

# 📜 <domain> Project Rules

## 🚨 FUNDAMENTAL RULES (NEVER VIOLATE)
### Rule 1: Technology Stack is NON-NEGOTIABLE
- Frontend: React + WebRTC DataChannels ONLY
- Signaling: Self-hosted PeerJS server on VPS
- Deployment: OVH VPS + Docker + Nginx
- Protocol: WebRTC P2P (true peer-to-peer, no server relay)
- Encryption: Browser-native AES-GCM (end-to-end)

Violation: Immediate project failure

### Rule 2: Verify Before Implementing
- ALWAYS test minimal examples first
- ALWAYS verify WebRTC connectivity
- ALWAYS test P2P connection establishment
- NEVER assume NAT traversal works

Violation: Wasted development time

### Rule 3: No Simulation Code
- NEVER use setTimeout() for fake transfers
- NEVER create mock data or fake progress
- ALWAYS implement real WebRTC data transfer
- ALWAYS test end-to-end P2P

Violation: Project is fundamentally broken

### Rule 4: Documentation First
- READ all WebRTC/PeerJS documentation before coding
- UNDERSTAND NAT traversal limitations
- FOLLOW the verified P2P architecture
- REFERENCE working examples

Violation: Repeating known mistakes

## ⚡ EFFICIENCY & EXECUTION (PEAK PERFORMANCE)
- Batch independent tool calls in parallel whenever possible.
- Make multiple edits in one pass when safe (single apply_patch per file, multiple hunks).
- Avoid back-and-forth edits: plan, then execute.
- Prefer targeted, minimal fixes over broad refactors.
- Do not block progress for confirmations unless safety/destructive actions are involved.

## 🎯 IMPLEMENTATION RULES
### Rule 5: Component Isolation
- Test WebRTC P2P connection independently
- Test file encryption/decryption separately
- Test UI components alone
- Test PeerJS server separately
- Integrate only after individual success

### Rule 6: True P2P Architecture
- NEVER relay file data through servers
- NEVER store files on signaling server
- NEVER log file content or metadata
- ALWAYS encrypt client-side before transfer
- ALWAYS use direct browser-to-browser connections

### Rule 7: VPS Deployment
- ALWAYS use Docker containers for isolation
- ALWAYS configure Nginx reverse proxy
- ALWAYS use Let's Encrypt for SSL
- ALWAYS set up proper firewall rules
- NEVER expose unnecessary ports

### Rule 8: Performance Standards
- P2P connection setup: < 3 seconds
- File transfer: Native WebRTC speeds
- UI animations: 60fps smooth
- Memory usage: < 100MB idle
- VPS response: < 200ms

## ✅ REQUIRED ACTIONS (POST-CHANGE WORKFLOW)
- After implementing a change/feature, immediately begin dev testing with full blue/green deploy.
- Cleanup old containers if needed to unblock deploys.
- A change is NOT complete until tested successfully.
- After success: update/create relevant docs, commit, and push to remote.

## 🚫 FORBIDDEN ACTIONS
### Never Use These Technologies
- Google Cloud Platform services
- Cloud Run, Cloud Build, Artifact Registry
- Serverless functions
- Third-party hosting providers
- WebTransport API
- WebSocket relays
- Server-side file handling
- QUIC protocol (browser support insufficient)

### Never Make These Claims
- “100% connection success”
- “Works through all firewalls”
- “Unlimited file sizes”
- “Cloud speeds”
- “Zero maintenance”

### Never Skip These Steps
- Skip testing WebRTC connectivity
- Skip encryption implementation
- Skip NAT traversal testing
- Skip VPS security setup
- Skip SSL certificate configuration

## 🔍 VERIFICATION CHECKPOINTS
### Checkpoint 1: WebRTC Foundation
```bash
npm install peerjs
node test-webrtc.js
```

### Checkpoint 2: P2P File Transfer
```javascript
const conn = peer.connect(otherPeerId);
await conn.send(fileData);
```

### Checkpoint 3: End-to-End Encryption
```javascript
const encrypted = await encryptFile(file);
const decrypted = await decryptFile(encrypted);
```

### Checkpoint 4: VPS Deployment
```bash
ssh <email>
cd /opt/p2p-file-share
sudo docker-compose ps
```

### Checkpoint 5: True P2P Validation
```bash
tcpdump -i any port NOT 80/443/22/3478
```

### Checkpoint 6: Security Verification
```bash
sudo ufw status
sudo certbot certificates
```

## 📊 SUCCESS METRICS
### Technical
- WebRTC P2P connection established
- Files transfer at native WebRTC speeds
- End-to-end encryption implemented
- No file data passes through servers
- VPS deployment stable and secure

### UX
- P2P connection setup < 3 seconds
- Smooth 60fps animations
- Intuitive drag-drop interface
- Mobile responsive design
- Fast page loads (< 2 seconds)

### VPS
- 99%+ uptime
- < 200ms response time
- Proper SSL configuration
- Secure firewall setup
- Automated deployment working
