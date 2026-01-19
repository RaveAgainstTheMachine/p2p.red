# WireGuard SSH Bastion (bao) - Setup Summary

This document summarizes the current WireGuard + SSH bastion configuration.

## Topology

```
                 +---------------------------+
                 |        Your Laptop        |
                 |   WG Client: 10.88.0.2    |
                 +-------------+-------------+
                               |
                               | WG (UDP/51820)
                               v
+------------------------------+------------------------------+
|                        bao.p2p.red                          |
|                   WG Hub: 10.88.0.1                         |
|                SSH Bastion (ProxyJump)                      |
+-----------+------------------------+------------------------+
            |                        |                        |
            v                        v                        v
       prod.p2p.red              turn1.p2p.red           turn2.p2p.red
     WG: 10.88.0.10              WG: 10.88.0.11          WG: 10.88.0.12
            |
            v
        dev.p2p.red
      WG: 10.88.0.13
      LAN: 10.10.10.77
```

## WireGuard IPs

| Host         | WG IP       | Notes                          |
|--------------|-------------|--------------------------------|
| bao          | 10.88.0.1    | WG hub + SSH bastion           |
| laptop       | 10.88.0.2    | WG client                      |
| prod         | 10.88.0.10   | Ubuntu (SSH via WG only)       |
| turn1        | 10.88.0.11   | Debian (SSH via WG only)       |
| turn2        | 10.88.0.12   | Debian (SSH via WG only)       |
| dev          | 10.88.0.13   | LAN access kept: 10.10.10.0/24 |

## SSH Config (WG-only)

Use WG IPs and ProxyJump via bao:

```
Host bao
  HostName 10.88.0.1
  User debian
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host prod
  HostName 10.88.0.10
  User ubuntu
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host turn1
  HostName 10.88.0.11
  User root
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host turn2
  HostName 10.88.0.12
  User root
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host dev
  HostName 10.88.0.13
  User frosty
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa
```

## Firewall Rules (UFW)

- prod/turn1/turn2: allow SSH from WG subnet only.
- dev: allow SSH from WG subnet + LAN 10.10.10.0/24 + bao public IP (for WAN:2222 forward).

```
prod/turn1/turn2:
  22/tcp ALLOW 10.88.0.0/24

dev:
  22/tcp ALLOW 10.88.0.0/24
  22/tcp ALLOW 10.10.10.0/24
  22/tcp ALLOW 158.69.194.253
```

## WireGuard Healthcheck (bao)

- Timer: `wg-healthcheck.timer` (runs every minute)
- Script: `/usr/local/sbin/wg-healthcheck.sh`
- Behavior: restarts `wg-quick@wg0` if no handshake in 180s.

Check status:
```
systemctl status wg-healthcheck.timer
systemctl status wg-healthcheck.service
```

## Notes

- WG clients exist on all hosts; SSH now restricted to WG subnet.
- dev LAN access is preserved.
- No SSH lockdown changes should be made without verified WG connectivity.
