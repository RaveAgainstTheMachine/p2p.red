# P2P File Share - Security Review Report
**Date:** 2026-01-22

## Scope
Reviewed security-sensitive areas across the codebase:
- Metadata API (Express + Postgres + Redis)
- WebRTC signaling + TURN credential issuance
- Client-side encryption and transfer flow
- Nginx reverse proxy configuration
- Secrets handling in deployment and runtime

## Executive Summary
**Overall risk:** Medium

The core architecture is strong (true P2P transfer, client-side encryption, server-side metadata-only), but there are several actionable vulnerabilities and security hardening gaps:
- **High:** HTML injection/XSS risk in share-preview HTML rendering.
- **High:** PIN values passed via query string are logged by request logging middleware.
- **Medium:** `/api/status` uses Host header to build outbound URLs (SSRF-style surface).
- **Medium:** CSP allows `unsafe-inline`, weakening XSS protection.
- **Medium:** Public endpoints lack explicit request size limits; denial-of-service risk via large JSON bodies.
- **Low:** Existing security documentation contains inaccurate claims about tracking and server-side metadata visibility.

## Findings (by severity)

### High

1) **Share preview HTML injection (XSS)**
- **Where:** `/metadata-api/server.js` rich preview HTML for `/share/:key` and `/api/metadata/:key?html=true`.
- **Details:** `metadata.file_name` and `metadata.file_type` are interpolated into HTML without escaping. Malicious filenames can inject HTML/JS into the preview page.
- **Risk:** XSS against link preview endpoints (human or bot visitors), potential session theft on shared domain.
- **Refs:** @/opt/p2p-file-share/metadata-api/server.js#420-590, @/opt/p2p-file-share/metadata-api/server.js#593-760.
- **Recommendation:** Escape user-provided values before inserting into HTML (use a minimal HTML-escape helper).

2) **PIN in query string is logged**
- **Where:** `/metadata-api/server.js` uses `morgan('combined')` with query string logging, and PIN is provided as `?pin=1234`.
- **Risk:** PINs leak to logs and upstream proxies; query strings are commonly logged, cached, and replayed.
- **Refs:** @/opt/p2p-file-share/metadata-api/server.js#147-165, @/opt/p2p-file-share/metadata-api/server.js#593-809.
- **Recommendation:** Move PIN verification to a POST body or header; scrub PIN from logs (custom morgan token) if query param must remain.

### Medium

3) **SSRF-style surface in `/api/status`**
- **Where:** `host` header and `x-forwarded-proto` are used to build `webUrl`, which is then fetched server-side.
- **Risk:** Host header spoofing can force server-side requests to internal IPs/domains if misrouted or if proxy headers are not sanitized.
- **Refs:** @/opt/p2p-file-share/metadata-api/server.js#221-240.
- **Recommendation:** Pin status targets to known hosts (env-configured allowlist), ignore user-provided host/proto.

4) **CSP allows `unsafe-inline`**
- **Where:** Nginx CSP for the main site.
- **Risk:** Inline scripts are allowed; if any XSS exists, CSP won’t mitigate.
- **Refs:** @/opt/p2p-file-share/nginx.conf#74-78.
- **Recommendation:** Remove `unsafe-inline` and rely on nonce or external scripts only (adjust app if needed).

5) **Missing explicit request body size limits**
- **Where:** `express.json()` defaults to 100kb; but no explicit limit or `type` is set.
- **Risk:** DoS via large JSON or non-JSON payloads; proxies may allow larger bodies.
- **Refs:** @/opt/p2p-file-share/metadata-api/server.js#147-165.
- **Recommendation:** Set explicit `express.json({ limit: '100kb' })` and `express.urlencoded({ limit: '100kb', extended: false })`, plus Nginx `client_max_body_size` for `/api/`.

### Low

6) **Security documentation inaccuracies**
- **Where:** `PROJECT_DOCUMENTATION/PRIVATE/SECURITY-PRIVACY-REPORT.md`.
- **Details:** Report states “No tracking” and that servers can’t see file names/sizes, but metadata API stores `file_name` and `file_size`, and Plausible is proxied.
- **Risk:** Compliance and trust issues rather than direct exploit.
- **Refs:** @/opt/p2p-file-share/PROJECT_DOCUMENTATION/PRIVATE/SECURITY-PRIVACY-REPORT.md#38-58.
- **Recommendation:** Update documentation to reflect actual metadata stored and analytics usage.

## Strengths (current mitigations)
- Rate limiting on `/api/` via `express-rate-limit`.
- PINs are hashed with bcrypt.
- TURN credentials are short-lived and generated server-side.
- TLS 1.2/1.3 enforced at Nginx.
- Docker isolation and separation of services.

## Recommendations Summary
1) **Sanitize share preview HTML** (escape filename/type) — *High*.
2) **Remove PIN from query strings** and scrub logs — *High*.
3) **Lock `/api/status` to allowlisted URLs only** — *Medium*.
4) **Tighten CSP (remove `unsafe-inline`)** — *Medium*.
5) **Explicit request size limits at API + Nginx** — *Medium*.
6) **Update security/privacy docs to match reality** — *Low*.

## Suggested Next Steps
- I can implement fixes #1–#5 in code and update docs (#6) in one pass, then run required dev/prod verification.
