# Envoy Migration Plan (Blue/Green Zero-Downtime)

## Goals
- Near-zero downtime blue/green cutover with graceful draining.
- Preserve current domain layout: `p2p.red`, `signal.p2p.red`, `plausible.p2p.red`.
- Maintain existing security headers and route behavior.
- Keep HTTP/2 support; **no HTTP/3/QUIC**.
- Use OSS Envoy with minimal overhead and secure defaults.

## Current Nginx/Blue-Green Touchpoints to Replace
- Edge config: `nginx.conf`, `nginx.blue-green.conf`.
- Container build: `Dockerfile.nginx`.
- Runtime compose: `docker-compose.yml` (nginx service).
- Blue/green compose: `docker-compose.blue-green.yml` (app-blue/app-green targets).
- Deploy scripts:
  - `automation/deploy-zero-downtime.sh` (nginx upstream swap + reload).
  - `automation/switch-upstream.sh` (nginx-specific).
  - `automation/build-prod-images.sh` (builds nginx image tar).
  - `deploy.sh` (nginx health checks).

## Envoy Architecture (Edge)
### Listeners
- `:443` TLS listeners for:
  - `p2p.red`, `www.p2p.red`
  - `signal.p2p.red`
  - `plausible.p2p.red`
- `:80` HTTP redirect -> HTTPS for each host.

### Clusters
- `app_blue`, `app_green` (weighted, HTTP/2 enabled).
- `peerjs`, `metadata_api`, `anubis`, `plausible`.

### Routes (match Nginx behavior)
- `/api/*` -> `anubis` for metadata endpoints, `metadata_api` for others.
- `/peerjs/*` -> `peerjs` (websocket upgrade).
- `/js/script.js` + `/api/event` -> `plausible`.
- `/share/*` rewrite -> `/api/metadata/:id?html=true`.
- `/` -> weighted cluster: `app_blue` + `app_green`.

### Security Headers
- Preserve CSP, HSTS, X-Content-Type-Options, X-Frame-Options from `nginx.conf`.
- Rate limiting: use Envoy rate-limit filter or retain app/metadata controls.
- Lock down Envoy admin API (local-only or internal Docker network).

## Blue/Green Switching Strategy
- Keep both clusters live; shift weights with no reload blips.
- Recommended shifts: `100/0 -> 90/10 -> 50/50 -> 10/90 -> 0/100`.
- Use Envoy slow start + drain time to protect in-flight requests.

## Required Repo Changes
### New Files
- `Dockerfile.envoy` (Envoy container image).
- `envoy.yaml` (bootstrap config).
- `automation/envoy-shift-traffic.sh` (admin API weight shift tool).

### Modify Existing
- `docker-compose.yml`: replace `nginx` service with `envoy` service.
- `docker-compose.blue-green.yml`: ensure service names match Envoy cluster targets.
- `automation/deploy-zero-downtime.sh`: replace nginx swap/reload with Envoy weight shifts.
- `automation/switch-upstream.sh`: deprecate or replace with Envoy traffic shift.
- `automation/build-prod-images.sh`: build and save Envoy image tar.
- `deploy.sh`: replace nginx health checks with Envoy checks.

## Migration Procedure (Prod)
1. Build Envoy image locally and ship tar to prod.
2. Run Envoy alongside Nginx on alternate ports for validation.
3. Validate routing, headers, and websocket behavior against Nginx.
4. Switch bindings from Nginx to Envoy.
5. Update blue/green workflow to shift Envoy weights during deploy.

### Rollback
- Rebind to Nginx or reset Envoy weights to prior live color.

## Documentation Updates
- `PROJECT_DOCUMENTATION/BUILD_DEPLOY.md`: replace Nginx-specific steps with Envoy workflow.
- `PROJECT_DOCUMENTATION/LOAD_BALANCER_MIGRATION.md`: mark Envoy path as primary.
- `PROJECT_DOCUMENTATION/INFRASTRUCTURE.md`: note Envoy replaces Nginx in prod.

## Security & Efficiency Notes
- TLS termination at Envoy; use current certs mounted from `/etc/letsencrypt`.
- Keep admin interface private.
- Enable outlier detection and circuit breakers for resilience.
- Retain existing P2P rules (no server file relay).
