import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface IndicTTSConfig {
  model: string;
  language: string;
  speaker: string;
  speed: number;
  pitch: number;
  outputFormat: 'wav' | 'mp3';
}

export class IndicTTSService {
  private configPath: string;
  private defaultConfig: IndicTTSConfig = {
    model: 'fastpitch',
    language: 'hi', // Hindi by default
    speaker: 'female',
    speed: 1.0,
    pitch: 1.0,
    outputFormat: 'wav'
  };

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'indic-tts-config.json');
  }

  async loadConfig(): Promise<IndicTTSConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      return { ...this.defaultConfig, ...JSON.parse(configData) };
    } catch (error) {
      console.log('Using default Indic-TTS configuration');
      return this.defaultConfig;
    }
  }

  async saveConfig(config: Partial<IndicTTSConfig>): Promise<void> {
    const currentConfig = await this.loadConfig();
    const newConfig = { ...currentConfig, ...config };
    
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    await fs.writeFile(this.configPath, JSON.stringify(newConfig, null, 2));
  }

  async synthesizeSpeech(
    text: string, 
    outputPath: string,
    customConfig?: Partial<IndicTTSConfig>
  ): Promise<{ success: boolean; audioPath?: string; error?: string }> {
    try {
      const config = { ...await this.loadConfig(), ...customConfig };
      
      // Prepare command arguments for Indic-TTS
      const args = [
        '--text', text,
        '--model', config.model,
        '--lang', config.language,
        '--speaker', config.speaker,
        '--speed', config.speed.toString(),
        '--pitch', config.pitch.toString(),
        '--output', outputPath,
        '--format', config.outputFormat
      ];

      return new Promise((resolve) => {
        // MOCK IMPLEMENTATION: In production, this would call the actual AI4Bharat Indic-TTS Python script
        // For now, create a placeholder audio file to demonstrate the integration
        console.log(`[MOCK] Indic-TTS Synthesis:`);
        console.log(`Text: "${text}"`);
        console.log(`Language: ${config.language}, Speaker: ${config.speaker}`);
        console.log(`Speed: ${config.speed}, Pitch: ${config.pitch}`);
        
        // Create a mock WAV file header (minimal WAV file structure)
        const mockWavData = Buffer.alloc(44 + 1000); // Header + 1000 bytes of mock audio data
        
        // WAV header
        mockWavData.write('RIFF', 0);
        mockWavData.writeUInt32LE(44 + 1000 - 8, 4);
        mockWavData.write('WAVE', 8);
        mockWavData.write('fmt ', 12);
        mockWavData.writeUInt32LE(16, 16);
        mockWavData.writeUInt16LE(1, 20);  // PCM format
        mockWavData.writeUInt16LE(1, 22);  // mono
        mockWavData.writeUInt32LE(8000, 24);  // sample rate
        mockWavData.writeUInt32LE(8000, 28);  // byte rate
        mockWavData.writeUInt16LE(1, 32);  // block align
        mockWavData.writeUInt16LE(8, 34);  // bits per sample
        mockWavData.write('data', 36);
        mockWavData.writeUInt32LE(1000, 40);
        
        // Ensure temp directory exists
        const tempDir = path.dirname(outputPath);
        fs.mkdir(tempDir, { recursive: true }).then(() => {
          // Write mock audio data
          return fs.writeFile(outputPath, mockWavData);
        }).then(() => {
          console.log(`[MOCK] Audio file created: ${outputPath}`);
          resolve({ success: true, audioPath: outputPath });
        }).catch((error) => {
          console.error('Error creating mock audio file:', error);
          resolve({ 
            success: false, 
            error: `Failed to write mock audio file: ${error.message}` 
          });
        });
      });
    } catch (error) {
      return { 
        success: false, 
        error: `Indic-TTS error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  async getAvailableLanguages(): Promise<string[]> {
    // Based on Indic-TTS supported languages
    return [
      'hi', // Hindi
      'bn', // Bengali
      'gu', // Gujarati
      'kn', // Kannada
      'ml', // Malayalam
      'mr', // Marathi
      'or', // Odia
      'pa', // Punjabi
      'ta', // Tamil
      'te', // Telugu
      'ur', // Urdu
      'as', // Assamese
      'brx', // Bodo
      'doi', // Dogri
      'gom', // Konkani
      'ks', // Kashmiri
      'mai', // Maithili
      'mni', // Manipuri
      'ne', // Nepali
      'sa', // Sanskrit
      'sat', // Santali
      'sd', // Sindhi
    ];
  }

  async getAvailableSpeakers(): Promise<{ [language: string]: string[] }> {
    // Based on Indic-TTS available speakers per language
    return {
      'hi': ['male', 'female'],
      'bn': ['male', 'female'],
      'gu': ['male', 'female'],
      'kn': ['male', 'female'],
      'ml': ['male', 'female'],
      'mr': ['male', 'female'],
      'or': ['male', 'female'],
      'pa': ['male', 'female'],
      'ta': ['male', 'female'],
      'te': ['male', 'female'],
      'ur': ['male', 'female'],
      'as': ['male', 'female'],
      'en': ['male', 'female'], // English support
    };
  }

  async validateConfig(config: Partial<IndicTTSConfig>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const availableLanguages = await this.getAvailableLanguages();
    const availableSpeakers = await this.getAvailableSpeakers();

    if (config.language && !availableLanguages.includes(config.language)) {
      errors.push(`Unsupported language: ${config.language}`);
    }

    if (config.language && config.speaker) {
      const speakers = availableSpeakers[config.language] || [];
      if (!speakers.includes(config.speaker)) {
        errors.push(`Unsupported speaker '${config.speaker}' for language '${config.language}'`);
      }
    }

    if (config.speed && (config.speed < 0.5 || config.speed > 2.0)) {
      errors.push('Speed must be between 0.5 and 2.0');
    }

    if (config.pitch && (config.pitch < 0.5 || config.pitch > 2.0)) {
      errors.push('Pitch must be between 0.5 and 2.0');
    }

    return { valid: errors.length === 0, errors };
  }
}