# Documentation Index (P2P.red)

## Overview
Current documentation for the WebRTC + PeerJS + VPS deployment stack.

## Primary Docs
- **INFRASTRUCTURE.md** — dev/prod infra, domains, IPs, WireGuard, OpenBao.
- **BUILD_DEPLOY.md** — dev/prod build and deployment workflows.
- **INFRA_SETUP_TEMPLATE.md** — authoritative infra intake (hosts, DNS, TLS, ports).
- **VPS_DEPLOYMENT_GUIDE.md** — deployment guide (needs alignment with multi-host setup).
- **WEBRTC_ARCHITECTURE_GUIDE.md** — WebRTC P2P architecture and security.
- **DESKTOP_APP_PLAN.md** — current desktop roadmap and UX direction.
- **SEO_TRAFFIC_PLAN.md** — SEO and low-effort traffic plan.
- **UI_IMPLEMENTATION_GUIDE.md** — UI implementation patterns (web).
- **UI_THEME_DOCUMENTATION.md** — current UI theme and palette details.

## Additional Docs
- **ARCHITECTURE.md** — production architecture and scaling plan.
- **SCALING-PLAN.md** — scaling notes and capacity planning.
- **PROJECT_OVERVIEW.md** — high-level product summary.
- **LARGE-FILE-TRANSFER.md** — large file transfer design notes.
- **LOAD_BALANCER_MIGRATION.md** — Envoy/HAProxy migration plans.
- **MALWARE_SCANNING_PLAN.md** — security scanning roadmap.
- **MEMORY-OPTIMIZATION.md** — memory/streaming optimizations.
- **LESSONS_DEP_UPGRADE.md** — dependency upgrade lessons.
- **DESKTOP_APP_PROJECT_PLAN.md** — extended desktop app plan.

## Recommended Reading Order
1) **WEBRTC_ARCHITECTURE_GUIDE.md**
2) **INFRASTRUCTURE.md**
3) **BUILD_DEPLOY.md**
4) **INFRA_SETUP_TEMPLATE.md**
5) **VPS_DEPLOYMENT_GUIDE.md**
6) **DESKTOP_APP_PLAN.md**
7) **UI_IMPLEMENTATION_GUIDE.md**
8) **UI_THEME_DOCUMENTATION.md**

## Current Architecture Rules
- WebRTC DataChannels only (true P2P).
- PeerJS signaling (self-hosted).
- TURN servers only for NAT traversal (no file relay).
- VPS + Docker + Envoy deployment.

## Private Notes
Store sensitive documentation in `PROJECT_DOCUMENTATION/PRIVATE/` or files suffixed with `_PRIVATE.md` or `_SENSITIVE.md` (gitignored).

---

**Status**: Active and maintained
