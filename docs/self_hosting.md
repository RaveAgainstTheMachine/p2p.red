# Self-Hosting Guide

This guide walks you through deploying your own instance of P2P File Share.

## Requirements

- A Linux server (VPS) with a public IP address.
- A domain name (e.g., `share.example.com`) pointed to your server's IP address.
- Docker and Docker Compose installed.
- Open ports `80` (HTTP), `443` (HTTPS), and optionally `3478` / `5349` (UDP/TCP) if running a TURN server.

---

The easiest way to get started is by cloning the repository and running the interactive setup script. This script checks your dependencies, prompts you for configuration settings, generates secure random keys, and builds/starts your containers.

```bash
git clone https://github.com/RaveAgainstTheMachine/p2p.red.git
cd p2p.red
./setup.sh
```

Follow the prompts on screen:
1. Enter your domain name.
2. Enter your custom site branding name.
3. Enter your email address (used for registering SSL/TLS certificates).
4. Choose whether to enable optional features (Anubis Bot Protection, Plausible Analytics, or Coturn TURN server).

---

## Manual Deployment

If you prefer to configure the deployment yourself:

### 1. Configure the Environment
Copy the example environment file:
```bash
cp config/site.env.example .env
```
Open `.env` and fill in:
- `SITE_DOMAIN`: Your public domain (e.g. `share.example.com`)
- `SITE_NAME`: The name of your service
- `ADMIN_EMAIL`: Your email address
- Generate secure random secrets (e.g., using `openssl rand -hex 32`) for `ADMIN_JWT_SECRET`, `TURN_SECRET`, and `POSTGRES_PASSWORD`.

> **Note:** The `ADMIN_COOKIE_DOMAIN` controls the scope of the admin session cookie. It defaults to `SITE_DOMAIN`, which is correct for most standard deployments. If you're hosting on a specific subdomain and want the cookie scoped differently, you can set it manually.

### 2. Configure Caddy (Reverse Proxy)
Copy the Caddyfile template:
```bash
cp Caddyfile.template Caddyfile
```
Open `Caddyfile` and ensure the routing mappings point correctly to the backend API (`metadata-api:3001`), signaling server (`peerjs-server:9000`), and client application (`app:3000`).

### 3. Deploy the Stack
Start the core services using Docker Compose:
```bash
docker compose -f docker-compose.selfhost.yml up -d --build
```
This builds and starts the core stack. Caddy will automatically provision Let's Encrypt certificates for the configured domain.

---

## Customizing Branding & Logo

You can customize the appearance of the web page:
- **Site Name**: Change `SITE_NAME` in `.env` and rebuild.
- **Logo & Favicon**: Replace `public/logo.svg` and `public/favicon.svg` with your own SVG designs before building.
- **Color Theme**: Adjust CSS color variables inside `src/styles/` to change the look and feel.

---

## Privacy & Telemetry

By default, the p2p.red codebase includes a telemetry service designed to help diagnose connection failures and understand basic platform usage (browser type, OS, connection type). 

**For self-hosters, telemetry is DISABLED by default.**

If you wish to enable telemetry collection to your own metadata API for debugging purposes, you can set `VITE_TELEMETRY_ENABLED=true` in your `.env` file before building the application.

When enabled, telemetry events are sent to your `metadata-api` and retained for the duration specified by `TELEMETRY_RETENTION_DAYS` (default 7 days). No personal information, IP addresses, or file contents are ever collected.
