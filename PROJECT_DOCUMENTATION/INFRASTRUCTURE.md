# Infrastructure Overview (Dev + Prod)

This document describes the current infrastructure layout for p2p.red. It is authoritative for dev/prod separation and reverse proxy ownership.

## Core Principles
- Dev and prod are isolated (no shared Docker networks, volumes, secrets, or proxies).
- Dev reverse proxy is **external Nginx Proxy Manager (NginxPM)** on the LAN.
- Prod reverse proxy is **Nginx on the OVH VPS**.
- WebRTC file data is always browser-to-browser (no server relay).

## Environments

### Dev (LAN + external NginxPM)
- Dev VM runs app services only.
- Reverse proxy is **external NginxPM** (same LAN, different container). Do not modify prod nginx for dev.
- NginxPM forwards dev domains to these dev VM ports:
  - Dev Web (Vite): `5173`
  - Dev PeerJS: `5174`
  - Dev TURN (optional): `5175`

**Dev domain routing (NginxPM):**
- dev web domain -> `http://10.10.10.77:5173`
- dev signal domain -> `http://10.10.10.77:5174`
- dev TURN domain (optional) -> `http://10.10.10.77:5175`

**NginxPM proxy host settings (dev):**
- `dev.p2p.red`
  - Forward: `http://10.10.10.77:5173`
  - Access list: `bao.p2p.red`
  - Websockets: enabled
  - Block common exploits: enabled
  - Cache assets: disabled
  - SSL: Force SSL on, HTTP/2 on, HSTS off, HSTS subdomains off
  - Certificate: `dev.p2p.red`
  - Advanced config:
```nginx
location /api/ {
    proxy_pass http://10.10.10.77:3001/api/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

location /share/ {
    rewrite ^/share/(.*)$ /api/metadata/$1?html=true break;
    proxy_pass http://10.10.10.77:3001;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# CSP override (dev only) - use if NPM injects `default-src 'none'`
add_header Content-Security-Policy "default-src 'self'; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' https://plausible.p2p.red; style-src 'self' 'unsafe-inline'; connect-src 'self' https://dev.p2p.red wss://dev.p2p.red https://plausible.p2p.red;" always;
```
- `dev-signal.p2p.red`
  - Forward: `http://10.10.10.77:5174`
  - Access list: `LAN ONLY`
  - Websockets: enabled
  - Block common exploits: enabled
  - Cache assets: disabled
  - SSL: Force SSL on, HTTP/2 on, HSTS off, HSTS subdomains off
  - Certificate: `dev-signal.p2p.red`
- `dev-turn.p2p.red`
  - Forward: `http://10.10.10.77:5175`
  - Access list: `LAN ONLY`
  - Websockets: enabled
  - Block common exploits: enabled
  - Cache assets: disabled
  - SSL: Force SSL on, HTTP/2 on, HSTS off, HSTS subdomains off
  - Certificate: `dev-turn.p2p.red`

### Prod (OVH VPS)
- Nginx handles `p2p.red` and `www.p2p.red` on the VPS.
- Containers run on the VPS: web, PeerJS, metadata API, Redis, Postgres.
- TLS via Let's Encrypt on the VPS.

## Hosts and IPs

- **OpenBao + Bastion**
  - Hostname: `bao.p2p.red`
  - Provider/Region: OVH, Beauharnois, QC
  - Public IP: `149.56.131.26`
  - WG IP: `10.88.0.1`
  - OS: Debian 12
  - Notes: WG hub + SSH bastion

- **Prod Web + Signal**
  - Hostname: `p2pred01`
  - Provider/Region: OVH, Beauharnois, QC
  - Public IP: `149.56.131.26`
  - WG IP: `10.88.0.10`
  - OS: Debian 12
  - Notes: Nginx, web, PeerJS, metadata

- **TURN-1**
  - Hostname: `turn1.p2p.red`
  - Provider/Region: InterServer, New Jersey
  - Public IP: `163.245.208.229`
  - WG IP: `10.88.0.11`
  - OS: Debian 12
  - Notes: Primary TURN

- **TURN-2**
  - Hostname: `turn2.p2p.red`
  - Provider/Region: InterServer, New Jersey
  - Public IP: `163.245.208.141`
  - WG IP: `10.88.0.12`
  - OS: Debian 12
  - Notes: Secondary TURN

- **Dev VM**
  - Hostname: `ubuntu2404dev`
  - Provider/Region: HomeLab Proxmox VE, Repentigny, QC
  - Public IP: `184.145.229.164` (dynamic)
  - WG IP: `10.88.0.13`
  - OS: Ubuntu 24.04
  - Notes: LAN `10.10.10.77`

## Secrets and OpenBao
- Secrets are stored in OpenBao and delivered via OpenBao Agent.
- The agent container runs as `uid=100`, `gid=1000`.
- Host paths must be readable/writable by `100:1000` to avoid `permission denied` when reading `role_id`.

**OpenBao endpoint:** `https://bao.p2p.red:8200`

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
- Web: `443` (Nginx)
- PeerJS: `443` (Nginx -> 9000)
- Metadata API: `443` (Nginx -> 3001)
- Postgres: `5432` (internal)
- Redis: `6379` (internal)
- TURN: `3478/udp` (TURN hosts)

## Domains

**Production**
- Web: `p2p.red`, `www.p2p.red`
- Signal: `signal.p2p.red`
- TURN: `turn1.p2p.red`, `turn2.p2p.red`
- OpenBao: `bao.p2p.red`
- Analytics: `plausible.p2p.red`

**Development**
- Web: `dev.p2p.red`
- Signal: `dev-signal.p2p.red`
- TURN (optional): `dev-turn.p2p.red`
- SSH: `dev-ssh.p2p.red`

## WireGuard + SSH Bastion

WireGuard hub: `bao.p2p.red` (WG `10.88.0.1`), all SSH access goes through the bastion.

**SSH users + keys (dev VM):**
- Bastion (`bao`): `debian@10.88.0.1` using `/home/frosty/.ssh/p2p_dev_key`
- Prod (`prod`): `ubuntu@10.88.0.10` using `/home/frosty/.ssh/p2p_deploy`
- TURN (`turn1/turn2`): `p2padmin@10.88.0.11/10.88.0.12` via bastion using `/home/frosty/.ssh/p2p_dev_key` (sudo enabled)

**ProxyJump example (prod via bastion):**
```
ssh -i /home/frosty/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" \
  ubuntu@10.88.0.10
```

| Host   | WG IP      | SSH Access |
|--------|------------|------------|
| cachyos| 10.88.0.2   | WG client |
| bao    | 10.88.0.1   | direct WG |
| prod   | 10.88.0.10  | ProxyJump via bao |
| turn1  | 10.88.0.11  | ProxyJump via bao |
| turn2  | 10.88.0.12  | ProxyJump via bao |
| dev    | 10.88.0.13  | ProxyJump via bao (LAN 10.10.10.0/24 allowed) |

WG healthcheck on bao:
- timer: `wg-healthcheck.timer`
- script: `/usr/local/sbin/wg-healthcheck.sh`

## Separation Rules (Do Not Violate)
- Never point dev domains at prod.
- Never reuse prod secrets in dev.
- Never edit prod nginx config to fix dev issues.
- Always validate NginxPM routing for dev.
