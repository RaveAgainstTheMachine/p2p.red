# 🚀 P2P File Share - Perfect AI Agent Prompt

## 📋 **PROJECT BRIEF**

You are tasked with implementing a **privacy-first P2P file sharing service** using **WebRTC DataChannels** and **PeerJS**. This approach enables true browser-to-browser file transfers without server relays.

## 🎯 **PRIMARY OBJECTIVE**

Build a **working P2P file sharing system** with:
- **True WebRTC P2P** (no server relays, direct browser-to-browser)
- **End-to-end encryption** (files encrypted before transfer)
- **Beautiful glassmorphism UI** with theme switching
- **Production-ready implementation** (no experimental code)

## 📚 **REQUIRED READING**

Before writing ANY code, read the current documentation in `/PROJECT_DOCUMENTATION/` in this order:

1. **WEBRTC_ARCHITECTURE_GUIDE.md** - Study the P2P WebRTC solution
2. **UI_THEME_DOCUMENTATION.md** - UI design specifications
3. **UI_IMPLEMENTATION_GUIDE.md** - UI implementation guide

## 🏗️ **TECHNOLOGY STACK (NON-NEGOTIABLE)**

### **Frontend Client**
- **Framework**: React + TypeScript
- **P2P Transport**: WebRTC DataChannels via PeerJS
- **Signaling**: Self-hosted PeerJS server (VPS)
- **Encryption**: Browser-native AES-GCM
- **UI**: Glassmorphism design with 11 themes
- **Icons**: Lucide React

### **Deployment**
- **Hosting**: OVH VPS + Docker + Nginx
- **Signaling**: Self-hosted PeerJS server
- **TURN**: Self-hosted TURN servers (coturn) for NAT traversal

### **Architecture Pattern**
```
Browser A (WebRTC) ←── Direct P2P Connection ──→ Browser B (WebRTC)
        ↓                                           ↓
    Signaling Server (coordination ONLY, no file data)
```

## 🚨 **CRITICAL WARNINGS**

### **WHAT NOT TO DO**
- ❌ **NEVER use server relays** for file data
- ❌ **NEVER use WebTransport** (browser support insufficient)
- ❌ **NEVER claim 100% P2P success** (NAT limitations exist)
- ❌ **NEVER store files** on any server
- ❌ **NEVER skip encryption** (privacy is non-negotiable)

### **WHAT YOU MUST DO**
- ✅ **ALWAYS test WebRTC connectivity** before implementing features
- ✅ **ALWAYS implement end-to-end encryption**
- ✅ **ALWAYS verify true P2P transfer** (no server relay)
- ✅ **ALWAYS test NAT traversal scenarios**
- ✅ **ALWAYS preserve the glassmorphism UI design**

## 🔧 **IMPLEMENTATION PHASES**

### **Phase 1: WebRTC Foundation (Week 1)**
- Set up React + TypeScript project
- Install and configure PeerJS
- Test basic WebRTC P2P connection
- Implement simple text message transfer
- Verify no server data relay

### **Phase 2: File Transfer (Week 2)**
- Implement file encryption/decryption
- Add chunked file transfer via DataChannels
- Add progress tracking
- Test with various file sizes
- Verify end-to-end encryption

### **Phase 3: UI Integration (Week 3)**
- Implement glassmorphism design
- Add drag-drop file upload
- Create share link generation
- Add connection status indicators
- Implement all 11 theme options

### **Phase 4: Production Polish (Week 4)**
- Add error handling and fallbacks
- Optimize for mobile devices
- Add accessibility features
- Performance testing and optimization
- Deploy to VPS (Docker + Nginx)

## ✅ **SUCCESS CRITERIA**

### **Technical Success**
- [ ] WebRTC P2P connection established between browsers
- [ ] Files transferred directly browser-to-browser
- [ ] End-to-end encryption implemented and verified
- [ ] No file data passes through any server
- [ ] Works in Chrome, Firefox, Safari, Edge

### **User Experience Success**
- [ ] Beautiful glassmorphism UI implemented
- [ ] All 11 theme options working
- [ ] Drag-drop file upload functional
- [ ] Share link generation and sharing
- [ ] Mobile responsive design

