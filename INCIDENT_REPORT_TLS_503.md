# 🚨 Incident Report: TLS Expiry & 503 Service Unavailable

## 📋 Status: RESTORED
- **Domain**: p2p.red (UP)
- **Certs**: Valid (RSA, 2048-bit)
- **Renewal**: Automated via Crontab + Post-hook

---

## 🔍 Root Cause Analysis (RCA)

1.  **TLS Expiry**: Automated renewal was not configured. Manual renewal failed initially due to ECDSA default (Envoy config expected RSA PKCS12).
2.  **503 Error**:
    *   **Layered Runtime Failure**: Envoy in Snap Docker failed to resolve symlinks in `/etc/letsencrypt`.
    *   **Configuration Bug**: A `sed` command intended to flip traffic weights accidentally changed `total_weight: 100` to `total_weight: 0`, causing Envoy to reject all traffic to healthy upstreams.
3.  **Process Failure**: Failed to consult `VPS_DEPLOYMENT_GUIDE.md` early, leading to "generic" fixes that broke repo-specific patterns (PKCS12 + Snap paths).

---

## 🛠️ Actions Taken

- **Restoration**: 
  - Reissued RSA certificates.
  - Converted PEM to PKCS12 with password `p2pred`.
  - Fixed `envoy.yaml` weight logic and runtime paths.
  - Forced runtime weights via Admin API (`runtime_modify`).
- **Automation**: 
  - Created `/opt/p2p-file-share/automation/renew-certs-hook.sh`.
  - Added daily crontab for root with `--post-hook` for auto-conversion/reload.

---

## 🛡️ Prevention Plan (Never Again)

1.  **Documentation Enforcement**: 
    - At start of any production task, **MUST** read `PROJECT_DOCUMENTATION/VPS_DEPLOYMENT_GUIDE.md` and `BUILD_DEPLOY.md`.
2.  **Safe Configuration Management**: 
    - Ban complex `sed` for YAML edits. Use full block replacements.
    - Validate `total_weight` and `lb_endpoints` after every edit.
3.  **Observability First**: 
    - Use Envoy Admin API (`/stats`, `/clusters`, `/runtime`) to diagnose routing BEFORE restarting containers.
4.  **Verification Loop**: 
    - Always verify via `curl -Ik` (headers) and `od -c` (body) to confirm 200 OK vs 503 "no healthy upstream".
