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
- TUI controls: `a` (all), `1` (lint), `2` (type-check), `3` (unit), `4` (e2e), `5` (metadata), `s` (services up), `d` (services down), `q` (quit).
- Local E2E services: `docker compose -f docker-compose.e2e.yml up -d --build` (Postgres, Redis, metadata API, PeerJS).
