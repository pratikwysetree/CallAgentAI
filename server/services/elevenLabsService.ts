import { promises as fs } from 'fs';
import path from 'path';

export interface ElevenLabsConfig {
  apiKey: string;
  voiceId: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
}

export class ElevenLabsService {
  private apiKey: string;
  private baseURL = 'https://api.elevenlabs.io/v1';

  constructor(apiKey?: string) {
    this.apiKey = apiKey || process.env.ELEVENLABS_API_KEY || '';
    if (!this.apiKey) {
      console.warn('⚠️ ElevenLabs API key not found. Please set ELEVENLABS_API_KEY environment variable.');
    }
  }

  async isConfigured(): Promise<boolean> {
    return !!this.apiKey;
  }

  async validateApiKey(): Promise<{ valid: boolean; error?: string }> {
    if (!this.apiKey) {
      return { valid: false, error: 'API key not provided' };
    }

    try {
      const response = await fetch(`${this.baseURL}/user`, {
        headers: {
          'Xi-Api-Key': this.apiKey,
        },
      });

      if (response.ok) {
        return { valid: true };
      } else {
        const error = await response.text();
        return { valid: false, error: `API validation failed: ${error}` };
      }
    } catch (error) {
      return { valid: false, error: `Network error: ${error instanceof Error ? error.message : 'Unknown error'}` };
    }
  }

  async getAvailableVoices(): Promise<ElevenLabsVoice[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch(`${this.baseURL}/voices`, {
        headers: {
          'Xi-Api-Key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch voices: ${response.statusText}`);
      }

      const data = await response.json();
      return data.voices || [];
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      return [];
    }
  }

  async getRecommendedVoices(): Promise<ElevenLabsVoice[]> {
    const voices = await this.getAvailableVoices();
    
    // Filter for voices suitable for business/professional calls
    return voices.filter(voice => {
      const labels = voice.labels || {};
      const isEnglish = labels.accent?.toLowerCase().includes('english') || 
                       labels.accent?.toLowerCase().includes('american') ||
                       labels.accent?.toLowerCase().includes('british');
      const isProfessional = labels.use_case?.toLowerCase().includes('professional') ||
                           labels.use_case?.toLowerCase().includes('business') ||
                           voice.category?.toLowerCase() === 'professional';
      
      return isEnglish || isProfessional || voice.category === 'premade';
    }).slice(0, 10); // Return top 10 recommended voices
  }

  async synthesizeSpeech(
    text: string, 
    config: Partial<ElevenLabsConfig> = {}
  ): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ElevenLabs API key not configured. Please set ELEVENLABS_API_KEY environment variable.');
    }

    const voiceId = config.voiceId || 'pNInz6obpgDQGcFmaJgB'; // Default: Adam voice
    const model = config.model || 'eleven_monolingual_v1';
    
    console.log(`🎙️ [ELEVENLABS] Synthesizing speech with voice: ${voiceId}`);
    console.log(`🎙️ [ELEVENLABS] Text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}"`);
    
    try {
      const response = await fetch(`${this.baseURL}/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'Xi-Api-Key': this.apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: model,
          voice_settings: {
            stability: config.stability ?? 0.5,
            similarity_boost: config.similarityBoost ?? 0.75,
            style: config.style ?? 0.0,
            use_speaker_boost: config.useSpeakerBoost ?? true,
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
      }

      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`🎙️ [ELEVENLABS] Audio generated: ${audioBuffer.length} bytes`);
      
      return audioBuffer;
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw error;
    }
  }

  async generateAudioFile(
    text: string, 
    config: Partial<ElevenLabsConfig> = {}
  ): Promise<string> {
    const audioBuffer = await this.synthesizeSpeech(text, config);
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 11);
    const filename = `elevenlabs_${timestamp}_${randomId}.mp3`;
    const filePath = path.join('./temp', filename);
    
    // Ensure temp directory exists
    await fs.mkdir('./temp', { recursive: true });
    
    // Write audio file
    await fs.writeFile(filePath, audioBuffer);
    
    console.log(`🎙️ [ELEVENLABS] Audio file saved: ${filename} (${audioBuffer.length} bytes)`);
    
    return filename;
  }

  async cleanupAudioFile(filename: string): Promise<void> {
    try {
      const filePath = path.join('./temp', filename);
      await fs.unlink(filePath);
      console.log(`🧹 [ELEVENLABS] Cleaned up: ${filename}`);
    } catch (error) {
      console.error(`Error cleaning up ${filename}:`, error);
    }
  }

  // Get character count for billing estimation
  getCharacterCount(text: string): number {
    return text.length;
  }

  // Estimate cost (ElevenLabs charges per 1000 characters)
  estimateCost(text: string, pricePerThousandChars: number = 0.30): number {
    const charCount = this.getCharacterCount(text);
    return (charCount / 1000) * pricePerThousandChars;
  }
}

export const elevenLabsService = new ElevenLabsService();