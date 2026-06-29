# Infrastructure Overview (Dev + Prod)

This document describes the current infrastructure layout for <domain>. It is authoritative for dev/prod separation and reverse proxy ownership.

## Core Principles
- Dev and prod are isolated (no shared Docker networks, volumes, secrets, or proxies).
- Dev reverse proxy is **external Nginx Proxy Manager (NginxPM)** on the LAN.
- Prod reverse proxy is **Envoy on the OVH VPS**.
- WebRTC file data is always browser-to-browser (no server relay).

## Environments

### Dev (LAN + external NginxPM)
- Dev VM runs app services only.
- Reverse proxy is **external NginxPM** (same LAN, different container). Do not modify prod Envoy for dev.
- Local deploy scripts may start Envoy with `envoy.dev.yaml` (HTTP-only) for container health checks; NginxPM still owns dev domains.
- NginxPM forwards dev domains to these dev VM ports:
  - Dev Web (Vite): `5173`
  - Dev PeerJS: `5174`
  - Dev TURN (optional): `5175`

**Dev domain routing (NginxPM):**
- dev web domain -> `http://<ip>:5173`
- dev signal domain -> `http://<ip>:5174`
- dev TURN domain (optional) -> `http://<ip>:5175`

**NginxPM proxy host settings (dev):**
- `<dev-domain>`
  - Forward: `http://<ip>:5173`
  - Access list: `<bao-domain>`
  - Websockets: enabled
  - Block common exploits: enabled
  - Cache assets: disabled
  - SSL: Force SSL on, HTTP/2 on, HSTS off, HSTS subdomains off
  - Certificate: `<dev-domain>`
  - Advanced config:
```nginx
location /api/ {
    proxy_pass http://<ip>:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /share/ {
    rewrite ^/share/(.*)$ /api/metadata/$1?html=true break;
    proxy_pass http://<ip>:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# CSP override (dev only) - use if NPM injects `default-src 'none'`
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://plausible.<domain>; style-src 'self' 'unsafe-inline'; connect-src 'self' https://<dev-domain> wss://<dev-domain> https://plausible.<domain>;" always;
```
- `<dev-signal-domain>`
  - Forward: `http://<ip>:5174`
  - Access list: `LAN ONLY`
  - Websockets: enabled
  - Block common exploits: enabled
  - Cache assets: disabled
  - SSL: Force SSL on, HTTP/2 on, HSTS off, HSTS subdomains off
  - Certificate: `<dev-signal-domain>`
- `<dev-turn-domain>`
  - Forward: `http://<ip>:5175`
  - Access list: `LAN ONLY`
  - Websockets: enabled
  - Block common exploits: enabled
  - Cache assets: disabled
  - SSL: Force SSL on, HTTP/2 on, HSTS off, HSTS subdomains off
  - Certificate: `<dev-turn-domain>`

### Prod (OVH VPS)
- Envoy handles `<domain>` and `www.<domain>` on the VPS.
- Containers run on the VPS: web, PeerJS, metadata API, Redis, Postgres.
- TLS via Let's Encrypt on the VPS.

## Hosts and IPs

- **OpenBao + Bastion**
  - Hostname: `<bao-domain>`
  - Provider/Region: OVH, Beauharnois, QC
  - Public IP: `<ip>`
  - WG IP: `<ip>`
  - OS: Debian 12
  - Notes: WG hub + SSH bastion

- **Prod Web + Signal**
  - Hostname: `p2pred01`
  - Provider/Region: OVH, Beauharnois, QC
  - Public IP: `<ip>`
  - WG IP: `<ip>`
  - OS: Debian 12
  - Notes: Envoy, web, PeerJS, metadata

- **TURN-1**
  - Hostname: `<turn1-domain>`
  - Provider/Region: InterServer, New Jersey
  - Public IP: `<ip>`
  - WG IP: `<ip>`
  - OS: Debian 12
  - Notes: Primary TURN

- **TURN-2**
  - Hostname: `<turn2-domain>`
  - Provider/Region: InterServer, New Jersey
  - Public IP: `<ip>`
  - WG IP: `<ip>`
  - OS: Debian 12
  - Notes: Secondary TURN

