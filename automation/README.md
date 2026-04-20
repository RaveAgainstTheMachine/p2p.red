# Automation

## Overview
Automation helpers for deploys and public-repo sync/redaction.

## Scripts
## 🚀 Deployment (Authoritative)
**[Read DEPLOYMENT_WORKFLOW.md](./DEPLOYMENT_WORKFLOW.md) before deploying.**

### Full Deploy (Local Dev -> Prod VPS)
1. **Build images locally**: `./automation/build-prod-images.sh`
2. **Transfer to prod**: `scp images/*.tar prod-vps:/tmp/`
3. **Deploy on prod**: SSH to vps and run `./automation/release-prod.sh`
**Requires:**
- `metadata-api/.env`
- `turnserver.conf`

**Options:**
- `DEPLOY_ENV=dev|prod` (default: prod)
- `SITE_URL=https://<domain>` (overrides build verification URL)
- `METADATA_HEALTH_URL=http://localhost:3001/health`

### Deploy + Health Checks
```bash
chmod +x automation/deploy-and-test.sh
./automation/deploy-and-test.sh
```
Runs `deploy-all` and verifies:
- Site URL responds
- Metadata API health endpoint responds
- Envoy + PeerJS containers are up

Dev note:
- When `DEPLOY_ENV=dev`, scripts mount `envoy.dev.yaml` (HTTP-only) via `ENVOY_CONFIG` for local testing.

### Public Repo Sync + Redaction
```bash
chmod +x automation/public-sync.sh
PUBLIC_REPO=/path/to/public-repo ./automation/public-sync.sh
```
**Notes:**
- Excludes private docs/secrets.
- Redacts domains/IPs/emails in docs and configs copied to the public repo.
- Dry run (no changes):
  ```bash
  PUBLIC_SYNC_DRY_RUN=1 PUBLIC_REPO=/path/to/public-repo ./automation/public-sync.sh
  ```

## Makefile Targets
```bash
make deploy-all
make deploy-and-test
make public-sync PUBLIC_REPO=/path/to/public-repo
```
