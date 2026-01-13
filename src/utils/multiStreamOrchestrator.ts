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
    this.peerConnection = (conn as any).peerConnection;
    this.isSender = isSender;
  }

  /**
   * Initialize channels - different approach for sender vs receiver
   */
  async initializeChannels(streamCount: number): Promise<StreamChannel[]> {
    if (!this.peerConnection) {
      throw new Error('No peer connection available');
    }

    console.log(`🎯 Orchestrator: Initializing ${streamCount} channels (${this.isSender ? 'SENDER' : 'RECEIVER'})`);

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
    console.log('📤 Sender: Creating DataChannels...');
    
    const channels: StreamChannel[] = [];
    
    // Create all channels first
    for (let i = 0; i < streamCount; i++) {
      try {
        const channel = this.peerConnection!.createDataChannel(`stream_${i}`, {
          ordered: false,
          maxRetransmits: 0
        });

        const streamChannel: StreamChannel = {
          channel,
          id: i,
          ready: false
        };

        // Setup channel event handlers
        channel.onopen = () => {
          console.log(`✅ Sender channel ${i} opened`);
          streamChannel.ready = true;
        };

        channel.onerror = (err) => {
          console.error(`❌ Sender channel ${i} error:`, err);
        };

        channel.onclose = () => {
          console.log(`🔒 Sender channel ${i} closed`);
          streamChannel.ready = false;
        };

        channels.push(streamChannel);
      } catch (error) {
        console.error(`Failed to create sender channel ${i}:`, error);
      }
    }

    // Wait for negotiation to complete
    console.log('⏳ Waiting for negotiation...');
    await this.waitForNegotiation();

    // Wait for all channels to open
    console.log('⏳ Waiting for channels to open...');
    await this.waitForChannelsReady(channels, 10000);

    const readyCount = channels.filter(c => c.ready).length;
    console.log(`✅ Sender: ${readyCount}/${streamCount} channels ready`);

    return channels;
  }

  /**
   * RECEIVER: Setup listeners for incoming DataChannels
   */
  private async setupReceiverChannels(streamCount: number): Promise<StreamChannel[]> {
    console.log('📥 Receiver: Setting up channel listeners...');
    
    return new Promise((resolve) => {
      const channels: StreamChannel[] = [];
      
      this.peerConnection!.ondatachannel = (event: RTCDataChannelEvent) => {
        const channel = event.channel;
        const match = channel.label.match(/stream_(\d+)/);
        
        if (match) {
          const id = parseInt(match[1]);
          console.log(`📥 Receiver: Incoming channel ${id}`);

          const streamChannel: StreamChannel = {
            channel,
            id,
            ready: false
          };

          channel.onopen = () => {
            console.log(`✅ Receiver channel ${id} opened`);
            streamChannel.ready = true;

            // Check if all channels are ready
            if (channels.length === streamCount && channels.every(c => c.ready)) {
              console.log(`✅ Receiver: All ${streamCount} channels ready`);
              resolve(channels);
            }
          };

          channel.onerror = (err) => {
            console.error(`❌ Receiver channel ${id} error:`, err);
          };

          channel.onclose = () => {
            console.log(`🔒 Receiver channel ${id} closed`);
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
          console.warn(`⚠️ Timeout: Only ${channels.length}/${streamCount} channels received`);
          resolve(channels);
        }
      }, 15000);
    });
  }

  /**
   * Wait for WebRTC negotiation to complete
   */
  private async waitForNegotiation(): Promise<void> {
    return new Promise((resolve) => {
      // Check if negotiation is needed
      if (this.peerConnection!.signalingState === 'stable') {
        resolve();
        return;
      }

      // Wait for stable state
      const checkState = () => {
        if (this.peerConnection!.signalingState === 'stable') {
          resolve();
        } else {
          setTimeout(checkState, 100);
        }
      };

      checkState();

      // Timeout after 5 seconds
      setTimeout(() => resolve(), 5000);
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

    console.warn(`⚠️ Channel ready timeout: ${channels.filter(c => c.ready).length}/${channels.length} ready`);
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
    console.log('🔒 Closing all channels...');
    this.channels.forEach(sc => {
      try {
        if (sc.channel.readyState === 'open') {
          sc.channel.close();
        }
      } catch (error) {
        console.error('Error closing channel:', error);
      }
    });
    this.channels = [];
  }
}
