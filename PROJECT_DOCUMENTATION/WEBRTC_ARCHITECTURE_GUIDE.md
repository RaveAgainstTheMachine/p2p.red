# WebRTC DataChannel Architecture

This guide details the implementation of browser-to-browser P2P file sharing using WebRTC DataChannels. The architecture is designed for high-performance transfers with end-to-end encryption.

## Principles of Operation

### 1. Decentralized Data Transfer
The primary goal is to facilitate direct data movement between peers. File data never transits through the signaling or metadata servers, ensuring maximum privacy and reduced infrastructure costs.

### 2. End-to-End Encryption (E2EE)
All data is encrypted client-side using the AES-GCM (Advanced Encryption Standard with Galois/Counter Mode) via the browser-native Web Crypto API. Encryption keys are generated locally and are never shared with any server.

### 3. Progressive Streaming
By utilizing the File System Access API and high-performance DataChannel streams, the system can transfer large files (multi-gigabyte) without loading the entire content into browser memory.

## Technical Components

### Signaling Layer
The signaling layer is responsible for coordinating the initial handshake (SDP exchange) and ICE candidate gathering. It does not touch the payload data.
- **Protocol**: WebSockets
- **State**: Ephemeral

### Connectivity Layer (STUN/TURN)
NAT traversal is managed by the ICE (Interactive Connectivity Establishment) framework.
- **STUN**: Used to discover public IP addresses and port mappings for direct P2P connections.
- **TURN**: Used as a fallback relay when a direct connection is prohibited by symmetric NATs or restrictive firewalls.

## Performance Characteristics

### Throughput
Transfer speeds are primarily governed by the upload bandwidth of the sending peer and the disk I/O of both participants. WebRTC overhead is minimal (~3-5%).

### Success Rates
- **Direct P2P (STUN)**: Typically achieves 70-80% success in residential networks.
- **Relayed (TURN)**: Increases success rate to 95%+ by providing a fallback path for restrictive environments.

## Implementation Details

### Encryption Workflow
1.  **Key Generation**: Sender generates a random 256-bit AES key.
2.  **IV Generation**: A unique 12-byte initialization vector (IV) is generated for each chunk.
3.  **Transmission**: Data is encrypted and sent over the DataChannel.
4.  **Decryption**: The receiver uses the shared key (passed via the URL fragment) to decrypt the stream.

### Chunking Strategy
To optimize throughput and avoid buffer overflows, data is split into manageable chunks (e.g., 16KB to 64KB). Flow control is implemented to pause transmission if the DataChannel's `bufferedAmount` exceeds a specified threshold.

## Security Considerations

- **Server Blindness**: The server infrastructure is blind to the content and metadata of the files being shared.
- **Ephemeral Keys**: Encryption keys are stored in the URL fragment (`#`), which is not transmitted to the server by the browser.
- **UDP Transport**: WebRTC utilizes SCTP over DTLS (over UDP), providing built-in security and reliability at the transport layer.
