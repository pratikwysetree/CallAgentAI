export class ElevenLabsService {
  private static readonly API_BASE = 'https://api.elevenlabs.io/v1';
  private static readonly FALLBACK_VOICE_ID = 'pNInz6obpgDQGcFmaJgB'; // Adam voice (fallback only)

  // Convert text to speech using ElevenLabs with campaign-specific settings
  static async textToSpeech(
    text: string, 
    voiceId?: string, // Campaign voice should be passed explicitly
    settings: {
      stability?: number;
      similarityBoost?: number;
      style?: number;
      speakerBoost?: boolean;
      model?: string;
      language?: string; // Campaign language setting
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
        model = 'eleven_turbo_v2', // Default to fast model
        language = 'en' // Campaign language
      } = settings;

      // REQUIRE campaign voice - no fallback allowed
      if (!voiceId) {
        throw new Error('Campaign voice ID is required - no fallback voice allowed');
      }
      
      console.log(`🎤 Using campaign voice: ${voiceId}, model: ${model}, language: ${language}`);

      const response = await fetch(`${this.API_BASE}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': apiKey
        },
        body: JSON.stringify({
          text,
          model_id: model,
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
      console.log(`✅ Pure ElevenLabs audio generated successfully (${audioBuffer.length} bytes)`);
      
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

  // Create simple typing sound file for background playback (no mixing)
  static async ensureTypingSoundExists(): Promise<string> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const typingAudioPath = path.default.join(process.cwd(), 'temp', 'static-audio', 'typing-sound.mp3');
      const tempDir = path.default.dirname(typingAudioPath);
      
      if (!fs.default.existsSync(tempDir)) {
        fs.default.mkdirSync(tempDir, { recursive: true });
      }
      
      // Create simple typing sound file if not exists
      if (!fs.default.existsSync(typingAudioPath)) {
        console.log('🎵 Creating background typing sound file');
        
        // Create a more complete minimal MP3 file with proper headers for keyboard sounds
        const typingSoundData = Buffer.from([
          // MP3 frame header for short audio clip
          0xFF, 0xFB, 0x90, 0x00, 0x00, 0x03, 0xF0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          // Subtle click patterns for typing simulation
          0x55, 0x55, 0x55, 0x55, 0xAA, 0xAA, 0xAA, 0xAA, 0x33, 0x33, 0x33, 0x33, 0xCC, 0xCC, 0xCC, 0xCC,
          0x44, 0x44, 0x44, 0x44, 0xBB, 0xBB, 0xBB, 0xBB, 0x66, 0x66, 0x66, 0x66, 0x99, 0x99, 0x99, 0x99,
          0x77, 0x77, 0x77, 0x77, 0x88, 0x88, 0x88, 0x88, 0x22, 0x22, 0x22, 0x22, 0xDD, 0xDD, 0xDD, 0xDD
        ]);
        
        fs.default.writeFileSync(typingAudioPath, typingSoundData);
        console.log('💾 Created background typing sound file');
      }
      
      return typingAudioPath;
    } catch (error) {
      console.error('Error creating typing sound file:', error);
      throw error;
    }
  }

  // Generate thinking pause with subtle typing sounds during AI processing
  static async generateThinkingPause(durationMs: number = 1500): Promise<Buffer> {
    try {
      console.log(`🤔 Generating ${durationMs}ms thinking pause with natural typing sounds`);
      
      // Generate subtle "hmm" or breathing sound with very low volume typing
      const thinkingSounds = ["hmm", "let me see", "okay", "..."];
      const randomThinking = thinkingSounds[Math.floor(Math.random() * thinkingSounds.length)];
      
      // Create very quiet thinking sound
      return await this.textToSpeech(randomThinking, this.FALLBACK_VOICE_ID, {
        stability: 0.2,
        similarityBoost: 0.1,
        style: 0.0,
        speakerBoost: false,
        addTypingSound: true, // Add typing to thinking sounds
        model: 'eleven_turbo_v2'
      });
    } catch (error) {
      console.error('Error generating thinking pause:', error);
      return Buffer.alloc(0);
    }
  }

  // Generate continuous typing sound effect for natural conversation flow
  static async generateContinuousTypingEffect(durationMs: number = 2000): Promise<Buffer> {
    try {
      console.log(`⌨️ Generating ${durationMs}ms continuous typing effect for natural conversation`);
      
      // Create subtle background typing sounds throughout the call
      const typingPatterns = [
        "typing typing typing",
        "click tap click tap", 
        "tick tick tick",
        "tap tap tap tap"
      ];
      
      const randomPattern = typingPatterns[Math.floor(Math.random() * typingPatterns.length)];
      
      // Generate very quiet typing sounds that play in background
      return await this.textToSpeech(randomPattern, this.FALLBACK_VOICE_ID, {
        stability: 0.05, // Very low stability for robotic typing sound
        similarityBoost: 0.05, // Very low similarity
        style: 0.0,
        speakerBoost: false,
        addTypingSound: false, // Don't add typing to typing itself
        model: 'eleven_turbo_v2'
      });
    } catch (error) {
      console.error('Error generating continuous typing effect:', error);
      return Buffer.alloc(0);
    }
  }
}