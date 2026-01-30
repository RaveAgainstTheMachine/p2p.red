# Admin Dashboard (Scope)

Internal admin dashboard for p2p.red operations. Same stack (React + metadata-api). OpenBao-backed admin login.

## Goals
- Centralized view of telemetry, logs, and uptime.
- Minimal operational controls (safe toggles only).
- No exposure of file contents, peer IDs, IPs, or user-identifiable data.

## Access Control
- **Auth source:** OpenBao (AppRole or userpass policy scoped to admin).
- **Session:** short-lived JWT (signed by metadata-api) or encrypted session cookie.
- **Network:** admin route only (no public access).

## UI Areas
1. **Overview**
   - Service status summary (web, signal, api, analytics, databases, secrets).
   - Active blue/green color.
   - Last deploy timestamp + build version/variant.

2. **Telemetry Charts**
   - Daily event volume (7-day window).
   - Event breakdown by `eventType`, `role`, `connectionType`, `stage`.
   - Error trends (top errorCode/message, sanitized).

3. **Logs**
   - Filtered telemetry event table.
   - Filters: time range, eventType, role, connectionType, stage, errorCode.
   - Export: JSON/CSV (sanitized fields only).

4. **Ops Controls (guarded)**
   - Toggle telemetry ingestion on/off.
   - Toggle metadata request logging on/off.
   - Read-only: link retention + daily cap values.

## Backend (metadata-api)
- **New routes (admin-only):**
  - `POST /api/admin/login` (OpenBao auth)
  - `GET /api/admin/status` (wrap `/api/status`)
  - `GET /api/admin/telemetry/summary?range=7d`
  - `GET /api/admin/telemetry/events?start=...&end=...`
  - `POST /api/admin/telemetry/toggle` (enable/disable)
  - `POST /api/admin/logging/toggle` (enable/disable request logging)

## Data Sources
- Redis telemetry lists + counters (existing).
- `/api/status` for uptime.
- Envoy runtime weights for blue/green status.

## Non-Goals
- User accounts.
- File content access.
- Cross-tenant reporting (single service only).
