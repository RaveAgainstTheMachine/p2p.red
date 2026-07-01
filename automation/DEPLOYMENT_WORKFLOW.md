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

## 3. Transfer Images and Code to Prod (Local Dev)
Copy the image tars to the production VPS `/tmp` directory, and sync the codebase.
```bash
# Sync repository code (docker-compose, scripts, sql init)
./automation/sync-to-vps.sh

# Transfer built images
scp -i ~/.ssh/p2p_deploy \
  -o "ProxyCommand=ssh -i ~/.ssh/p2p_dev_key -W %h:%p debian@<ip>" \
  ./images/*.tar ubuntu@<ip>:/tmp/
```

## 4. Deploy on Production Host (Prod VPS)
SSH to the production host and run the deployment logic.

### A) Zero-Downtime Release
Always use `sudo -E` to preserve the `ENVOY_RUNTIME_DIR` environment variable.
```bash
cd /opt/p2p-file-share
sudo -E \
  DEPLOY_ENV=prod \
  METADATA_API_ENV_FILE=/run/secrets/metadata.env \
  ./automation/release-prod.sh
```

## 🛠️ Safety Guardrails
- **Project Consistency**: Always run release scripts from `/opt/p2p-file-share` to maintain the correct Docker Compose project context.
- **Preflight Enforcement**: `automation/preflight.sh` will block deployments if the environment marker `/etc/p2pred-env` is missing or incorrect.
- **Image Retention**: `automation/cleanup-images.sh` runs automatically after deploy to keep only the current and one previous version.
- **TLS Hook Integrity**: Periodically verify that `/etc/letsencrypt/renewal/*.conf` contains the `deploy_hook` pointing to `automation/renew-certs-hook.sh`.
- **Runtime Persistence**: Always explicitly set `app_blue` and `app_green` weights in the runtime directory. Never rely on Envoy's 50/50 default split.
