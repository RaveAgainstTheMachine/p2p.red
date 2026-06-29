# OpenBao Deployment (Public)

This document describes how OpenBao is deployed and operated for <domain>. All secrets must remain in OpenBao. Do not commit secrets or unseal keys.

## Scope
- Host: `<bao-domain>`
- Network: WireGuard-only (<ip>)
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
getent hosts <bao-domain>
```

2) Temporarily open 80/443 **only** for cert issuance
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

3) Issue/renew certificate (standalone)
```bash
sudo systemctl stop nginx || true
sudo certbot certonly --standalone -d <bao-domain> --agree-tos -m <email> --non-interactive
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
sudo cp /etc/letsencrypt/live/<bao-domain>/fullchain.pem /opt/openbao/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/<bao-domain>/privkey.pem /opt/openbao/certs/privkey.pem
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
  address = "<ip>:8200"
  tls_disable = false
  tls_cert_file = "/bao/config/certs/fullchain.pem"
  tls_key_file  = "/bao/config/certs/privkey.pem"
}

storage "raft" {
  path    = "/bao/data"
  node_id = "bao-01"
}

api_addr = "https://<bao-domain>:8200"
cluster_addr = "https://<bao-domain>:8201"
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
      - "<ip>:8200:8200"
      - "<ip>:8201:8201"
    environment:
      BAO_LOG_LEVEL: info
      BAO_API_ADDR: https://<bao-domain>:8200
      BAO_CLUSTER_ADDR: https://<bao-domain>:8201
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
  - `kv/p2p/prod/plausible`
  - `kv/p2p/dev/plausible`

### Human Admin (userpass)
Create a non-root admin user for day-to-day management. The root token should be stored offline and used only for break-glass access.

```bash
# Example (set your own strong password)
bao write auth/userpass/users/bao-admin \
  password="<strong-password>" \
  policies="p2p-admin"
```

### Service Auth (AppRole)
Create AppRoles for services and store the resulting `role_id` + `secret_id` in Bitwarden. Do not commit these values.

```bash
bao write auth/approle/role/p2p-prod-services \
  token_policies="p2p-prod-readwrite" \
  token_ttl=1h token_max_ttl=4h

bao write auth/approle/role/p2p-dev-services \
  token_policies="p2p-dev-readwrite" \
  token_ttl=1h token_max_ttl=4h

bao read -field=role_id auth/approle/role/p2p-prod-services/role-id
bao write -force -field=secret_id auth/approle/role/p2p-prod-services/secret-id

bao read -field=role_id auth/approle/role/p2p-dev-services/role-id
bao write -force -field=secret_id auth/approle/role/p2p-dev-services/secret-id
```

### Initial Secrets (KV v2)
Store generated secrets in Bitwarden. Do not commit any values.

```bash
# Postgres passwords
bao kv put kv/p2p/prod/postgres password="<prod-postgres-password>"
bao kv put kv/p2p/dev/postgres password="<dev-postgres-password>"

# TURN REST HMAC secrets
bao kv put kv/p2p/prod/turn secret="<prod-turn-secret>"
bao kv put kv/p2p/dev/turn secret="<dev-turn-secret>"

# Metadata API secrets (if using TURN secrets directly)
bao kv put kv/p2p/prod/metadata turn_secret="<prod-turn-secret>"
bao kv put kv/p2p/dev/metadata turn_secret="<dev-turn-secret>"

# Plausible Analytics secrets
bao kv put kv/p2p/prod/plausible \
  db_password="<prod-plausible-db-password>" \
  secret_key_base="<prod-plausible-secret-key-base>"
bao kv put kv/p2p/dev/plausible \
  db_password="<dev-plausible-db-password>" \
  secret_key_base="<dev-plausible-secret-key-base>"
```

### Service Integration (metadata)
`metadata-api` loads `/run/secrets/metadata.env` when present (generated by OpenBao Agent) and falls back to local `.env` for dev.

```bash
POSTGRES_PASSWORD=...
TURN_SECRET=...
ADMIN_JWT_SECRET=...
```

### Service Integration (plausible)
Plausible reads `/run/secrets/plausible.env` (generated by OpenBao Agent).

