# 🚀 p2p.red

**Privacy-First, Infrastructure-Independent File Sharing.**  
*Engineered by Steven Frost*

---

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)
[![Status: Production](https://img.shields.io/badge/Status-Production-green.svg)]()
[![Security: E2EE](https://img.shields.io/badge/Security-E2EE%20(AES--GCM)-orange.svg)]()
[![Stack: WebRTC](https://img.shields.io/badge/Stack-WebRTC%20%7C%20Node.js%20%7C%20Envoy-lightgrey.svg)]()

**p2p.red** is a high-performance, browser-to-browser file sharing platform designed for absolute privacy. By leveraging WebRTC DataChannels and client-side AES-GCM encryption, it ensures that your data never touches a server in an unencrypted state.

## 🏛️ Architecture

Unlike traditional sharing services, **p2p.red** functions as a zero-trust orchestrator:

```text
[ Sender ] <--- (E2EE Tunnel) ---> [ Receiver ]
    |                                   |
    +-----> [ Envoy Proxy ] <-----------+
    |           |                       |
    |    [ PeerJS Signaling ]           |
    |    [ Metadata Storage ]           |
```

## ✨ Key Features

- 🔒 **Zero-Trust E2EE**: Files are encrypted with AES-GCM *before* leaving the browser.
- ⚡ **Streaming Architecture**: Direct disk-to-disk streaming via File System Access API. No RAM bottlenecks.
- 🛡️ **Anubis Proof-of-Work**: Hardened metadata endpoints with cryptographic challenges to thwart bot-driven abuse.
- 🔗 **Persistence-Free**: Metadata is transient (24h TTL). File data is never stored on infrastructure.
- 🎨 **Adaptive UI**: High-fidelity glassmorphism interface with 11+ curated themes.
- 📱 **Universal Compatibility**: Seamless P2P orchestration across mobile, desktop, and tablets.

## 🚀 Quick Start (Self-Hosting)

p2p.red is designed for rapid deployment on any Linux environment with Docker.

```bash
# 1. Clone the repository
git clone https://github.com/RaveAgainstTheMachine/p2p.red.git
cd p2p.red

# 2. Run the Interactive Orchestrator
# This will handle domain binding, secret generation, and branding.
./scripts/setup.sh

# 3. Launch the Stack
docker compose up -d
```

For advanced configuration, see the [Self-Hosting Guide](PROJECT_DOCUMENTATION/SELF_HOSTING.md).

## 🔒 Security & Privacy Manifesto

We believe privacy is a right, not a feature.
- **Zero-Storage**: Your files are never uploaded. They flow directly between peers.
- **Open Signaling**: Uses hardened PeerJS + Coturn (TURN/STUN) for reliable fallback without data interception.
- **No Analytics**: We value anonymity. No tracking, no cookies, no fingerprints.

## 📄 License

Licensed under the **Business Source License 1.1**.

- **Licensor**: Steven Frost
- **Change Date**: January 1, 2030
- **Change License**: Apache License, Version 2.0

*For commercial use inquiries, please contact the licensor.*

---

**Made with ❤️ for the Privacy-Conscious World.**  
[p2p.red](https://p2p.red)
