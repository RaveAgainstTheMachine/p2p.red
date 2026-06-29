---
trigger: always_on
---
# 📜 P2P File Share - AI Agent Rules

## 🚨 **FUNDAMENTAL RULES (NEVER VIOLATE)**

### **Rule 1: Technology Stack is NON-NEGOTIABLE**
- **Frontend**: React + WebRTC DataChannels ONLY
- **Signaling**: PeerJS (WebRTC abstraction) or minimal signaling server
- **Deployment**: Static hosting (Vercel/Netlify) + optional TURN server
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
- Test signaling server separately (if self-hosted)
- Integrate only after individual success

### **Rule 6: True P2P Architecture**
- **NEVER** relay file data through servers
- **NEVER** store files on signaling server
- **NEVER** log file content or metadata
- **ALWAYS** encrypt client-side before transfer
- **ALWAYS** use direct browser-to-browser connections

### **Rule 7: UI Preservation**
- **RECREATE** glassmorphism design exactly
- **IMPLEMENT** all 11 theme options
- **MAINTAIN** responsive design
- **PRESERVE** accessibility features

### **Rule 8: Performance Standards**
- P2P connection setup: < 3 seconds
- File transfer: Native WebRTC speeds
- UI animations: 60fps smooth
- Memory usage: < 100MB idle

## 🚫 **FORBIDDEN ACTIONS**

### **Never Use These Technologies**
- ❌ Go backend servers
- ❌ WebTransport API
- ❌ WebSocket relays
- ❌ Server-side file handling
- ❌ Third-party file hosting
- ❌ QUIC protocol (browser support insufficient)

### **Never Make These Claims**
- ❌ "100% connection success" (NAT limitations exist)
- ❌ "Works through all firewalls" (corporate networks block P2P)
- ❌ "Unlimited file sizes" (browser memory limits)
- ❌ "QUIC speeds" (WebRTC uses SCTP, not QUIC)

### **Never Skip These Steps**
- ❌ Skip testing WebRTC connectivity
- ❌ Skip encryption implementation
- ❌ Skip NAT traversal testing
- ❌ Skip fallback planning

## ✅ **REQUIRED ACTIONS**

### **Must Do Before Coding**
- [ ] Read all WebRTC/PeerJS documentation
- [ ] Set up development environment (Node.js + npm)
- [ ] Test minimal WebRTC P2P example
- [ ] Verify PeerJS connectivity

### **Must Do During Development**
- [ ] Test each component independently
- [ ] Verify real P2P data transfer (no relays)
- [ ] Implement client-side encryption
- [ ] Preserve glassmorphism UI design

### **Must Do Before Completion**
- [ ] End-to-end P2P transfer test
- [ ] NAT traversal success rate testing
- [ ] Performance benchmarking
- [ ] Browser compatibility testing

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

### **Checkpoint 4: True P2P Validation**
```bash
# Must verify no server relay:
tcpdump -i any port NOT 80/443
# Result: Only WebRTC STUN/TURN traffic, no file data
```

### **Checkpoint 5: UI Completeness**
```javascript
// Must implement all features:
- Drag-drop file upload
- Share link generation
- P2P connection status
- Progress tracking
- 11 theme options
- Responsive design
```

## 📊 **SUCCESS METRICS**

### **Technical Metrics**
- ✅ WebRTC P2P connection established
- ✅ Files transfer at native WebRTC speeds
- ✅ End-to-end encryption implemented
- ✅ No file data passes through servers
- ✅ UI matches glassmorphism design

### **User Experience Metrics**
- ✅ P2P connection setup < 3 seconds
- ✅ Smooth 60fps animations
- ✅ Intuitive drag-drop interface
- ✅ All 11 themes working
- ✅ Mobile responsive design

### **P2P Success Metrics**
- ✅ 70-80% connection success rate (STUN only)
- ✅ 95%+ with TURN server (optional)
- ✅ Direct browser-to-browser transfer
- ✅ No server bandwidth costs

## ⚖️ **DECISION FRAMEWORK**

### **When Choosing Technology**
1. Is it WebRTC/DataChannel compatible? (Yes/No)
2. Does it support true P2P? (Yes/No)
3. Is it browser-native? (Yes/No)
4. Has it been tested successfully? (Yes/No)

**If any answer is "No", DO NOT USE**

### **When Implementing Features**
1. Does this support true P2P? (Yes/No)
2. Is this real WebRTC functionality? (Yes/No)
3. Can this be tested independently? (Yes/No)
4. Does this match the P2P architecture? (Yes/No)

**If any answer is "No", DO NOT IMPLEMENT**

### **When Claiming Success**
1. Have you tested P2P end-to-end? (Yes/No)
2. Are there any simulations? (Yes/No)
3. Does it work on real browsers? (Yes/No)
4. Is the transfer truly peer-to-peer? (Yes/No)

**If any answer is "No", DO NOT CLAIM SUCCESS**

## 🚨 **EMERGENCY PROTOCOLS**

### **If P2P Connection Fails**
1. **STOP** - Don't fall back to server relay
2. **DEBUG** - Check NAT traversal, STUN/TURN config
3. **TEST** - Try different network configurations
4. **DOCUMENT** - Record failure patterns
5. **FIX** - Only after understanding issue

### **If Tempted to Use Server Relay**
1. **REMEMBER** - This violates P2P principles
2. **READ** - True P2P requirements
3. **CONSIDER** - TURN server for NAT traversal only
4. **FOLLOW** - Verified WebRTC patterns
5. **IMPLEMENT** - Only P2P solutions

## 🎯 **FINAL WORD**

These rules exist because:
- **WebRTC DataChannels** are the only true P2P solution in browsers
- **PeerJS** simplifies WebRTC complexity
- **Static deployment** eliminates server maintenance
- **True P2P** respects user privacy
- **End-to-end encryption** is non-negotiable

**Follow these rules exactly. The path to success is WebRTC P2P, not server relays.**

---

**Browser Support Reality**:
- ✅ Chrome: Full WebRTC support
- ✅ Firefox: Full WebRTC support  
- ✅ Safari: Full WebRTC support
- ✅ Edge: Full WebRTC support
- ✅ Mobile browsers: Full WebRTC support

**Connection Success Rates**:
- STUN only: 70-80% (free)
- STUN + TURN: 95%+ ($5/month optional)
- Corporate networks: Variable (may require TURN)
