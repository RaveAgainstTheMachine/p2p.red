# 🚀 Production Deployment Workflow

Follow this workflow to release changes to production safely. **Do not run production release scripts on a dev host.**

## 1. Prepare Version (Local Dev)
Bump the version in `package.json` according to SemVer rules.
```bash
# Example: 1.3.8 -> 1.3.9
vi package.json
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
sudo mv /tmp/*.tar /opt/p2p-file-share/images/
sudo docker load -i /opt/p2p-file-share/images/app-blue.tar
sudo docker load -i /opt/p2p-file-share/images/app-green.tar
sudo docker load -i /opt/p2p-file-share/images/metadata-api.tar
sudo docker load -i /opt/p2p-file-share/images/peerjs.tar
sudo docker load -i /opt/p2p-file-share/images/envoy.tar
```

### B) Update Shared Services
```bash
cd /opt/p2p-file-share
sudo METADATA_API_ENV_FILE=/run/secrets/metadata.env docker compose -f docker-compose.yml up -d
```

### C) Zero-Downtime App Switch
Run the release script which will detect the inactive color, start it, health check it, and shift traffic via Envoy.
```bash
# Authoritative switch
DEPLOY_ENV=prod USE_PREBUILT_IMAGES=1 ./automation/release-prod.sh
```

## 🛠️ Safety Guardrails
- **Preflight Enforcement**: `automation/preflight.sh` will block deployments if the environment marker `/etc/p2pred-env` is missing or incorrect.
- **Image Retention**: `automation/cleanup-images.sh` runs automatically after deploy to keep only the current and one previous version of each service.
- **No Source on Prod**: Prod host only contains orchestration files (`docker-compose.yml`, `envoy.yaml`) and image tars. No source code or build tools.
