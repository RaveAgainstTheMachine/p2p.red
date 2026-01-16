# Desktop App Plan (P2P.red)

## Goals
- True P2P transfers (WebRTC DataChannels) with end-to-end encryption (AES-GCM). No relays for data beyond TURN traversal.
- Desktop parity with web, plus desktop-specific capabilities (local FS access, resilient transfers, richer controls).
- Privacy-first: no user-identifying data collected or displayed. Metadata stays local by default.
- Security-first: encrypted comms everywhere; minimal logging; short-lived secrets; secure wipe capability.

## Current State
- Tauri desktop scaffold in monorepo; shared package alias wired.
- NAT-PMP/UPnP consent-based probe implemented in Rust + UI.
- Security hygiene: secure wipe command + UI, zeroize helper, release hardening (LTO/strip).
- Desktop lint/build clean; Tailwind removed for now.
- Native single-window UI: nav rail + top strip, tabbed panels (Dashboard, Approvals, Diagnostics, Settings).
- ICE/relay diagnostics placeholders in UI (non-identifying).

## UI/UX Direction
- Native desktop layout with nav rail and compact table views (no web-page feel).
- Dark slate palette, subtle borders, system UI font stack (Segoe/SF).
- Tabs for Dashboard, Approvals, Diagnostics, Settings; top strip for global actions.

## Features (Phased)
### Implementable Now (client-side, minimal backend)
- Create share/multi-share skeleton with options:
  - Password protect (password never sent to server; hashed locally if stored).
  - Approval required (client-side queue).
  - Timed share expiry; perma-share toggle.
  - Download cap (max downloads, unlimited if blank); show remaining; block when reached.
  - Rate limiting (client-side throttle).
  - Geo allow/deny (store only country codes; apply before transfer).
- Active shares management:
  - Pause/resume; stop; delete share metadata (never data).
  - Toggle share on/off.
  - Clear stats per share (aggregates only: counts, countries, avg speed).
  - Presence badges: sharer online, downloader ready.
- Approvals flow:
  - Per-share queue; inline approve/deny; approve all.
  - Respect download caps; auto-block if cap reached.
- Connection assistance & diagnostics:
  - NAT-PMP/UPnP probe (consent-based), external IP, mapping status.
  - ICE diagnostics: candidate type (host/srflx/relay), transport, RTT, packet loss, active streams, assisted indicator.
- Transfer resilience:
  - Pause/resume transfers; resume failed/paused downloads/uploads.
  - Keep metadata local; stream from disk to WebRTC (no caching files).

### Minimal Backend Needed (lightweight metadata service; still no data relay)
- Persist share metadata (expiry, caps, approvals, geo rules, passwords hashed) across sessions.
- Persist approval queues and decisions; support multi-device approvals if needed.
- Persist aggregate stats (counts, countries, avg speed) with clear-stats endpoint.
- Enforce download caps/expiry server-side to survive restarts.
- Ephemeral TURN credentials if moving off static creds (never stored in client binaries).

### Future/Premium Hooks
- Perma shares and higher limits/geo rules as gated features.
- Multi-share management with bulk actions across member shares.
- Advanced rate limits and geoblocking policies.

## Privacy & Security Measures
- No user IDs, emails, IP logs, or fingerprints. Aggregate-only stats; optional and clearable.
- All comms encrypted: HTTPS signaling, DTLS-SRTP data channels, TURN over TLS where available.
- No server-side file storage or relays; TURN only for traversal.
- Memory hygiene: zero sensitive buffers (keys/passwords) after use; avoid long-lived globals; no secrets in logs.
- Storage hygiene: local encrypted metadata store; no plaintext secrets; no caching of file contents.
- Logging: minimal, non-sensitive; disable verbose in release; gated debug builds only.
- Build hardening: strip symbols, LTO in release; code-sign; no embedded static credentials.
- Uninstall / secure wipe: in-app action to delete app data dirs, temp files, keys, and best-effort memory scrub, then exit. Document OS uninstall steps.
- Process snooping mitigation: keep secrets short-lived; avoid stdout/stderr logging in release.

## Implementation Focus (to prioritize with you)
- Pending alignment on next feature set; current plan captures agreed direction without committed next actions.
