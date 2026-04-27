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
    
---

## 🚨 Incident: 2026-04-27 - Envoy Crash Loop & 503 Re-emergence

### 📋 Status: RESOLVED
* **Issue**: Site unreachable (SSL Reset) followed by 503 Service Unavailable.
* **Resolution**: Hardened renewal hook, linked to Certbot, and locked runtime traffic to Blue.

### 🔍 RCA (Root Cause Analysis)
1. **Broken TLS Chain**: Certificates renewed on Apr 26, but `deploy_hook` was missing from Certbot configs. Envoy was running on stale certs until a container restart triggered a fatal "Failed to load certificate chain" error.
2. **Runtime Default (50/50)**: Envoy's runtime layer was empty/uninitialized. On restart, it defaulted to 50/50 traffic. Since `app_green` was exited, users experienced 50% failure rate.

### 🛠️ Actions Taken
1. **Emergency Restoration**: Generated self-signed `.p12` files to break the Envoy crash loop.
2. **Hardened Hook**: Updated `automation/renew-certs-hook.sh` with post-restart health checks (`curl -k`) and **dynamic weight restoration**.
3. **Linked Certbot**: Manually added `deploy_hook` to `/etc/letsencrypt/renewal/*.conf` for all active domains.
4. **Traffic Lock**: Flipped traffic to 100% Blue via Admin API and ensured weights are persisted in the runtime files for the hook to read.

### 🛡️ Prevention
1. **Verification Gated Renewal**: The renewal script now fails if HTTPS health checks don't pass after a restart.
2. **Explicit Persistence**: The hook reads `/opt/p2p-file-share/envoy-runtime/` to re-apply the current Blue/Green split via the Admin API on every renewal, preventing Envoy's 50/50 fallback.
