# TURN Server Setup

For WebRTC peer-to-peer transfers, browsers establish direct connections. However, firewalls, symmetric NATs, or restrictive corporate networks can block direct P2P connections. In these scenarios, a TURN (Traversal Using Relays around NAT) server is required to relay the encrypted traffic between peers.

## Option 1: Built-in Coturn Container (Recommended)

The setup script (`setup.sh`) can automatically deploy and configure a `coturn` container alongside your application.

During the interactive installation, select `y` when asked:
`Configure a local coturn TURN Relay server on ports 3478/5349?`

### Ports to Open
If you enable the built-in TURN server, you must open the following ports on your host firewall:
- `3478` (UDP & TCP) - TURN/STUN service
- `5349` (UDP & TCP) - Secure TURN/STUN service (TLS)

### Internal Configuration
The built-in TURN server utilizes a shared authentication secret (`TURN_SECRET`) to dynamically generate short-lived credentials for users. This authentication token is kept secure in `.env` and is never exposed to public users.

---

## Option 2: External TURN Server

If you already have a TURN server configured, you can point your application to it by modifying your environment variables:

1. Open your `.env` configuration file.
2. Define the external TURN server parameters:
   ```env
   VITE_TURN_HOSTS=turn.yourdomain.com
   VITE_TURN_PORT=3478
   VITE_TURN_TLS_PORT=5349
   VITE_TURN_REALM=yourdomain.com
   TURN_SECRET=your-shared-auth-secret
   ```
3. Rebuild and restart the container stack:
   ```bash
   docker compose -f docker-compose.selfhost.yml up -d --build
   ```
