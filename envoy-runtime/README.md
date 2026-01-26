# Envoy Runtime Defaults

This directory provides persistent runtime defaults for Envoy traffic split weights.

## Purpose
- Ensure Envoy always has valid `traffic_split` weights on startup.
- Prevent "no healthy upstream" caused by missing runtime values.

## Files
- `traffic_split/app_blue`: weight for the blue app cluster.
- `traffic_split/app_green`: weight for the green app cluster.

## Notes
- `automation/envoy-shift-traffic.sh` updates these values when switching traffic.
- Envoy loads these values from `/etc/envoy/runtime` (mounted from this directory).
