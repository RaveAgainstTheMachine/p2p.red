# Incident Report: 2026-05-11 - "No Healthy Upstream" (Production Down)

## Summary
On 2026-05-11, the production site `p2p.red` was reported down with a "No Healthy Upstream" error. Investigation revealed that the Envoy proxy had restarted and loaded a stale traffic split configuration from disk, pointing 100% of traffic to the `blue` environment which was not running.

## Timeline
- **07:27 UTC**: User reports site is down.
- **07:28 UTC**: Investigation starts. Envoy found to be up for 7 hours, but clusters empty for the active weight.
- **07:28 UTC**: Envoy runtime weights checked: `blue=100`, `green=0`. `p2p-app-green` was the only running app container.
- **07:29 UTC**: Traffic manually shifted to `green=100`. Site restored (HTTP 200).
- **07:30 UTC**: Root cause identified as "Two Sources of Truth" in automation scripts.
- **07:32 UTC**: Automation scripts hardened and deployed to VPS.
- **13:13 UTC**: P2P Health Sentinel deployed to `bao` for Discord alerting.

## Root Cause
The `automation/envoy-shift-traffic.sh` script was updating the live Snap Docker runtime path but failing to sync those changes back to the repository path (`/opt/p2p-file-share/envoy-runtime`). 

When `renew-certs-hook.sh` ran (or any other process that triggered an Envoy restart or runtime restore), it read from the repository path, which still contained the default `blue=100` weights. This forced Envoy to look for the `blue` environment even when `green` was the intended live target.

Additionally, `automation/release-prod.sh` was blindly overwriting the Snap runtime path with repository defaults on every run, creating a race condition for the next restart.

## Resolution
1.  **Manual Recovery**: Used `envoy-shift-traffic.sh` with explicit `ENVOY_RUNTIME_DIR` to restore traffic to `green`.
2.  **Script Hardening**:
    *   `envoy-shift-traffic.sh`: Now updates BOTH the live runtime path and the repository path to ensure consistency.
    *   `renew-certs-hook.sh`: Now prioritizes the live Snap runtime path over repository defaults when restoring state.
    *   `release-prod.sh`: Now uses `cp -rn` to avoid overwriting existing live weights with repository templates during deployment.
3.  **Monitoring**: Deployed `health-sentinel.sh` to `bao` to monitor `p2p.red` availability and notify Discord on failure.

## Prevention
- Automation scripts now maintain dual-path consistency.
- `release-prod.sh` is now non-destructive for runtime state.
- **P2P Health Sentinel** provides real-time alerts for site health degradation.
- Documentation updated to reflect the importance of `ENVOY_RUNTIME_DIR` consistency.

## Status
**Resolved**. v1.6.8 released with automation fixes and monitoring sentinel.
