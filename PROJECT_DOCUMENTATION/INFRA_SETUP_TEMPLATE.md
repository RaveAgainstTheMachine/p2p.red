# Infrastructure Setup Intake (Fill In)

Use this template to provide the details needed to set up dev/prod signaling, TURN, monitoring, and dashboards.

## 1) Access Details
- Primary contact name: Steven Frost
- Timezone: Americas/Toronto
- Preferred maintenance window: 1am - 3am

## 2) Servers (SSH)
Fill in the details per host. Add extra notes as needed (custom SSH port, internal IP, etc.).

### PROD-SIGNAL-WEB (Production signaling + web)
- Hostname/FQDN: p2pred01
- Provider: OVH
- Region: Beauharnois, QC
- Public IP: 149.56.131.26
- SSH Port: 22
- SSH User: root
- OS Version: Debian 12
- Disk Size: 100GB
- RAM: 12GB
- Notes: currently developing on this server, will move dev to local dev vm.

### TURN-1 (Primary TURN)
- Hostname/FQDN: turn1p2pred / turn1.p2p.red
- Provider: InterServer
- Region: New Jersey
- Public IP: 163.245.208.229
- SSH Port: 22
- SSH User: root
- OS Version: Debian 12
- Disk Size: 160GB
- RAM: 12GB
- Notes: primary TURN

### TURN-2 (Secondary TURN)
- Hostname/FQDN: turn2p2pred / turn2.p2p.red
- Provider: InterServer
- Region: New Jersey
- Public IP: 163.245.208.141
- SSH Port: 22
- SSH User: root
- OS Version: Debian 12
- Disk Size: 160GB
- RAM: 12GB
- Notes: secondary TURN

### DEV (Local dev VM)
- Hostname/FQDN: ubuntu2404dev
- Provider: HomeLab Proxmox VE
- Region: Repentigny, QC
- Public IP: 184.145.229.164 (dynamic)
- SSH Port: 22
- SSH User: frosty or root
- OS Version: Ubuntu 24.04
- Disk Size: 160GB
- RAM: 12GB
- Notes: lan ip 10.10.10.77

## 3) SSH Keys (add our public key, this key is from the ubuntu user on the dev vm)
Paste the public key you want added to each host:

```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIHLsqEbUZSn5Q/jUARiiwWE92eNc0aJEmC63He9wAnYp p2p-deploy
```

Where should this key be added (roles):
- [x] PROD-SIGNAL
- [x] TURN-1
- [x] TURN-2
- [ ] DEV

## 4) Domains / Subdomains (you will set DNS)
Fill in desired hostnames:

- Production web + signaling: 
  - web: p2p.red
  - signal: signal.p2p.red
- TURN:
  - turn1: turn1.p2p.red
  - turn2: turn2.p2p.red
- Dev:
  - dev web: dev.p2p.red
  - dev signaling: dev-signal.p2p.red
  - dev TURN (optional): dev-turn.p2p.red

## 5) TLS / Certificates
- Preferred email for Let’s Encrypt: admin@p2p.red
- Where should certs live (Nginx reverse proxy)?
  - [x] PROD-SIGNAL
  - [x] TURN-1
  - [x] TURN-2
  - [X] DEV (using existing nginxpm reverse proxy,No need for certs)

## 6) Networking / Firewall (Must check and configure firewall on each host)
- UFW enabled? (Y/N) Y
- Open ports allowed: 
  - Web/Signal: 80, 443
  - TURN: 3478 (UDP/TCP), 5349 (TLS), + relay range:
  - SSH: 22 (or custom)
- Preferred TURN relay port range (e.g. 49152-65535):

## 7) Monitoring & Dashboards
Choose which you want:
- [X] Portainer CE (container management)
- [ ] Dockge (compose management)
- [X] Uptime Kuma (uptime)
- [X] Grafana + Prometheus + Loki (metrics/logs)
- [X] Netdata (host health)
- [ ] Other: 

## 8) Single Pane of Glass (One Portal)
We can expose a single admin domain (e.g. `ops.p2p.red`) and route to dashboards.

- Admin domain: ops.p2p.red
- Auth method (Basic Auth / SSO / VPN-only): Basic Auth + VPN-only (wireguard preferred. Cloudflare tunnel an option. must be set up)
- Allowed IPs (optional): 184.145.229.164 (dev vm, frosty-cachyos), 

## 9) Environment & Runtime (Must check and configure on each host)
- Node version:
- Docker + Docker Compose installed? (Y/N)
- OS version (Ubuntu, etc):

## 10) Notes / Constraints
- Any provider restrictions or compliance constraints? InterServer's connection is 10Gb/s per VPS but it's shared.
- Backup requirements? Rotating backups daily. Keep our data for 7 days. No client data.
- Preferred log retention? 7 days.

---

When you complete this, I’ll draft:
- docker-compose stacks (PeerJS, coturn, monitoring)
- Nginx reverse proxies + TLS
- Firewall rules
- Operational runbook + upgrade steps
