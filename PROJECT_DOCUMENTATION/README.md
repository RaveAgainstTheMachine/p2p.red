# Documentation Index (P2P.red)

## Overview
Current documentation for the WebRTC + PeerJS file sharing application.

## Primary Docs
- **WEBRTC_ARCHITECTURE_GUIDE.md** — WebRTC P2P architecture and security.
- **DESKTOP_APP_PLAN.md** — current desktop roadmap and UX direction.
- **SEO_TRAFFIC_PLAN.md** — SEO and traffic plan.
- **UI_IMPLEMENTATION_GUIDE.md** — UI implementation patterns (web).
- **UI_THEME_DOCUMENTATION.md** — current UI theme and palette details.

## Additional Docs
- **ARCHITECTURE.md** — production architecture and scaling design.
- **PROJECT_OVERVIEW.md** — high-level product summary.
- **LARGE-FILE-TRANSFER.md** — large file transfer design notes.
- **MALWARE_SCANNING_PLAN.md** — security scanning roadmap.
- **MEMORY-OPTIMIZATION.md** — memory/streaming optimizations.
- **LESSONS_DEP_UPGRADE.md** — dependency upgrade lessons.
- **DESKTOP_APP_PROJECT_PLAN.md** — extended desktop app plan.

## Recommended Reading Order
1) **WEBRTC_ARCHITECTURE_GUIDE.md**
2) **DESKTOP_APP_PLAN.md**
3) **UI_IMPLEMENTATION_GUIDE.md**
4) **UI_THEME_DOCUMENTATION.md**

## Current Architecture Rules
- WebRTC DataChannels only (true P2P).
- PeerJS signaling (self-hosted).
- TURN servers only for NAT traversal (no file relay).

---

**Status**: Active and maintained
