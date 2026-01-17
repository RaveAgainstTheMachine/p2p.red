# Infrastructure Setup Intake (Fill In)

Use this template to provide the details needed to set up dev/prod signaling, TURN, monitoring, and dashboards.

## 1) Access Details
- Primary contact name: <fill>
- Timezone: <fill>
- Preferred maintenance window: <fill>

## 2) Servers (SSH)
Fill in the details per host. Add extra notes as needed (custom SSH port, internal IP, etc.).

### PROD-SIGNAL-WEB (Production signaling + web)
- Hostname/FQDN: <fill>
- Provider: <fill>
- Region: <fill>
- Public IP: <fill>
- SSH Port: <fill>
- SSH User: <fill>
- OS Version: <fill>
- Disk Size: <fill>
- RAM: <fill>
- Notes: <fill>

### TURN-1 (Primary TURN)
- Hostname/FQDN: turn1p2pred / turn1.p2p.red
- Provider: <fill>
- Region: <fill>
- Public IP: 163.245.208.229
- SSH Port: 22
- SSH User: root
- OS Version: Debian GNU/Linux 12 (bookworm)
- Disk Size: 156G
- RAM: 8GB
- Notes: SSH key already added; TURN realm/secret = new

### TURN-2 (Secondary TURN)
- Hostname/FQDN: turn2p2pred / turn2.p2p.red
- Provider: <fill>
- Region: <fill>
- Public IP: 163.245.208.141
- SSH Port: 22
- SSH User: root
- OS Version: Debian GNU/Linux 12 (bookworm)
- Disk Size: 156G
- RAM: 8GB
- Notes: SSH key already added; TURN realm/secret = new

### DEV (Local dev VM)
- Hostname/FQDN: <fill>
- Provider: <fill>
- Region: <fill>
- Public IP: <fill>
- SSH Port: <fill>
- SSH User: <fill>
- OS Version: <fill>
- Disk Size: <fill>
- RAM: <fill>
- Notes: <fill>

## 3) SSH Keys (add our public key, this key is from the ubuntu user on the dev vm)
Paste the public key you want added to each host:

```
<paste public key>
```

Where should this key be added (roles):
- [ ] PROD-SIGNAL
- [ ] TURN-1
- [ ] TURN-2
- [ ] DEV

## 4) Domains / Subdomains (you will set DNS)
Fill in desired hostnames:

- Production web + signaling: 
  - web: <fill>
  - signal: <fill>
- TURN:
  - turn1: <fill>
  - turn2: <fill>
- Dev:
  - dev web: <fill>
  - dev signaling: <fill>
  - dev TURN (optional): <fill>

## 5) TLS / Certificates
- Preferred email for Let’s Encrypt: admin@p2p.red
- Where should certs live (Nginx reverse proxy)?
  - [ ] PROD-SIGNAL
  - [ ] TURN-1
  - [ ] TURN-2
  - [ ] DEV

## 6) Networking / Firewall (Must check and configure firewall on each host)
- UFW enabled? (Y/N) <fill>
- Open ports allowed: 
  - Web/Signal: 80, 443
  - TURN: 3478 (UDP/TCP), 5349 (TLS), + relay range:
  - SSH: 22 (or custom)
- Preferred TURN relay port range (e.g. 49152-65535): 49152-65535

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

- Admin domain: <fill>
- Auth method (Basic Auth / SSO / VPN-only): <fill>
- Allowed IPs (optional): <fill>

## 9) Environment & Runtime (Must check and configure on each host)
- Node version:
- Docker + Docker Compose installed? (Y/N)
- OS version (Ubuntu, etc):

## 10) Notes / Constraints
- Any provider restrictions or compliance constraints? <fill>
- Backup requirements? <fill>
- Preferred log retention? <fill>

---

When you complete this, I’ll draft:
- docker-compose stacks (PeerJS, coturn, monitoring)
- Nginx reverse proxies + TLS
- Firewall rules
- Operational runbook + upgrade steps
