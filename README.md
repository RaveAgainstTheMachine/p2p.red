# 🚀 p2p.red

**Privacy-First, Infrastructure-Independent File Sharing.**  
*Engineered by Steven Frost*

---

[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](LICENSE)
[![Status: Production](https://img.shields.io/badge/Status-Production-green.svg)]()
[![Security: E2EE](https://img.shields.io/badge/Security-E2EE%20(AES--GCM)-orange.svg)]()

**p2p.red** is a high-performance, browser-to-browser file sharing platform. It ensures absolute privacy by leveraging WebRTC DataChannels and client-side AES-GCM encryption—your data never touches a server in an unencrypted state.

## 🏛️ Architecture

p2p.red functions as a zero-trust orchestrator:
- **Direct P2P**: Files stream directly disk-to-disk between browsers.
- **E2EE**: Encryption happens locally before transit.
- **Modular Infra**: Deploy only what you need. Supports optional analytics (Plausible) and secret management (OpenBao).

## ✨ Key Features

- 🔒 **Zero-Trust E2EE**: AES-GCM encryption via Web Crypto API.
- ⚡ **Streaming Architecture**: No server-side storage or RAM bottlenecks.
- 🛡️ **Anubis PoW**: Hardened endpoints with cryptographic challenges.
- 🎨 **Adaptive UI**: Premium glassmorphism with multiple themes.

## 🚀 Self-Hosting

p2p.red is designed for rapid deployment via Docker.

```bash
# 1. Clone
git clone https://github.com/RaveAgainstTheMachine/p2p.red.git
cd p2p.red

# 2. Setup
# Interactive script for domain binding and secret generation
chmod +x setup.sh
./setup.sh

# 3. Launch
docker compose --profile core up -d
```

### Optional Components
The `setup.sh` script allows you to toggle:
- **Analytics**: Self-hosted Plausible instance.
- **Secrets**: OpenBao (Vault) for admin authentication.

## 📄 License

Licensed under the **Business Source License 1.1**. See [LICENSE](LICENSE) for details.

---

**Made with ❤️ for the Privacy-Conscious World.**  
[p2p.red](https://p2p.red)
