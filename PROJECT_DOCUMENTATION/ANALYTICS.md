# Analytics (Plausible)

This document describes the analytics setup for p2p.red. We use self-hosted Plausible with OpenBao-managed secrets.

## Core Principles
- Privacy-first, cookie-free analytics (no cross-site tracking).
- Self-hosted on the prod VPS.
- All secrets are stored in OpenBao and rendered to `/run/secrets/plausible.env`.

## Domains
- Analytics UI: `https://plausible.p2p.red`
- App site: `https://p2p.red`

## Infrastructure
- Host: `p2pred01` (prod VPS)
- Services: `plausible`, `plausible-db`, `plausible-events-db` (ClickHouse)
- Reverse proxy: Nginx on the VPS

## Secrets (OpenBao)
KV paths (v2):
- `kv/p2p/prod/plausible`
- `kv/p2p/dev/plausible`

Required fields:
- `db_password`
- `secret_key_base`

OpenBao agent renders:
- `/run/secrets/plausible.env`

Template (`/var/lib/openbao-agent/plausible.env.tpl`):
```hcl
{{- with secret "kv/p2p/prod/plausible" -}}
PLAUSIBLE_DB_PASSWORD={{ .Data.data.db_password }}
PLAUSIBLE_SECRET_KEY_BASE={{ .Data.data.secret_key_base }}
{{- end -}}
```

Agent stanza (`/var/lib/openbao-agent/agent.hcl`):
```hcl
template {
  source      = "/agent/plausible.env.tpl"
  destination = "/run/secrets/plausible.env"
  perms       = 0640
}
```

## TLS
Issue a cert for `plausible.p2p.red` (nginx owns :80/:443):
```bash
docker stop p2p-nginx
sudo certbot certonly --standalone -d plausible.p2p.red
docker start p2p-nginx
```
Then reload nginx:
```bash
docker cp /opt/p2p-file-share/nginx.conf p2p-nginx:/etc/nginx/nginx.conf
docker exec -i p2p-nginx nginx -t && docker exec -i p2p-nginx nginx -s reload
```

## Nginx + CSP
Nginx routes `plausible.p2p.red` to the Plausible service and allows:
- `script-src` `https://plausible.p2p.red`
- `connect-src` `https://plausible.p2p.red`

## Verification
- `docker compose ps | grep plausible`
- Open `https://plausible.p2p.red`
- Confirm `/run/secrets/plausible.env` exists
