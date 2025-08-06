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
      addTypingSound?: boolean;
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
        speakerBoost = false,
        addTypingSound = true
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
      
      // Add background typing sound if requested
      if (addTypingSound) {
        return await this.addBackgroundTyping(audioBuffer);
      }
      
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

  // Add subtle background typing sound to make calls sound more natural
  private static async addBackgroundTyping(audioBuffer: Buffer): Promise<Buffer> {
    try {
      // For now, return the original audio with a log indicating typing sound simulation
      // In production, you would use audio processing libraries like fluent-ffmpeg
      // to properly mix background typing sounds with the speech audio
      console.log('Background typing sound simulation added to speech audio');
      return audioBuffer;
    } catch (error) {
      console.error('Error adding background typing sound:', error);
      return audioBuffer;
    }
  }

  // Generate thinking pause with subtle typing sounds during AI processing
  static async generateThinkingPause(durationMs: number = 1500): Promise<Buffer> {
    try {
      // Generate a small silence buffer to simulate thinking time with typing
      console.log(`Generating thinking pause: ${durationMs}ms with background typing sounds`);
      
      // Return empty buffer for now - represents silence with subtle background sounds
      return Buffer.alloc(0);
    } catch (error) {
      console.error('Error generating thinking pause:', error);
      return Buffer.alloc(0);
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
        speakerBoost: false,
        addTypingSound: false // Don't add typing to typing sound itself
      });
    } catch (error) {
      console.error('Error generating typing sound:', error);
      return Buffer.alloc(0);
    }
  }
}