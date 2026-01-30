---
description: Pre-release validation for production deployment
---
ssh -i /home/frosty/.ssh/p2p_deploy -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" ubuntu@10.88.0.10 "cd /opt/p2p-file-share && DEPLOY_ENV=prod ./automation/preflight.sh prod"