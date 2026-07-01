import { debugLog, debugWarn, debugError } from '../utils/logger';
/**
 * Multi-Stream Transfer Orchestrator
 * Handles proper WebRTC DataChannel negotiation for parallel streams
 */

import { DataConnection } from 'peerjs';

export interface StreamChannel {
  channel: RTCDataChannel;
  id: number;
  ready: boolean;
}

export class MultiStreamOrchestrator {
  private channels: StreamChannel[] = [];
  private peerConnection: RTCPeerConnection | null = null;
  private isSender: boolean;
  
  constructor(conn: DataConnection, isSender: boolean) {
    this.peerConnection = conn.peerConnection || null;
    this.isSender = isSender;
  }

  /**
   * Initialize channels - different approach for sender vs receiver
   */
  async initializeChannels(streamCount: number): Promise<StreamChannel[]> {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }

    debugLog(`🎯 Orchestrator: Initializing ${streamCount} channels (${this.isSender ? 'SENDER' : 'RECEIVER'})`);

    if (this.isSender) {
      // SENDER: Create channels and trigger renegotiation
      return await this.createSenderChannels(streamCount);
    } else {
      // RECEIVER: Listen for incoming channels
      return await this.setupReceiverChannels(streamCount);
    }
  }

  /**
   * SENDER: Create DataChannels and handle negotiation
   */
  private async createSenderChannels(streamCount: number): Promise<StreamChannel[]> {
    debugLog('📤 Sender: Creating DataChannels...');
    
    const channels: StreamChannel[] = [];
    
    // Setup negotiation handler BEFORE creating channels
    const negotiationPromise = new Promise<void>((resolve, reject) => {
      let negotiationComplete = false;
      const timeout = setTimeout(() => {
        if (!negotiationComplete) {
          debugWarn('⚠️ Negotiation timeout');
          resolve(); // Don't fail, just continue
        }
      }, 5000);

      const handleNegotiationNeeded = async () => {
        debugLog('🔄 Negotiation needed - creating offer');
        try {
          const offer = await this.peerConnection!.createOffer();
          await this.peerConnection!.setLocalDescription(offer);
          debugLog('📤 Local description set (offer)');
          
          // Note: PeerJS handles signaling automatically
          // The offer will be sent through PeerJS's signaling mechanism
        } catch (error) {
          debugError('❌ Negotiation error:', error);
          reject(error);
        }
      };

      const handleSignalingStateChange = () => {
        debugLog(`📡 Signaling state: ${this.peerConnection!.signalingState}`);
        if (this.peerConnection!.signalingState === 'stable') {
          negotiationComplete = true;
          clearTimeout(timeout);
          resolve();
        }
      };

      this.peerConnection!.addEventListener('negotiationneeded', handleNegotiationNeeded);
      this.peerConnection!.addEventListener('signalingstatechange', handleSignalingStateChange);
    });

    // Create all channels - this will trigger negotiationneeded
    for (let i = 0; i < streamCount; i++) {
      try {
        const channel = this.peerConnection!.createDataChannel(`stream_${i}`, {
          ordered: true
        });

        const streamChannel: StreamChannel = {
          channel,
          id: i,
          ready: false
        };

        // Setup channel event handlers
        channel.onopen = () => {
          debugLog(`✅ Sender channel ${i} opened`);
          streamChannel.ready = true;
        };

        channel.onerror = (err) => {
          debugError(`❌ Sender channel ${i} error:`, err);
        };

        channel.onclose = () => {
          debugLog(`🔒 Sender channel ${i} closed`);
          streamChannel.ready = false;
        };

        channels.push(streamChannel);
      } catch (error) {
        debugError(`Failed to create sender channel ${i}:`, error);
      }
    }

    // Wait for negotiation to complete
    debugLog('⏳ Waiting for negotiation...');
    await negotiationPromise;

    // Wait for all channels to open
    debugLog('⏳ Waiting for channels to open...');
    await this.waitForChannelsReady(channels, 10000);

    const readyCount = channels.filter(c => c.ready).length;
    debugLog(`✅ Sender: ${readyCount}/${streamCount} channels ready`);

    return channels;
  }

  /**
   * RECEIVER: Setup listeners for incoming DataChannels
   */
  private async setupReceiverChannels(streamCount: number): Promise<StreamChannel[]> {
    debugLog('📥 Receiver: Setting up channel listeners...');
    
    return new Promise((resolve) => {
      const channels: StreamChannel[] = [];
      
      this.peerConnection!.ondatachannel = (event: RTCDataChannelEvent) => {
        const channel = event.channel;
        const match = channel.label.match(/stream_(\d+)/);
        
        if (match) {
          const id = parseInt(match[1]);
          debugLog(`📥 Receiver: Incoming channel ${id}`);

          const streamChannel: StreamChannel = {
            channel,
            id,
            ready: false
          };

          channel.onopen = () => {
            debugLog(`✅ Receiver channel ${id} opened`);
            streamChannel.ready = true;

            // Check if all channels are ready
            if (channels.length === streamCount && channels.every(c => c.ready)) {
              debugLog(`✅ Receiver: All ${streamCount} channels ready`);
              resolve(channels);
            }
          };

          channel.onerror = (err) => {
            debugError(`❌ Receiver channel ${id} error:`, err);
          };

          channel.onclose = () => {
            debugLog(`🔒 Receiver channel ${id} closed`);
            streamChannel.ready = false;
          };

          channels.push(streamChannel);
          
          // Sort by ID to maintain order
          channels.sort((a, b) => a.id - b.id);
        }
      };

      // Timeout after 15 seconds
      setTimeout(() => {
        if (channels.length < streamCount) {
          debugWarn(`⚠️ Timeout: Only ${channels.length}/${streamCount} channels received`);
          resolve(channels);
        }
      }, 15000);
    });
  }


  /**
   * Wait for channels to be ready
   */
  private async waitForChannelsReady(channels: StreamChannel[], timeout: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const readyCount = channels.filter(c => c.ready).length;
      
      if (readyCount === channels.length) {
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    debugWarn(`⚠️ Channel ready timeout: ${channels.filter(c => c.ready).length}/${channels.length} ready`);
  }

  /**
   * Get all ready channels
   */
  getReadyChannels(): StreamChannel[] {
    return this.channels.filter(c => c.ready);
  }

  /**
   * Close all channels
   */
  closeAll(): void {
    debugLog('🔒 Closing all channels...');
    this.channels.forEach(sc => {
      try {
        if (sc.channel.readyState === 'open') {
          sc.channel.close();
        }
      } catch (error) {
        debugError('Error closing channel:', error);
      }
    });
    this.channels = [];
  }
}
