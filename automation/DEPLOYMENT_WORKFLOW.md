# 🚀 Production Deployment Workflow

Follow this workflow to release changes to production safely. **Do not run production release scripts on a dev host.**

## 1. Prepare Version (Local Dev)
- Bump the version in `package.json` according to SemVer rules.
- Update `src/data/changelog.ts` with the new version, date, and user-facing changes.
```bash
# Example: 1.3.14 -> 1.3.15
vi package.json
vi src/data/changelog.ts
```

## 2. Build Production Images (Local Dev)
This script builds all services, tags them, and saves them as `.tar` files in the `images/` directory.
```bash
./automation/build-prod-images.sh
```
**Output:** `images/app-blue.tar`, `images/app-green.tar`, `images/metadata-api.tar`, etc.

## 3. Transfer Images to Prod (Local Dev)
Copy the image tars to the production VPS `/tmp` directory.
```bash
scp -i ~/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i ~/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" \
  ./images/*.tar ubuntu@10.88.0.10:/tmp/
```

## 4. Deploy on Production Host (Prod VPS)
SSH to the production host and run the deployment logic.

### A) Move and Load Images
```bash
# Move to canonical storage
sudo mkdir -p /opt/p2p-file-share/images
sudo mv /tmp/*.tar /opt/p2p-file-share/images/

# Load all images
for f in /opt/p2p-file-share/images/*.tar; do sudo docker load -i $f; done
```

### B) Sync Runtime Configuration (Snap Requirement)
Ubuntu Core uses the **Snap version of Docker**. To avoid "read-only file system" errors during mounts, runtime configs MUST be copied to the Snap-accessible directory.
```bash
sudo mkdir -p /var/snap/docker/common/p2p-file-share/envoy-runtime
sudo cp -r /opt/p2p-file-share/envoy-runtime/* /var/snap/docker/common/p2p-file-share/envoy-runtime/
```

### C) Zero-Downtime Release
Always use `sudo -E` to preserve the `ENVOY_RUNTIME_DIR` environment variable.
```bash
cd /opt/p2p-file-share
sudo -E \
  DEPLOY_ENV=prod \
  ENVOY_RUNTIME_DIR=/var/snap/docker/common/p2p-file-share/envoy-runtime \
  METADATA_API_ENV_FILE=/run/secrets/metadata.env \
  ./automation/release-prod.sh
```

## 🛠️ Safety Guardrails
- **Snap Confinement**: Do NOT attempt to mount volumes directly from `/opt` on the VPS. Always sync to `/var/snap/docker/common/`.
- **Project Consistency**: Always run release scripts from `/opt/p2p-file-share` to maintain the correct Docker Compose project context.
- **Preflight Enforcement**: `automation/preflight.sh` will block deployments if the environment marker `/etc/p2pred-env` is missing or incorrect.
- **Image Retention**: `automation/cleanup-images.sh` runs automatically after deploy to keep only the current and one previous version.
- **TLS Hook Integrity**: Periodically verify that `/etc/letsencrypt/renewal/*.conf` contains the `deploy_hook` pointing to `automation/renew-certs-hook.sh`.
- **Runtime Persistence**: Always explicitly set `app_blue` and `app_green` weights in the runtime directory. Never rely on Envoy's 50/50 default split.
