# 🚀 P2P File Share (<domain>)

A privacy-first, browser-to-browser file sharing service using WebRTC DataChannels. Peer-to-peer transfers with end-to-end encryption.

This public repository is published for transparency, auditability, and open-source verification.

## ✨ Features

- 🔒 **End-to-End Encryption** - Files are encrypted in the browser using the Web Crypto API (AES-GCM 256-bit) before transfer.
- 🌐 **Direct P2P** - Transferred directly between browsers. Uses STUN/TURN (via PeerJS) for NAT traversal, ensuring data remains browser-to-browser.
- 🔗 **Short Links** - Temporary metadata storage to broker WebRTC connections using Base62 encoding.
- 💾 **Disk Streaming** - Large file support via streaming to disk using the File System Access API.

## 🛠️ Technology Stack

- **Frontend**: React + TypeScript + Vite
- **P2P Transport**: WebRTC DataChannels (via PeerJS)
- **Encryption**: AES-GCM (Browser-native Web Crypto API)
- **Signaling**: WebRTC connection broking (metadata exchange only)

## 🚀 Quick Start (Local Development)

To run the client application locally for testing or development:

```bash
# Clone the repository
git clone https://github.com/RaveAgainstTheMachine/<domain>.git
cd <domain>

# Install dependencies
pnpm install

# Start local development server
pnpm run dev
```

For full environment simulation (including local metadata database and signaling containers):
```bash
docker compose -f docker-compose.e2e.yml up -d --build
```

## 🔐 Security & Auditability

This project is built from the ground up to ensure user privacy:
- **No File Storage on Servers**: File payloads never touch our servers. All transfers occur directly from sender to receiver.
- **Short-lived Metadata**: Link metadata is cached temporarily only to facilitate connection brokers, and automatically expires.
- **Zero Tracker Scripts**: No third-party analytics or tracker libraries are present in the frontend.

## 📄 License

MIT License.
