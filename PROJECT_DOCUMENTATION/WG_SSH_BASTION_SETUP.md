# WireGuard SSH Bastion (bao) - Setup Summary

This document summarizes the current WireGuard + SSH bastion configuration.

## Topology

```
                 +---------------------------+
                 |        Your Laptop        |
                 |   WG Client: <ip>    |
                 +-------------+-------------+
                               |
                               | WG (UDP/51820)
                               v
+------------------------------+------------------------------+
|                        <bao-domain>                          |
|                   WG Hub: <ip>                         |
|                SSH Bastion (ProxyJump)                      |
+-----------+------------------------+------------------------+
            |                        |                        |
            v                        v                        v
       prod.<domain>              <turn1-domain>           <turn2-domain>
     WG: <ip>              WG: <ip>          WG: <ip>
            |
            v
        <dev-domain>
      WG: <ip>
      LAN: <ip>
```

## WireGuard IPs

| Host         | WG IP       | Notes                          |
|--------------|-------------|--------------------------------|
| bao          | <ip>    | WG hub + SSH bastion           |
| laptop       | <ip>    | WG client                      |
| prod         | <ip>   | Ubuntu (SSH via WG only)       |
| turn1        | <ip>   | Debian (SSH via WG only)       |
| turn2        | <ip>   | Debian (SSH via WG only)       |
| dev          | <ip>   | LAN access kept: <ip>/24 |

## SSH Config (WG-only)

Use WG IPs and ProxyJump via bao:

```
Host bao
  HostName <ip>
  User debian
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host prod
  HostName <ip>
  User ubuntu
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host turn1
  HostName <ip>
  User root
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host turn2
  HostName <ip>
  User root
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa

Host dev
  HostName <ip>
  User frosty
  ProxyJump bao
  IdentityFile /home/frosty/.ssh/id_ecdsa
```

## Firewall Rules (UFW)

- prod/turn1/turn2: allow SSH from WG subnet only.
- dev: allow SSH from WG subnet + LAN <ip>/24 + bao public IP (for WAN:2222 forward).

```
prod/turn1/turn2:
  22/tcp ALLOW <ip>/24

dev:
  22/tcp ALLOW <ip>/24
  22/tcp ALLOW <ip>/24
  22/tcp ALLOW <ip>
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