`/var/lib/openbao-agent/plausible.env.tpl`
```hcl
{{- with secret "kv/p2p/prod/plausible" -}}
PLAUSIBLE_DB_PASSWORD={{ .Data.data.db_password }}
POSTGRES_PASSWORD={{ .Data.data.db_password }}
SECRET_KEY_BASE={{ .Data.data.secret_key_base }}
DATABASE_URL=postgres://plausible:{{ .Data.data.db_password }}@plausible-db:5432/plausible
{{- end -}}
```

Agent template stanza (`/var/lib/openbao-agent/agent.hcl`):
```hcl
template {
  source      = "/agent/plausible.env.tpl"
  destination = "/run/secrets/plausible.env"
  perms       = 0640
}
```

## OpenBao Agent (service hosts)
The agent container runs as the OpenBao image user (`uid=100`, `gid=1000`). The host paths must be readable/writable by that UID/GID or the agent will fail with `permission denied` when reading `/agent/role_id`.

### Required paths
- Config + AppRole files: `/var/lib/openbao-agent/`
  - `agent.hcl`, `metadata.env.tpl`, `plausible.env.tpl`, `role_id`, `secret_id`
- Output secrets (tmpfs): `/run/secrets/metadata.env`, `/run/secrets/plausible.env`

### Required ownership + permissions
```bash
sudo chown -R 100:1000 /var/lib/openbao-agent
sudo chmod 750 /var/lib/openbao-agent
sudo chmod 640 /var/lib/openbao-agent/agent.hcl /var/lib/openbao-agent/metadata.env.tpl \
  /var/lib/openbao-agent/role_id /var/lib/openbao-agent/secret_id

sudo chown 100:1000 /run/secrets
sudo chmod 770 /run/secrets
```

### Systemd unit (dev/prod)
Run the container with the matching UID/GID:
```ini
ExecStart=/usr/bin/docker run --rm --name openbao-agent \
  --user 100:1000 \
  -v /var/lib/openbao-agent:/agent:ro \
  -v /run/secrets:/run/secrets \
  -v /etc/ssl/certs:/etc/ssl/certs:ro \
  openbao/openbao:latest agent -config=/agent/agent.hcl
```

### Troubleshooting
- Error: `open /agent/role_id: permission denied`
  - Fix ownership/mode using the commands above, then restart the unit.
- Verify rendering:
  - `sudo systemctl status openbao-agent.service --no-pager -l`
  - Log should show: `rendered "/agent/metadata.env.tpl" => "/run/secrets/metadata.env"`
  - Log should show: `rendered "/agent/plausible.env.tpl" => "/run/secrets/plausible.env"`

## Operations
- Status: `docker exec -it openbao bao status`
- Seal: `docker exec -it openbao bao operator seal`
- Unseal: `docker exec -it openbao bao operator unseal`
- Backup: snapshot `openbao_openbao_data` volume daily (encrypted)

## WireGuard Health Alerts (bao host)
WireGuard health monitoring runs on the bao host and posts to a Discord webhook.

**Files**
- Script: `/usr/local/sbin/wg-healthcheck.sh`
- Webhook URL: `/etc/wg-healthcheck/webhook.url`
- State: `/var/lib/wg-healthcheck/state.env`

**Systemd**
- Timer (every 5 min): `wg-healthcheck.timer`
- Hourly summary: `wg-healthcheck-summary.timer`

**Manual tests**
```
sudo systemctl start wg-healthcheck-summary.service
sudo /usr/local/sbin/wg-healthcheck.sh summary
```

**Notes**
- Summary posts hourly even when healthy.
- Alerts are suppressed for the dev peer (`<ip>/32`).
- Discord summary format: one host per line with ✅/❌ status markers.

## Auto-Restart on Reboot
- OpenBao uses `restart: unless-stopped` in compose.
- Ensure Docker is enabled to start on boot:
  ```bash
  sudo systemctl enable docker
  ```
- Dev services should only be started manually when testing.

## Cert Renewal Notes
Let’s Encrypt will only renew while 80/443 are open. Use the same temporary open/close flow above and re-copy certs to `/opt/openbao/certs` after renewal, then restart OpenBao.