- **Dev VM**
  - Hostname: `ubuntu2404dev`
  - Provider/Region: HomeLab Proxmox VE, Repentigny, QC
  - Public IP: `<ip>` (dynamic)
  - WG IP: `<ip>`
  - OS: Ubuntu 24.04
  - Notes: LAN `<ip>`

## Secrets and OpenBao
- Secrets are stored in OpenBao and delivered via OpenBao Agent.
- The agent container runs as `uid=100`, `gid=1000`.
- Host paths must be readable/writable by `100:1000` to avoid `permission denied` when reading `role_id`.

**OpenBao endpoint:** `https://<bao-domain>:8200`

**Required permissions on service hosts:**
```
sudo chown -R 100:1000 /var/lib/openbao-agent
sudo chmod 750 /var/lib/openbao-agent
sudo chmod 640 /var/lib/openbao-agent/agent.hcl /var/lib/openbao-agent/metadata.env.tpl \
  /var/lib/openbao-agent/role_id /var/lib/openbao-agent/secret_id

sudo chown 100:1000 /run/secrets
sudo chmod 770 /run/secrets
```

**Systemd unit must run as:**
```
--user 100:1000
```

## Service Ports (Dev VM)
- Web (dev): `5173`
- PeerJS (dev): `5174`
- TURN (dev optional): `5175`
- Metadata API (dev local): `3001`
- Postgres (dev local): `5432`
- Redis (dev local): `6379`

**PVE firewall (dev VM) - open from LAN:**
- `5173/tcp` (dev web)
- `5174/tcp` (dev PeerJS)
- `5175/tcp` (dev TURN optional)
- `3001/tcp` (metadata API for NginxPM)

## Service Ports (Prod VPS)
- Web: `443` (Envoy)
- PeerJS: `443` (Envoy -> 9000)
- Metadata API: `443` (Envoy -> 3001)
- Postgres: `5432` (internal)
- Redis: `6379` (internal)
- TURN: `3478/udp` (TURN hosts)

## Domains

**Production**
- Web: `<domain>`, `www.<domain>`
- Signal: `<signal-domain>`
- TURN: `<turn1-domain>`, `<turn2-domain>`
- OpenBao: `<bao-domain>`
- Analytics: `plausible.<domain>`

**Development**
- Web: `<dev-domain>`
- Signal: `<dev-signal-domain>`
- TURN (optional): `<dev-turn-domain>`
- SSH: `dev-ssh.<domain>`

## WireGuard + SSH Bastion

WireGuard hub: `<bao-domain>` (WG `<ip>`), all SSH access goes through the bastion.

**SSH users + keys (dev VM):**
- Bastion (`bao`): `debian@<ip>` using `/home/frosty/.ssh/p2p_dev_key`
- Prod (`prod`): `ubuntu@<ip>` using `/home/frosty/.ssh/p2p_deploy`
- TURN (`turn1/turn2`): `p2padmin@<ip>/<ip>` via bastion using `/home/frosty/.ssh/p2p_dev_key` (sudo enabled)

**ProxyJump example (prod via bastion):**
```
ssh -i /home/frosty/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@<ip>" \
  ubuntu@<ip>
```

| Host   | WG IP      | SSH Access |
|--------|------------|------------|
| cachyos| <ip>   | WG client |
| bao    | <ip>   | direct WG |
| prod   | <ip>  | ProxyJump via bao |
| turn1  | <ip>  | ProxyJump via bao |
| turn2  | <ip>  | ProxyJump via bao |
| dev    | <ip>  | ProxyJump via bao (LAN <ip>/24 allowed) |

WG healthcheck on bao:
- timer: `wg-healthcheck.timer`
- script: `/usr/local/sbin/wg-healthcheck.sh`

## Separation Rules (Do Not Violate)
- Never point dev domains at prod.
- Never reuse prod secrets in dev.
- Never edit prod Envoy config to fix dev issues.
- Always validate NginxPM routing for dev.
