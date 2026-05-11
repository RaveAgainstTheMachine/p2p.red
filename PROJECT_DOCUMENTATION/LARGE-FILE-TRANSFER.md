# Robust P2P File Transfer Implementation

This document details the technical strategies employed to ensure reliable, high-performance file transfers over WebRTC DataChannels, specifically addressing large files and varying network conditions.

## 1. Transmission Strategy

### Chunking and Payload Optimization
To maximize throughput while maintaining control over the network stack, data is serialized into **64KB chunks**. This size balances overhead with reliability, fitting within most browser-level UDP buffers.

### Adaptive Backpressure
Network congestion is managed through an adaptive backpressure algorithm that monitors the effective transfer rate and adjusts the inter-chunk delay.
- **High-Speed (> 1MB/s)**: 5ms delay every 20 chunks.
- **Medium-Speed (100KB/s - 1MB/s)**: 20ms delay every 20 chunks.
- **Low-Speed (< 100KB/s)**: 50ms delay every 20 chunks.

## 2. Reliability Mechanisms

### Chunk-Level Retries
The system implements a transparent retry mechanism for individual chunks. If a `send()` operation fails due to buffer saturation or temporary connection instability, the system performs up to 3 exponential backoff retries before entering a suspended state.

### State Persistence and Resume
Transfer state is persisted to `sessionStorage` every 100 chunks. This metadata includes:
- `transferId` (UUID)
- `chunkIndex` (Current progress)
- `totalChunks`
- `encryptionIv`

In the event of a catastrophic connection failure (e.g., page refresh or socket closure), the system can reconstruct the transfer state from storage and resume from the last known checkpoint.

### Integrity Verification
Upon completion, the receiver performs a missing-chunk audit. If gaps are detected in the sequential indices, a `RESUME_REQUEST` is issued to the sender specifically for the missing segments, ensuring 100% data integrity before file reconstruction.

## 3. Streaming and Memory Management

### Browser Storage APIs
To handle multi-gigabyte transfers, the implementation utilizes the **File System Access API** (where available) to stream incoming chunks directly to the host filesystem. For browsers without persistent stream support, chunks are accumulated in a `Blob` structure to prevent excessive heap allocation.

### Folder Archiving
For folder transfers, the system employs a client-side streaming ZIP implementation. Files are compressed and encapsulated into the transfer stream on-the-fly, allowing large directories to be shared without requiring a temporary server-side archive.

## 4. Performance Monitoring

Active transfers are monitored for "stall" conditions. If no data is received within a 30-second window, the connection is flagged as unhealthy, triggering an automatic reconnection attempt while preserving the transfer state.

## 5. Security Guardrails

All transfer logic operates within the browser's sandbox. The use of AES-GCM for all payloads ensures that even if a chunk is intercepted or replayed, it cannot be decrypted without the ephemeral key held only by the participating peers.
