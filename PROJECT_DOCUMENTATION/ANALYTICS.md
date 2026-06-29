# Analytics (Plausible)

This document describes the analytics setup for <domain>. We use self-hosted Plausible with OpenBao-managed secrets.

## Core Principles
- Privacy-first, cookie-free analytics (no cross-site tracking).
- Self-hosted on the prod VPS.
- All secrets are stored in OpenBao and rendered to `/run/secrets/plausible.env`.

## Domains
- Analytics UI: `https://plausible.<domain>`
- App site: `https://<domain>`

## Infrastructure
- Host: `p2pred01` (prod VPS)
- Services: `plausible`, `plausible-db`, `plausible-events-db` (ClickHouse)
- Reverse proxy: Envoy on the VPS

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
Issue a cert for `plausible.<domain>` (Envoy owns :80/:443):
```bash
docker stop p2p-envoy
sudo certbot certonly --standalone -d plausible.<domain>
docker start p2p-envoy
```

## Envoy + CSP
Envoy routes `plausible.<domain>` to the Plausible service and allows:
- `script-src` `https://plausible.<domain>`
- `connect-src` `https://plausible.<domain>`

### First-party proxy (<domain>)
The app uses first-party proxy routes so browsers post to `https://<domain>/api/event`.
Ensure the Envoy route for `/api/event` is **before** the `/api/` catch-all so it
does not get sent to the metadata API (which returns 404).

## Verification
- `docker compose ps | grep plausible`
- Open `https://plausible.<domain>`
- Confirm `/run/secrets/plausible.env` exists
- Confirm first-party endpoint returns `202`:
  - `curl -sS -X POST https://<domain>/api/event -H 'Content-Type: application/json' -d '{"name":"pageview","url":"https://<domain>/","domain":"<domain>"}' -D -`

## Admin Bootstrap (first-time)
Create the initial admin user and site ownership. Store the password in Bitwarden.

Create admin user (prod):
```bash
cd /opt/p2p-file-share
docker exec -i p2p-plausible bin/plausible rpc \
  "IO.inspect(Plausible.Auth.create_user(\"Admin\", \"<email>\", \"<password>\"))"
```

Create site + membership (prod):
```bash
docker exec -i p2p-plausible-db psql -U plausible -d plausible -c \
  "INSERT INTO sites (domain, timezone, public, locked, has_stats, imported_data, ingest_rate_limit_threshold, inserted_at, updated_at, domain_changed_from, domain_changed_at) VALUES ('<domain>', 'UTC', false, false, false, NULL, 60, now(), now(), '<domain>', now()) ON CONFLICT (domain) DO NOTHING RETURNING id;"

docker exec -i p2p-plausible-db psql -U plausible -d plausible -c \
  "INSERT INTO site_memberships (user_id, site_id, role, inserted_at, updated_at) VALUES (1, 1, 'owner', now(), now()) ON CONFLICT DO NOTHING;"
```