### **P2P Success Metrics**
- [ ] 70-80% connection success rate (STUN only)
- [ ] Direct transfer speeds achieved
- [ ] No server bandwidth consumption
- [ ] True peer-to-peer architecture verified

## 🎯 **VERIFICATION CHECKLIST**

### **Before Claiming "P2P Works"**
- [ ] Test with Wireshark/tcpdump to verify no server relay
- [ ] Test on different networks (home, office, mobile)
- [ ] Test with various file sizes and types
- [ ] Test encryption/decryption roundtrip
- [ ] Test browser compatibility matrix

### **Before Claiming "Production Ready"**
- [ ] Error handling for connection failures
- [ ] Fallback options for NAT traversal issues
- [ ] Performance optimization for large files
- [ ] Security audit of encryption implementation
- [ ] Accessibility compliance (WCAG 2.1 AA)

## 🌐 **BROWSER SUPPORT REALITY**

### **Fully Supported**
- ✅ Chrome (all versions)
- ✅ Firefox (all versions)
- ✅ Safari (all versions)
- ✅ Edge (all versions)
- ✅ Mobile Chrome/Safari/Firefox

### **Connection Success Rates**
- **STUN only**: 70-80% (free, works for most home networks)
- **STUN + TURN**: 95%+ ($5/month optional, works through corporate NATs)
- **Corporate networks**: Variable (may require TURN configuration)

## 🚀 **DEPLOYMENT STRATEGY**

- **Hosting**: OVH VPS with Docker + Nginx reverse proxy
- **Signaling**: Self-hosted PeerJS container
- **STUN**: Public STUN servers (e.g., Google/Mozilla) or self-hosted
- **TURN**: Self-hosted coturn (two VPS instances for redundancy)

## 💰 **COST BREAKDOWN (REFERENCE)**

- OVH VPS (web + signaling): $5–15/month
- TURN VPS (x2): $5–15/month each
- Domain + SSL: $10–15/year (SSL free via Let's Encrypt)

## 🎨 **UI REQUIREMENTS**

### **Glassmorphism Design**
- **Background**: Animated gradient with glass effects
- **Cards**: Backdrop blur, transparency, borders
- **Typography**: Clean, modern, readable
- **Animations**: Smooth 60fps transitions
- **Themes**: 11 color variations (Ocean, Sunset, Forest, etc.)

### **Core Components**
- **Drop Zone**: Drag-drop file upload area
- **Share Link**: Generated URL with encryption key
- **Progress Bar**: Real-time transfer progress
- **Connection Status**: WebRTC connection indicators
- **Theme Switcher**: Toggle between 11 themes

## 🔒 **SECURITY REQUIREMENTS**

### **Encryption Implementation**
- **Algorithm**: AES-GCM 256-bit
- **Key Generation**: Browser native crypto API
- **Key Distribution**: Include in share link (base64 encoded)
- **IV**: Random 12-byte IV per file
- **Integrity**: GCM authentication tag

### **Privacy Guarantees**
- **Zero server data**: Files never touch servers
- **Ephemeral**: No persistent storage of transfers
- **No logging**: No file metadata logged
- **Direct P2P**: Browser-to-browser only

## 📱 **MOBILE OPTIMIZATION**

### **Responsive Design**
- **Mobile-first**: Design for phones first
- **Touch gestures**: Drag-drop with touch support
- **Viewport**: Proper meta tags and scaling
- **Performance**: Optimize for mobile processors
- **Battery**: Efficient WebRTC usage

### **Mobile Considerations**
- **Camera access**: Not required (file sharing only)
- **Storage**: Respect mobile storage limits
- **Network**: Handle mobile network interruptions
- **Orientation**: Support portrait/landscape

## 🎯 **FINAL WORD**

This is a **WebRTC P2P file sharing service**, not a cloud storage solution. The goal is direct browser-to-browser transfers with maximum privacy and minimal infrastructure.

**Success means**: Users can share files directly without any server handling the file data, with a beautiful UI that just works.

---

**Remember**: WebRTC DataChannels are the ONLY way to achieve true P2P in browsers today. Everything else is either a server relay or doesn't work reliably.
