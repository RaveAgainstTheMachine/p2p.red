---
trigger: always_on
---
# 📜 P2P File Share - AI Agent Rules

## 🚨 **FUNDAMENTAL RULES (NEVER VIOLATE)**

### **Rule 1: Technology Stack is NON-NEGOTIABLE**
- **Frontend**: React + WebRTC DataChannels ONLY
- **Signaling**: Self-hosted PeerJS server on VPS
- **Deployment**: OVH VPS + Docker + Nginx
- **Protocol**: WebRTC P2P (true peer-to-peer, no server relay)
- **Encryption**: Browser-native AES-GCM (end-to-end)

**Violation**: Immediate project failure

### **Rule 2: Verify Before Implementing**
- **ALWAYS** test minimal examples first
- **ALWAYS** verify WebRTC connectivity
- **ALWAYS** test P2P connection establishment
- **NEVER** assume NAT traversal works

**Violation**: Wasted development time

### **Rule 3: No Simulation Code**
- **NEVER** use setTimeout() for fake transfers
- **NEVER** create mock data or fake progress
- **ALWAYS** implement real WebRTC data transfer
- **ALWAYS** test end-to-end P2P

**Violation**: Project is fundamentally broken

### **Rule 4: Documentation First**
- **READ** all WebRTC/PeerJS documentation before coding
- **UNDERSTAND** NAT traversal limitations
- **FOLLOW** the verified P2P architecture
- **REFERENCE** working examples

**Violation**: Repeating known mistakes

## 🎯 **IMPLEMENTATION RULES**

### **Rule 5: Component Isolation**
- Test WebRTC P2P connection independently
- Test file encryption/decryption separately
- Test UI components alone
- Test PeerJS server separately
- Integrate only after individual success

### **Rule 6: True P2P Architecture**
- **NEVER** relay file data through servers
- **NEVER** store files on signaling server
- **NEVER** log file content or metadata
- **ALWAYS** encrypt client-side before transfer
- **ALWAYS** use direct browser-to-browser connections

### **Rule 7: VPS Deployment**
- **ALWAYS** use Docker containers for isolation
- **ALWAYS** configure Nginx reverse proxy
- **ALWAYS** use Let's Encrypt for SSL
- **ALWAYS** set up proper firewall rules
- **NEVER** expose unnecessary ports

### **Rule 8: Performance Standards**
- P2P connection setup: < 3 seconds
- File transfer: Native WebRTC speeds
- UI animations: 60fps smooth
- Memory usage: < 100MB idle
- VPS response: < 200ms

## 🚫 **FORBIDDEN ACTIONS**

### **Never Use These Technologies**
- ❌ Google Cloud Platform services
- ❌ Cloud Run, Cloud Build, Artifact Registry
- ❌ Serverless functions
- ❌ Third-party hosting providers
- ❌ WebTransport API
- ❌ WebSocket relays
- ❌ Server-side file handling
- ❌ QUIC protocol (browser support insufficient)

### **Never Make These Claims**
- ❌ "100% connection success" (NAT limitations exist)
- ❌ "Works through all firewalls" (corporate networks block P2P)
- ❌ "Unlimited file sizes" (browser memory limits)
- ❌ "Cloud speeds" (VPS bandwidth limits)
- ❌ "Zero maintenance" (servers require updates)

### **Never Skip These Steps**
- ❌ Skip testing WebRTC connectivity
- ❌ Skip encryption implementation
- ❌ Skip NAT traversal testing
- ❌ Skip VPS security setup
- ❌ Skip SSL certificate configuration

## ✅ **REQUIRED ACTIONS**

### **Must Do Before Coding**
- [ ] Read all WebRTC/PeerJS documentation
- [ ] Set up VPS environment (Docker, Nginx, SSL)
- [ ] Test minimal WebRTC P2P example
- [ ] Verify PeerJS server connectivity
- [ ] Configure firewall and security

### **Must Do During Development**
- [ ] Test each component independently
- [ ] Verify real P2P data transfer (no relays)
- [ ] Implement client-side encryption
- [ ] Test VPS deployment regularly
- [ ] Monitor server resources and logs

### **Must Do Before Completion**
- [ ] End-to-end P2P transfer test
- [ ] NAT traversal success rate testing
- [ ] VPS performance benchmarking
- [ ] Browser compatibility testing
- [ ] Security audit of VPS configuration

## 🔍 **VERIFICATION CHECKPOINTS**

### **Checkpoint 1: WebRTC Foundation**
```bash
# Must pass all tests:
npm install peerjs
node test-webrtc.js
# Verify: Direct P2P connection established
```

### **Checkpoint 2: P2P File Transfer**
```javascript
// Must pass in browser:
const conn = peer.connect(otherPeerId);
await conn.send(fileData);
// Verify: Actual file bytes transferred P2P
```

