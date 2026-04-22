# Development Stabilization & Infrastructure Setup

This document outlines the infrastructure changes and procedures implemented to stabilize the development environment and ensure reliable signaling and UI functionality.

## 1. Signaling Infrastructure (PeerJS)

To mirror the production environment and bypass connectivity issues (like CORS or IPv6 refusal), signaling is routed through a Vite proxy.

### Setup Procedure
- **Signaling Server**: The `p2p-peerjs` container must be running and exposed on host port `9000`.
- **Vite Proxy**: Configured in `vite.config.ts` to map `/peerjs` requests to `http://127.0.0.1:9000`.
- **Port Alignment**: The dev server is standardized to port `3002`. This is configured in `.env.local`, `vite.config.ts`, and `src/config/environments.ts`.

### Configuration (src/config/environments.ts)
```typescript
development: {
  peerJsConfig: {
    host: import.meta.env.VITE_PEERJS_HOST ?? 'localhost',
    port: Number(import.meta.env.VITE_PEERJS_PORT ?? 3002), // Points to Vite port
    path: import.meta.env.VITE_PEERJS_PATH ?? '/',          // Root path handled by proxy
    secure: false
  }
}
```

## 2. Global Interaction Mechanics

### Click-to-Pick (File Selection)
- **Implementation**: The background file picker is triggered via a global click listener on the `main` container.
- **Trigger**: `globalFileInputRef.current?.click()`.
- **Input Visibility**: The file input uses the `sr-only` class to remain accessible and functional without taking up layout space.
- **Race Condition Protection**: `handleGlobalInputChange` captures files into a static array using `Array.from()` immediately upon selection. This prevents the `FileList` (a live object) from being cleared by the browser when `input.value = ''` is called.

## 3. Light Mode Visibility
- Missing color overrides for `text-white/` utility classes have been added to `index.css` under the `html[data-theme='light']` selector.
- Headline contrast increased to `rgba(0, 0, 0, 0.6)` with `filter: none` to remove bluring drop-shadows on white backgrounds.

## 4. Production Impact Assessment
- **Zero Adverse Effect**: All infrastructure-specific port changes (3002, 9000) are isolated to the `development` environment configuration.
- **Production Gains**: The `handleGlobalInputChange` fix and `index.css` contrast improvements directly benefit the production build's robustness and accessibility.
- **Proxy Consistency**: Using a proxy in dev ensures that PeerJS handshakes are tested in a multi-hop scenario similar to the production reverse-proxy (Caddy/Nginx) setup.

## 5. Dev Testing Checklist
1. Ensure Docker stack is up: `docker-compose up -d`.
2. Run dev server: `npm run dev` (Check `vite.log` for port 3002).
3. Verify signaling: Check console for `✅ Peer connected with ID`.
4. Test Picker: Click the background and select a file. Verify UI loads the file card.
5. Test Drop: Drag and drop a file anywhere. Verify UI loads the file card.
