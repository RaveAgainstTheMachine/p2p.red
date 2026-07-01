export interface TransferMessage {
  type: string;
  payload: unknown;
  
  // Shard/chunk
  shardId: number;
  size: number;
  crc32: string;
  attemptId: number;
  offset: number;
  chunk: ArrayBuffer | Uint8Array;
  
  // Completion
  totalBytes: number;
  totalCrc32: string;
  
  // Streams
  streamCount: number;
  
  // Peer info
  candidateType: string;
  remoteCandidateId: string;
  localCandidateId: string;
  
  // Additional setup properties
  fileSize: number;
  shardSize: number;
  shardCount: number;
  chunkHeaderBytes: number;
  encryption: { enabled: boolean; ivBytes?: number };

  // Retransmit
  shardIds: number[];
  
  // Meta
  [key: string]: unknown;
}

export interface RTCStatsReportExt {
  id: string;
  type: string;
  candidateType: string;
  remoteCandidateId: string;
  localCandidateId: string;
  bytesReceived: number;
  bytesSent: number;
  currentRoundTripTime: number;
  availableOutgoingBitrate: number;
  timestamp: number;
  [key: string]: unknown;
}
