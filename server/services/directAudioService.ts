import WebSocket from 'ws';
import { whisperService } from './whisperService';

interface AudioSession {
  callSid: string;
  audioBuffer: Buffer[];
  isRecording: boolean;
  lastActivity: number;
}

export class DirectAudioService {
  private sessions = new Map<string, AudioSession>();
  
  constructor() {
    // Clean up inactive sessions every 30 seconds
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 30000);
  }

  /**
   * Start audio capture session for a call
   */
  startAudioCapture(callSid: string): void {
    console.log(`🎙️ [DIRECT AUDIO] Starting capture for call: ${callSid}`);
    
    this.sessions.set(callSid, {
      callSid,
      audioBuffer: [],
      isRecording: true,
      lastActivity: Date.now()
    });
  }

  /**
   * Process incoming audio stream data
   */
  processAudioStream(callSid: string, audioData: Buffer): void {
    const session = this.sessions.get(callSid);
    if (!session || !session.isRecording) {
      return;
    }

    session.audioBuffer.push(audioData);
    session.lastActivity = Date.now();
    
    console.log(`🎙️ [DIRECT AUDIO] Received ${audioData.length} bytes for call: ${callSid}`);
  }

  /**
   * Stop recording and process accumulated audio
   */
  async stopAndProcessAudio(callSid: string): Promise<{ text: string; confidence: number } | null> {
    const session = this.sessions.get(callSid);
    if (!session) {
      console.log(`❌ [DIRECT AUDIO] No session found for call: ${callSid}`);
      return null;
    }

    session.isRecording = false;

    if (session.audioBuffer.length === 0) {
      console.log(`❌ [DIRECT AUDIO] No audio data captured for call: ${callSid}`);
      return null;
    }

    try {
      // Combine all audio chunks
      const totalAudio = Buffer.concat(session.audioBuffer);
      console.log(`🎙️ [DIRECT AUDIO] Processing ${totalAudio.length} bytes for call: ${callSid}`);

      // Process with Whisper
      const result = await whisperService.transcribeAudio(totalAudio, {
        language: 'hi',
        format: 'wav',
        prompt: "Hindi English mixed lab business call"
      });

      console.log(`🎙️ [DIRECT AUDIO] Transcription: "${result.text}"`);
      
      // Clean up session
      this.sessions.delete(callSid);
      
      return {
        text: result.text,
        confidence: result.confidence
      };

    } catch (error) {
      console.error(`❌ [DIRECT AUDIO] Error processing audio for call ${callSid}:`, error);
      this.sessions.delete(callSid);
      return null;
    }
  }

  /**
   * Generate TwiML for direct audio streaming
   */
  generateStreamingTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Start>
        <Stream url="wss://04b918f8-1324-429a-8c64-ebdefef53c64-00-2atotxxaug2tv.worf.replit.dev/audio-stream" />
    </Start>
    <Say voice="alice">Hi this is Aavika from LabsCheck, how are you doing today</Say>
    <Pause length="10"/>
</Response>`;
  }

  /**
   * Clean up old inactive sessions
   */
  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const timeout = 60000; // 1 minute timeout
    
    for (const [callSid, session] of this.sessions) {
      if (now - session.lastActivity > timeout) {
        console.log(`🧹 [DIRECT AUDIO] Cleaning up inactive session: ${callSid}`);
        this.sessions.delete(callSid);
      }
    }
  }

  /**
   * Handle WebSocket audio stream
   */
  handleWebSocketConnection(ws: WebSocket, request: any): void {
    console.log(`🔌 [DIRECT AUDIO] WebSocket connection established`);
    
    let callSid: string | null = null;
    
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.event) {
          case 'connected':
            console.log(`🔌 [DIRECT AUDIO] Stream connected for protocol: ${data.protocol}`);
            break;
            
          case 'start':
            callSid = data.start.callSid;
            console.log(`🎙️ [DIRECT AUDIO] Stream started for call: ${callSid}`);
            this.startAudioCapture(callSid);
            break;
            
          case 'media':
            if (callSid && data.media.payload) {
              // Decode base64 audio payload
              const audioData = Buffer.from(data.media.payload, 'base64');
              this.processAudioStream(callSid, audioData);
            }
            break;
            
          case 'stop':
            if (callSid) {
              console.log(`🛑 [DIRECT AUDIO] Stream stopped for call: ${callSid}`);
              // Process final audio when stream stops
              this.stopAndProcessAudio(callSid);
            }
            break;
        }
        
      } catch (error) {
        console.error(`❌ [DIRECT AUDIO] Error processing WebSocket message:`, error);
      }
    });
    
    ws.on('close', () => {
      console.log(`🔌 [DIRECT AUDIO] WebSocket connection closed`);
      if (callSid) {
        this.stopAndProcessAudio(callSid);
      }
    });
    
    ws.on('error', (error) => {
      console.error(`❌ [DIRECT AUDIO] WebSocket error:`, error);
    });
  }
}

export const directAudioService = new DirectAudioService();