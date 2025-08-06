export class ElevenLabsService {
  private static readonly API_BASE = 'https://api.elevenlabs.io/v1';
  private static readonly DEFAULT_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam voice

  // Convert text to speech using ElevenLabs
  static async textToSpeech(
    text: string, 
    voiceId: string = this.DEFAULT_VOICE_ID,
    settings: {
      stability?: number;
      similarityBoost?: number;
      style?: number;
      speakerBoost?: boolean;
    } = {}
  ): Promise<Buffer> {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        throw new Error('ElevenLabs API key not configured');
      }

      const {
        stability = 0.5,
        similarityBoost = 0.7,
        style = 0.0,
        speakerBoost = false
      } = settings;

      const response = await fetch(`${this.API_BASE}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: speakerBoost
          }
        })
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      return audioBuffer;
    } catch (error) {
      console.error('ElevenLabs TTS error:', error);
      throw error;
    }
  }

  // Get available voices from user's ElevenLabs account
  static async getVoices(): Promise<Array<{ voice_id: string; name: string; category: string }>> {
    try {
      const apiKey = process.env.ELEVENLABS_API_KEY;
      if (!apiKey) {
        return []; // Return empty array if no API key
      }

      const response = await fetch(`${this.API_BASE}/voices`, {
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data = await response.json();
      return data.voices.map((voice: any) => ({
        voice_id: voice.voice_id,
        name: voice.name,
        category: voice.category || 'custom'
      }));
    } catch (error) {
      console.error('Error fetching voices:', error);
      return [];
    }
  }

  // Generate typing sound effect for natural conversation flow
  static async generateTypingSound(): Promise<Buffer> {
    try {
      // Use a simple "..." with Adam voice for typing effect
      return await this.textToSpeech("...", this.DEFAULT_VOICE_ID, {
        stability: 0.1,
        similarityBoost: 0.1,
        style: 0.0,
        speakerBoost: false
      });
    } catch (error) {
      console.error('Error generating typing sound:', error);
      // Return empty buffer as fallback
      return Buffer.alloc(0);
    }
  }
}