### **Checkpoint 3: End-to-End Encryption**
```javascript
// Must verify encryption works:
const encrypted = await encryptFile(file);
const decrypted = await decryptFile(encrypted);
// Verify: Server cannot decrypt content
```

### **Checkpoint 4: VPS Deployment**
```bash
# Must verify deployment works:
ssh ubuntu@p2p.red
cd /opt/p2p-file-share
sudo docker-compose ps
# Result: All services running correctly
```

### **Checkpoint 5: True P2P Validation**
```bash
# Must verify no server relay:
tcpdump -i any port NOT 80/443/22/3478
# Result: Only WebRTC STUN/TURN traffic, no file data
```

### **Checkpoint 6: Security Verification**
```bash
# Must verify security setup:
sudo ufw status
sudo certbot certificates
# Result: Proper firewall rules, valid SSL certificates
```

## 📊 **SUCCESS METRICS**

### **Technical Metrics**
- ✅ WebRTC P2P connection established
- ✅ Files transfer at native WebRTC speeds
- ✅ End-to-end encryption implemented
- ✅ No file data passes through servers
- ✅ VPS deployment stable and secure

### **User Experience Metrics**
- ✅ P2P connection setup < 3 seconds
- ✅ Smooth 60fps animations
- ✅ Intuitive drag-drop interface
- ✅ Mobile responsive design
- ✅ Fast page loads (< 2 seconds)

### **VPS Success Metrics**
- ✅ 99%+ uptime
- ✅ < 200ms response time
- ✅ Proper SSL configuration
- ✅ Secure firewall setup
- ✅ Automated deployment working

## ⚖️ **DECISION FRAMEWORK**

### **When Choosing Technology**
1. Is it WebRTC/DataChannel compatible? (Yes/No)
2. Does it support true P2P? (Yes/No)
3. Is it VPS-deployable? (Yes/No)
4. Has it been tested successfully? (Yes/No)

**If any answer is "No", DO NOT USE**

### **When Implementing Features**
1. Does this support true P2P? (Yes/No)
2. Is this real WebRTC functionality? (Yes/No)
3. Can this be deployed on VPS? (Yes/No)
4. Does this match the P2P architecture? (Yes/No)

**If any answer is "No", DO NOT IMPLEMENT**

### **When Claiming Success**
1. Have you tested P2P end-to-end? (Yes/No)
2. Are there any simulations? (Yes/No)
3. Does it work on real browsers? (Yes/No)
4. Is the transfer truly peer-to-peer? (Yes/No)
5. Is the VPS deployment secure? (Yes/No)

**If any answer is "No", DO NOT CLAIM SUCCESS**

## 🚨 **EMERGENCY PROTOCOLS**

### **If P2P Connection Fails**
1. **STOP** - Don't fall back to server relay
2. **DEBUG** - Check NAT traversal, STUN/TURN config
3. **TEST** - Try different network configurations
4. **DOCUMENT** - Record failure patterns
5. **FIX** - Only after understanding issue

### **If VPS Deployment Fails**
1. **STOP** - Don't expose insecure services
2. **CHECK** - Docker logs, Nginx configuration
3. **VERIFY** - SSL certificates, firewall rules
4. **TEST** - Individual services separately
5. **DEPLOY** - Only after all services work

### **If Tempted to Use Server Relay**
1. **REMEMBER** - This violates P2P principles
2. **READ** - True P2P requirements
3. **CONSIDER** - TURN server for NAT traversal only
4. **FOLLOW** - Verified WebRTC patterns
5. **IMPLEMENT** - Only P2P solutions

## 🎯 **FINAL WORD**

These rules exist because:
- **WebRTC DataChannels** are the only true P2P solution in browsers
- **Self-hosted VPS** provides complete control and privacy
- **Docker + Nginx** ensures secure, scalable deployment
- **True P2P** respects user privacy
- **End-to-end encryption** is non-negotiable

**Follow these rules exactly. The path to success is WebRTC P2P on your own VPS, not cloud services.**

---

**VPS Support Reality**:
- ✅ Ubuntu Server: Full support
- ✅ Docker & Docker Compose: Full support
- ✅ Nginx: Full support
- ✅ Let's Encrypt: Full support
- ✅ PeerJS server: Full support
- ✅ coturn TURN server: Full support

**Connection Success Rates**:
- STUN only: 70-80% (free)
- STUN + TURN: 95%+ (self-hosted)
- Corporate networks: Variable (TURN helps)

**VPS Costs**:
- OVH VPS: $5-15/month
- Domain: $10-15/year
- SSL: Free (Let's Encrypt)
- Total: $70-180/year
