# OpenBao Deployment (Public)

This document describes how OpenBao is deployed and operated for p2p.red. All secrets must remain in OpenBao. Do not commit secrets or unseal keys.

## Scope
- Host: `bao.p2p.red`
- Network: WireGuard-only (10.88.0.1)
- Storage: Raft (single node for now)
- TLS: Let’s Encrypt, issued only when ports 80/443 are temporarily opened

## Files and Paths
- `/opt/openbao/docker-compose.yml`
- `/opt/openbao/bao.hcl`
- `/opt/openbao/certs/fullchain.pem`
- `/opt/openbao/certs/privkey.pem`
- Data volume: `openbao_openbao_data`

## Deployment (from dev)
Run from the dev box via SSH.

1) Verify DNS
```bash
getent hosts bao.p2p.red
```

2) Temporarily open 80/443 **only** for cert issuance
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

3) Issue/renew certificate (standalone)
```bash
sudo systemctl stop nginx || true
sudo certbot certonly --standalone -d bao.p2p.red --agree-tos -m admin@p2p.red --non-interactive
sudo systemctl stop nginx || true
```

4) Close 80/443
```bash
sudo ufw delete allow 80/tcp
sudo ufw delete allow 443/tcp
```

5) Sync certs for OpenBao
```bash
sudo mkdir -p /opt/openbao/certs
sudo cp /etc/letsencrypt/live/bao.p2p.red/fullchain.pem /opt/openbao/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/bao.p2p.red/privkey.pem /opt/openbao/certs/privkey.pem
sudo chown 100:1000 /opt/openbao/certs/fullchain.pem /opt/openbao/certs/privkey.pem
sudo chmod 640 /opt/openbao/certs/fullchain.pem /opt/openbao/certs/privkey.pem
```

6) Start service
```bash
cd /opt/openbao
sudo docker compose up -d
```

## OpenBao Config
`/opt/openbao/bao.hcl`
```
ui = true

listener "tcp" {
  address = "0.0.0.0:8200"
  tls_disable = false
  tls_cert_file = "/bao/config/certs/fullchain.pem"
  tls_key_file  = "/bao/config/certs/privkey.pem"
}

storage "raft" {
  path    = "/bao/data"
  node_id = "bao-01"
}

api_addr = "https://bao.p2p.red:8200"
cluster_addr = "https://bao.p2p.red:8201"
```

`/opt/openbao/docker-compose.yml`
```
services:
  openbao:
    image: openbao/openbao:latest
    container_name: openbao
    restart: unless-stopped
    user: "100:1000"
    cap_add:
      - IPC_LOCK
    ports:
      - "10.88.0.1:8200:8200"
      - "10.88.0.1:8201:8201"
    environment:
      BAO_LOG_LEVEL: info
      BAO_API_ADDR: https://bao.p2p.red:8200
      BAO_CLUSTER_ADDR: https://bao.p2p.red:8201
    volumes:
      - openbao_data:/bao/data
      - /opt/openbao/bao.hcl:/bao/config/bao.hcl:ro
      - /opt/openbao/certs/fullchain.pem:/bao/config/certs/fullchain.pem:ro
      - /opt/openbao/certs/privkey.pem:/bao/config/certs/privkey.pem:ro
    command: >
      server -config=/bao/config/bao.hcl
```

## Init + Unseal
```bash
docker exec -it openbao bao operator init -key-shares=5 -key-threshold=3
# Store unseal keys + root token offline.

docker exec -it openbao bao operator unseal
```

## Auth + Policies (summary)
- Humans: `userpass`
- Services: `approle`
- KV paths (KV v2):
  - `kv/p2p/prod/postgres`
  - `kv/p2p/dev/postgres`
  - `kv/p2p/prod/turn`
  - `kv/p2p/dev/turn`
  - `kv/p2p/prod/metadata`
  - `kv/p2p/dev/metadata`

## Operations
- Status: `docker exec -it openbao bao status`
- Seal: `docker exec -it openbao bao operator seal`
- Unseal: `docker exec -it openbao bao operator unseal`
- Backup: snapshot `openbao_openbao_data` volume daily (encrypted)

## Auto-Restart on Reboot
- OpenBao uses `restart: unless-stopped` in compose.
- Ensure Docker is enabled to start on boot:
  ```bash
  sudo systemctl enable docker
  ```
- Dev services should only be started manually when testing.

## Cert Renewal Notes
Let’s Encrypt will only renew while 80/443 are open. Use the same temporary open/close flow above and re-copy certs to `/opt/openbao/certs` after renewal, then restart OpenBao.
