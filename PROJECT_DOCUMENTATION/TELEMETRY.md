# Telemetry (Internal)

Privacy-safe transfer telemetry for p2p.red. No file data or peer IDs are stored.

## Core Principles
- No file contents or metadata (filenames, sizes, peer IDs, IPs).
- Redact URLs, share keys, PINs, and peer IDs in payloads.
- Short retention in Redis (default 7 days).
- Daily event cap to limit volume (default 10k).

## Endpoint
- `POST /api/telemetry/transfer`
- Service: metadata-api

### Payload (fields are optional unless noted)
- `eventType` **(required)**: e.g. `peer_error`, `peer_disconnected`, `transfer_error`
- `role`: `sender` | `receiver` | `client`
- `sessionId`: random UUID (client session)
- `buildVersion`: `VITE_BUILD_VERSION`
- `buildVariant`: `VITE_BUILD_VARIANT`
- `errorCode`: short error category
- `errorMessage`: sanitized error message
- `connectionType`: `signaling` | `direct` | `relay`
- `stage`: `signal` | `transfer` | `stream`
- `browser`: coarse label (Chrome/Firefox/Edge/Safari/Other)
- `os`: coarse label (Windows/macOS/Linux/Android/iOS)
- `timestamp`: ISO string

## Redis Storage
Keys:
- Daily counter: `telemetry:transfer:count:YYYYMMDD`
- Daily list: `telemetry:transfer:YYYYMMDD`

Retention:
- List TTL: `TELEMETRY_RETENTION_DAYS` (default 7)
- Counter TTL: 48h

## Environment Variables
- `TELEMETRY_RETENTION_DAYS` (default `7`)
- `TELEMETRY_DAILY_LIMIT` (default `10000`)

## Verification
- Send a test event:
  ```bash
  curl -sS -X POST https://p2p.red/api/telemetry/transfer \
    -H 'Content-Type: application/json' \
    -d '{"eventType":"transfer_error","role":"sender","errorCode":"manual_test"}'
  ```

## Management UI (planned scope)
- Logs dashboard: filter by time range, eventType, role, errorCode, connectionType.
- Uptime/health: surface `/api/status` data with last-checked timestamp.
- Ops controls (guarded): enable/disable request logging or telemetry ingestion.
- Blue/green visibility: show active color (read-only).
- Access control: admin-only, no public access.
