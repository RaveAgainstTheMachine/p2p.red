# NAT Traversal Strategy (Desktop)

## Baseline
- ICE uses STUN + self-hosted TURN/UDP only (no application-level relays). 
- Prefer UDP; fall back to TCP/TLS only if ICE requires it.
- Do not relay file data through any server beyond TURN packet forwarding.

## Optional Acceleration
- NAT-PMP/UPnP port mapping attempted **only after explicit user consent**.
- Treat mappings as optimizations (faster host/srflx paths); never required for correctness.
- Single attempt per session; if blocked/fails, log once and continue with standard ICE.

## Diagnostics (Surface in UI)
- Candidate pair type: host / srflx / prflx / relay.
- Transport: udp / tcp / tls.
- RTT (ms) and active stream count.
- Backpressure state (bufferedAmount, disk write throughput).

## Security & Privacy
- No file data on signaling/TURN servers; end-to-end AES-GCM unchanged.
- Mapping attempts are opt-in and clearly messaged; no silent port changes.
- Keep logs minimal and local; no candidate details exfiltrated.

## Implementation Notes
- Keep existing ICE server list (STUN + self-hosted TURN/UDP) shared with web.
- Add optional NAT-PMP/UPnP helper to request mappings post-consent; proceed regardless of outcome.
- Continue emitting candidate diagnostics from getStats for UI and support.
