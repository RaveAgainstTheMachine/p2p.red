# Memory-Efficient P2P Streaming

This document outlines the architectural patterns used to achieve unlimited file size support with constant memory overhead during peer-to-peer transfers.

## The Memory Bottleneck

Standard browser-based file transfers often suffer from linear memory growth, where the receiver must buffer the entire file in RAM before triggering a download. For files exceeding 1-2GB, this frequently results in tab crashes or system instability.

## Streaming Direct-to-Disk

To eliminate this bottleneck, P2P File Share implements a "Streaming Direct-to-Disk" pattern using the **File System Access API**.

### Pattern Workflow

1.  **Capability Detection**: Upon initiating a transfer, the client detects support for `showSaveFilePicker`.
2.  **Pre-Allocation**: For files exceeding a specific threshold (e.g., 100MB), the user is prompted to select a destination on the local filesystem before the transfer begins.
3.  **Writable Stream**: The system opens a `FileSystemWritableFileStream`.
4.  **Chunk Processing**: As each 64KB chunk arrives via the WebRTC DataChannel, it is immediately written to the stream.
5.  **Garbage Collection**: Once a chunk is written, it is discarded from browser memory, maintaining a constant heap profile regardless of total file size.

### Memory Profile Comparison

| Methodology | Memory Complexity | 5GB Transfer Profile |
| :--- | :--- | :--- |
| **Traditional Blob** | O(n) - Linear | ❌ 5GB+ RAM (Crash) |
| **Streaming Write** | O(1) - Constant | ✅ ~64KB RAM (Stable) |

## Cross-Browser Fallbacks

In environments where the File System Access API is unavailable (e.g., Firefox, Safari), the system employs secondary strategies to mitigate memory pressure:

### IndexedDB Sharding
Chunks are stored in a transient **IndexedDB** object store rather than the main JS heap. While this still utilizes disk space, it prevents the browser's memory manager from terminating the process due to excessive RAM usage.

### Service Worker Download Bridge
The system utilizes a Service Worker to intercept a fetch request and stream the contents from IndexedDB or memory directly to the browser's download manager, allowing the browser to handle the final file reconstruction.

## Performance Considerations

- **Write Latency**: Direct-to-disk writing introduces a small overhead (typically <5ms per chunk). The adaptive backpressure mechanism accounts for this latency to prevent the DataChannel buffer from overflowing.
- **Disk Throughput**: The system is capable of saturating standard SSD write speeds, ensuring that the disk is rarely the bottleneck for typical internet-based P2P transfers.

## Security Controls

- **User Consent**: Streaming writes require explicit user permission via a file picker dialog. The application cannot write to the filesystem without a user-selected handle.
- **Sandboxed Execution**: All disk operations are performed through the browser's secure abstraction layer, ensuring the application cannot access any files or directories outside of those explicitly granted by the user.
