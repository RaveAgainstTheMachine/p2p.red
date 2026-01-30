---
description: Copies latest Docker images to production server
---
scp -i /home/frosty/.ssh/p2p_deploy -o "ProxyCommand=ssh -i /home/frosty/.ssh/p2p_dev_key -W %h:%p debian@10.88.0.1" /opt/p2p-file-share/images/*.tar ubuntu@10.88.0.10:/tmp/