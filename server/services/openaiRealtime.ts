import OpenAI from 'openai';
import WebSocket from 'ws';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIRealtimeService {
  private realtimeSession: WebSocket | null = null;
  private sessionConfig = {
    model: "gpt-4o-realtime-preview-2024-10-01",
    modalities: ["text", "audio"],
    instructions: `You are an AI agent representing LabsCheck platform, calling pathology labs in India to recruit them as partners.

BUSINESS CONTEXT:
- LabsCheck is a neutral aggregator platform (NOT a laboratory)
- Mission: Partner with ALL laboratories across India for transparency
- Zero commission model - labs keep 100% of payments directly from customers
- Platform connects 500+ partner labs to 100k+ users across 140+ cities

YOUR GOAL: Recruit this pathology lab as a platform partner

KEY PARTNERSHIP BENEFITS:
- Zero commission fees - keep 100% of customer payments
- Free listing on our platform
- Direct bookings from 100k+ users
- Join established partners: Dr Lal PathLabs, Thyrocare, Metropolis, Apollo
- Transparent pricing increases customer trust

CONVERSATION STYLE:
- Warm, professional tone in Indian English/Hinglish
- Quick 30-60 second conversations
- Focus on partnership benefits, not competing with them
- Collect: Lab name, owner/manager name, WhatsApp number, email

SAMPLE OPENING: "Namaste! I'm calling from LabsCheck platform. We help pathology labs like yours get more customers through our online platform. Are you the lab owner or manager?"

Keep responses under 20 words for speed. End call when you have contact details or if not interested.`,
    voice: "alloy",
    input_audio_format: "g711_ulaw",
    output_audio_format: "g711_ulaw",
    turn_detection: {
      type: "server_vad",
      threshold: 0.5,
      prefix_padding_ms: 300,
      silence_duration_ms: 500
    },
    temperature: 0.1,
    max_response_output_tokens: 150
  };

  async createRealtimeSession(): Promise<string> {
    try {
      console.log('🔴 [REALTIME] Creating OpenAI Realtime session...');
      
      // For now, we'll use OpenAI's audio capabilities with direct processing
      // The Realtime API is still in preview and requires special access
      console.log('🔴 [REALTIME] Using OpenAI audio processing for realtime calls');
      
      return 'direct-audio-mode';
      
      console.log('🔴 [REALTIME] Session created successfully');
      return response.client_secret.value;
      
    } catch (error) {
      console.error('❌ [REALTIME] Failed to create session:', error);
      throw error;
    }
  }

  async connectRealtimeSession(ephemeralKey: string): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      console.log('🔴 [REALTIME] Connecting to OpenAI Realtime API...');
      
      const ws = new WebSocket(
        'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-10-01',
        {
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'OpenAI-Beta': 'realtime=v1'
          }
        }
      );

      ws.on('open', () => {
        console.log('🔴 [REALTIME] Connected to OpenAI Realtime API');
        
        // Configure session
        ws.send(JSON.stringify({
          type: 'session.update',
          session: this.sessionConfig
        }));
        
        this.realtimeSession = ws;
        resolve(ws);
      });

      ws.on('error', (error) => {
        console.error('❌ [REALTIME] WebSocket error:', error);
        reject(error);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleRealtimeMessage(message);
        } catch (error) {
          console.error('❌ [REALTIME] Error parsing message:', error);
        }
      });

      ws.on('close', () => {
        console.log('🔴 [REALTIME] Connection closed');
        this.realtimeSession = null;
      });
    });
  }

  private handleRealtimeMessage(message: any) {
    switch (message.type) {
      case 'session.created':
        console.log('🔴 [REALTIME] Session configured successfully');
        break;
      
      case 'session.updated':
        console.log('🔴 [REALTIME] Session updated');
        break;
      
      case 'input_audio_buffer.speech_started':
        console.log('🎤 [REALTIME] Customer started speaking');
        break;
      
      case 'input_audio_buffer.speech_stopped':
        console.log('🎤 [REALTIME] Customer stopped speaking');
        break;
      
      case 'response.created':
        console.log('🧠 [REALTIME] AI response created');
        break;
      
      case 'response.output_item.added':
        if (message.item.type === 'message') {
          console.log('💬 [REALTIME] AI message:', message.item.content?.[0]?.text || 'Audio response');
        }
        break;
      
      case 'response.audio.delta':
        console.log('🔊 [REALTIME] Audio chunk received');
        // This will be forwarded to Twilio
        break;
      
      case 'response.done':
        console.log('✅ [REALTIME] Response completed');
        break;
      
      case 'error':
        console.error('❌ [REALTIME] Error:', message.error);
        break;
      
      default:
        console.log('🔴 [REALTIME] Unknown message type:', message.type);
    }
  }

  sendAudioChunk(audioData: Buffer) {
    if (this.realtimeSession && this.realtimeSession.readyState === WebSocket.OPEN) {
      const base64Audio = audioData.toString('base64');
      
      this.realtimeSession.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: base64Audio
      }));
    }
  }

  commitAudioInput() {
    if (this.realtimeSession && this.realtimeSession.readyState === WebSocket.OPEN) {
      this.realtimeSession.send(JSON.stringify({
        type: 'input_audio_buffer.commit'
      }));
      
      // Trigger response generation
      this.realtimeSession.send(JSON.stringify({
        type: 'response.create',
        response: {
          modalities: ['audio'],
          instructions: 'Respond briefly in under 20 words about LabsCheck partnership benefits.'
        }
      }));
    }
  }

  closeSession() {
    if (this.realtimeSession) {
      this.realtimeSession.close();
      this.realtimeSession = null;
    }
  }
}

export const openaiRealtimeService = new OpenAIRealtimeService();