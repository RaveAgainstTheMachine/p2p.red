# Testing

## Overview
This project uses Vitest for unit/component tests and Playwright for end-to-end tests.

## Commands
- Unit tests: `npm run test:unit`
- Unit tests (watch): `npm run test:unit:watch`
- E2E tests: `npm run test:e2e`
- Full suite: `npm test`
- Terminal UI: `npm run test:tui`

## Notes
- Playwright will start the Vite dev server on port 5180 (or reuse it if already running).
- For headless CI, use the default `npm run test:e2e` command.
- Test TUI runs lint → type-check → unit+E2E → metadata API tests with live logs.
- TUI controls: `a` (all), `1` (lint), `2` (type-check), `3` (unit), `4` (e2e), `5` (metadata), `s` (local-prod up), `p` (local-prod preflight), `d` (local-prod down), `q` (quit).
- Local-prod stack: `docker compose -f docker-compose.local-prod.yml up -d`.
- Local-prod preflight: `INSECURE=1 LOCAL_P2P_HOST=127.0.0.1 LOCAL_HTTPS_PORT=8443 ./automation/local-prod-preflight.sh`.
