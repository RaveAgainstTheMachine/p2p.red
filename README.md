# P2P File Share

A privacy-first, browser-to-browser file sharing service using WebRTC DataChannels. Secure peer-to-peer transfers with end-to-end encryption.

## Features

- **End-to-End Encryption** - Files are encrypted in the browser using the Web Crypto API (AES-GCM 256-bit) before transfer.
- **Direct P2P** - Transferred directly between browsers. Uses STUN/TURN for NAT traversal, ensuring data remains browser-to-browser.
- **Short Links** - Temporary metadata storage to broker WebRTC connections using Base62 encoding.
- **Disk Streaming** - Large file support via streaming to disk using the File System Access API.

---

## Quick Start (Self-Hosting)

To host your own private or public instance on a server with Docker:

```bash
git clone https://github.com/RaveAgainstTheMachine/p2p.red.git
cd p2p.red
./setup.sh
```

The script will configure your domain, setup auto-HTTPS via Caddy, generate secure credentials, and boot up your containers.

## Local Development

If you want to run the client application locally for testing or development:

```bash
# Install dependencies
npm install

# Start local development server
npm run dev
```

For advanced settings and details, see [docs/self_hosting.md](docs/self_hosting.md).

---

## License

MIT License.
