# P2P File Share - Architecture Overview

This document outlines the high-level architecture of the P2P File Share application. The design is optimized for end-to-end encryption, browser-to-browser direct transfer, and metadata security.

## Conceptual Architecture

The application relies on three primary components:

1. **Client Browser (Sender/Receiver)**: Executes all cryptography (AES-GCM) locally and performs browser-to-browser data transfer using WebRTC DataChannels.
2. **Signaling Server**: Facilitates initial WebRTC handshakes (session description protocol exchange and ICE candidate discovery). Once a connection is established, the signaling server is no longer involved in the data path.
3. **Metadata API**: Manages short-lived metadata mappings (Base62 encoded short links) to broker the initial peer ID exchange between the sender and receiver.

```
┌──────────────┐                               ┌──────────────┐
│    Sender    │       1. Share Link Info      │   Receiver   │
│   Browser    ├──────────────────────────────>│   Browser    │
└──────┬───────┘                               └──────┬───────┘
       │                                              │
       │ 2. Register                                  │ 3. Fetch
       │    Metadata                                  │    Metadata
       ▼                                              ▼
┌──────────────┐                               ┌──────────────┐
│  Connection  │                               │  Connection  │
│  Broker API  │                               │  Connection  │
└──────────────┘                               └──────────────┘
       │                                              │
       │ 4. Signal Handshake                          │ 4. Signal Handshake
       └──────────────────► ┌──────────┐ ◄────────────┘
                            │ Signaling│
                            │  Server  │
                            └──────────┘
                                 │
                                 ▼
                     ┌───────────────────────┐
                     │ 5. WebRTC DataChannel │
                     │   (Direct P2P Link)   │
                     └───────────────────────┘
```

## Security & Encryption Model

- **Zero Server Storage**: File payloads are never sent to, processed by, or stored on any server.
- **End-to-End Encryption**: All data is encrypted in the sender's browser using AES-GCM (256-bit key generated locally via Web Crypto API) before transmission. The key is included in the URL hash fragment (e.g., `#<key>`) which is never transmitted to the web server.
- **Data Channel Auditing**: WebRTC connection parameters are negotiated directly using standard secure protocols (DTLS-SRTP).
