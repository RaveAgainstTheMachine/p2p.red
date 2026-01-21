# Load Balancer Migration Plans (Envoy + HAProxy)

This document outlines OSS migration paths from the current Nginx OSS edge to **Envoy** or **HAProxy** for near‑zero downtime blue/green switching. HTTP/2 is supported; **HTTP/3 is intentionally excluded** (project rule: no QUIC).

## Context (Current State)
- Edge proxy: Nginx OSS in `p2p-nginx` container.
- Upstream app: blue/green containers `p2p-app-blue` / `p2p-app-green`.
- Cutover: static upstream swap + reload (can cause brief blips).
- Runtime host: **no full source**, images shipped as tars.

## Goals
- Near‑zero downtime cutover with graceful draining.
- Keep existing domain layout (`p2p.red`, `signal.p2p.red`, `plausible.p2p.red`).
- Preserve current security headers and route behavior.
- Low overhead, strong performance, OSS only.

---

# Option A: Envoy Migration Plan (OSS)

## Pros
- Dynamic config (xDS) enables **traffic shifting without reload blips**.
- Native health checks, circuit breakers, outlier detection.
- Fine‑grained stats/metrics.
- HTTP/2 first‑class support.

## Cons
- Heavier footprint than HAProxy (memory/CPU).
- Operational complexity (xDS management or file‑based hot reload).
- More verbose configuration.

## Refactoring Scope
1. **Replace Nginx container** with Envoy container.
2. **Replace nginx.conf** with Envoy bootstrap config.
3. **New control path** for blue/green switching:
   - Static config + admin API for weight adjustments, or
   - Minimal xDS management for dynamic weights.
4. **Update deploy scripts** to shift weights instead of swapping upstream.
5. **Update documentation** to reflect Envoy as edge.

## Envoy Container (Docker)
- New `Dockerfile.envoy` based on `envoyproxy/envoy`.
- Mount `/etc/envoy/envoy.yaml` and certs.
- Expose :80/:443.

## Routing Plan (Envoy)
- Listeners: `p2p.red`, `signal.p2p.red`, `plausible.p2p.red`.
- Clusters:
  - `app_blue`, `app_green` (HTTP/2 enabled, health checks).
  - `peerjs`, `metadata_api`, `plausible`.
- Routes:
  - `/api/*` -> metadata_api
  - `/peerjs/*` -> peerjs (upgrade ws)
  - `/js/script.js` + `/api/event` -> plausible
  - `/` -> **weighted cluster**: app_blue / app_green

## Blue/Green Switching (Envoy)
- Keep both clusters active.
- Adjust weights via admin API or xDS:
  - Start: blue=100 / green=0
  - Shift: 90/10 → 50/50 → 10/90 → 0/100
- Use **drain time** and **slow‑start** to avoid spikes.

## Deployment Steps (Envoy)
1. Build Envoy image + config locally; save tar.
2. Copy tar to prod and load.
3. Start Envoy container alongside Nginx (different port), validate.
4. Switch DNS or port binding from Nginx to Envoy.
5. Update blue/green deploy script to call Envoy admin API for weight shifts.
6. Rollback: rebind to Nginx or set weights back to old env.

## Script Changes (Envoy)
- New script: `automation/envoy-shift-traffic.sh`
  - Inputs: target color + step schedule + sleep intervals.
  - Uses `curl` to Envoy admin API to update cluster weights.
- Modify `deploy-zero-downtime.sh` to:
  - Start new env
  - Health check
  - Run `envoy-shift-traffic.sh`
  - Drain old env then stop

---

# Option B: HAProxy Migration Plan (OSS)

## Pros
- Very low overhead; excellent throughput.
- Runtime API to update weights **without reload blips**.
- Clear draining controls (slow‑start, `on-marked-down shutdown-sessions`).
- Simple configuration compared to Envoy.

## Cons
- Fewer L7 features and observability than Envoy.
- Still needs separate admin/stats endpoint for runtime updates.

## Refactoring Scope
1. **Replace Nginx container** with HAProxy container.
2. **Replace nginx.conf** with `haproxy.cfg`.
3. **Update scripts** to use runtime socket/API to shift weights.
4. **Update docs** to reflect HAProxy as edge.

## HAProxy Container (Docker)
- New `Dockerfile.haproxy` using `haproxy:2.9-alpine`.
- Mount `/usr/local/etc/haproxy/haproxy.cfg` and certs.
- Expose :80/:443.

## Routing Plan (HAProxy)
- Frontends:
  - `p2p_red_https` (TLS termination, HTTP/2)
  - `signal_https`
  - `plausible_https`
- Backends:
  - `app_blue`, `app_green`, `peerjs`, `metadata_api`, `plausible`
- ACLs for paths:
  - `/api/` → metadata
  - `/peerjs/` → peerjs
  - `/js/script.js` + `/api/event` → plausible
  - default → **weighted app backend**

## Blue/Green Switching (HAProxy)
- Use runtime socket commands:
  - `set server app_blue/blue weight 100`
  - `set server app_green/green weight 0`
- Gradual shift: update weights in steps.
- `slowstart` and `rise/fall` health checks.

## Deployment Steps (HAProxy)
1. Build HAProxy image + config locally; save tar.
2. Copy tar to prod and load.
3. Start HAProxy alongside Nginx (different port), validate.
4. Switch bindings from Nginx to HAProxy.
5. Update deploy script to shift weights via HAProxy runtime socket.
6. Rollback: rebind to Nginx or reset weights.

## Script Changes (HAProxy)
- New script: `automation/haproxy-shift-traffic.sh`
  - Uses `socat` or HAProxy Runtime API.
  - Accepts target color and step schedule.
- Modify `deploy-zero-downtime.sh` to:
  - Start new env
  - Health check
  - Run `haproxy-shift-traffic.sh`
  - Drain old env then stop

---

# Envoy vs HAProxy Summary

| Criteria | Envoy | HAProxy |
|---|---|---|
| Overhead | Medium | Low |
| Dynamic reconfig | Strong (xDS/admin) | Strong (runtime socket) |
| Observability | Excellent | Good |
| Complexity | Higher | Lower |
| Best fit | Feature‑rich, future‑proof | Minimal, high‑perf |

---

# Recommendation
- **HAProxy** if you want the lightest, fastest OSS option and simple runtime switching.
- **Envoy** if you want richer L7 features and advanced resiliency tooling.

Both will still respect the project rule: **no HTTP/3 / QUIC**.
