import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

export interface WhisperConfig {
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large' | 'large-v2' | 'large-v3';
  language?: string; // Auto-detect if not specified
  task: 'transcribe' | 'translate';
  outputFormat: 'txt' | 'json' | 'srt' | 'vtt';
  temperature: number;
  beamSize: number;
  patience: number;
  suppressTokens: string;
  initialPrompt?: string;
  conditionOnPreviousText: boolean;
  fp16: boolean;
  compressionRatioThreshold: number;
  logprobThreshold: number;
  noSpeechThreshold: number;
}

export interface TranscriptionResult {
  text: string;
  language?: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
    confidence?: number;
  }>;
  duration?: number;
  confidence?: number;
}

export class WhisperService {
  private configPath: string;
  private defaultConfig: WhisperConfig = {
    model: 'base',
    task: 'transcribe',
    outputFormat: 'json',
    temperature: 0.0,
    beamSize: 5,
    patience: 1.0,
    suppressTokens: '-1',
    conditionOnPreviousText: true,
    fp16: true,
    compressionRatioThreshold: 2.4,
    logprobThreshold: -1.0,
    noSpeechThreshold: 0.6,
  };

  constructor(configPath?: string) {
    this.configPath = configPath || path.join(process.cwd(), 'config', 'whisper-config.json');
  }

  async loadConfig(): Promise<WhisperConfig> {
    try {
      const configData = await fs.readFile(this.configPath, 'utf-8');
      return { ...this.defaultConfig, ...JSON.parse(configData) };
    } catch (error) {
      console.log('Using default Whisper configuration');
      return this.defaultConfig;
    }
  }

  async saveConfig(config: Partial<WhisperConfig>): Promise<void> {
    const currentConfig = await this.loadConfig();
    const newConfig = { ...currentConfig, ...config };
    
    // Ensure config directory exists
    const configDir = path.dirname(this.configPath);
    await fs.mkdir(configDir, { recursive: true });
    
    await fs.writeFile(this.configPath, JSON.stringify(newConfig, null, 2));
  }

  async transcribeAudio(
    audioPath: string,
    customConfig?: Partial<WhisperConfig>
  ): Promise<{ success: boolean; result?: TranscriptionResult; error?: string }> {
    try {
      const config = { ...await this.loadConfig(), ...customConfig };
      
      // Prepare command arguments for Whisper
      const args = [
        audioPath,
        '--model', config.model,
        '--task', config.task,
        '--output_format', config.outputFormat,
        '--temperature', config.temperature.toString(),
        '--beam_size', config.beamSize.toString(),
        '--patience', config.patience.toString(),
        '--suppress_tokens', config.suppressTokens,
        '--condition_on_previous_text', config.conditionOnPreviousText.toString(),
        '--compression_ratio_threshold', config.compressionRatioThreshold.toString(),
        '--logprob_threshold', config.logprobThreshold.toString(),
        '--no_speech_threshold', config.noSpeechThreshold.toString(),
      ];

      if (config.language) {
        args.push('--language', config.language);
      }

      if (config.initialPrompt) {
        args.push('--initial_prompt', config.initialPrompt);
      }

      if (config.fp16) {
        args.push('--fp16');
      }

      return new Promise((resolve) => {
        // In production, this would call the actual Whisper CLI or Python API
        const process = spawn('whisper', args);
        
        let stdout = '';
        let stderr = '';
        
        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });
        
        process.on('close', (code) => {
          if (code === 0) {
            try {
              const result = this.parseWhisperOutput(stdout, config.outputFormat);
              resolve({ success: true, result });
            } catch (parseError) {
              resolve({ 
                success: false, 
                error: `Failed to parse Whisper output: ${parseError}` 
              });
            }
          } else {
            resolve({ 
              success: false, 
              error: `Whisper transcription failed: ${stderr}` 
            });
          }
        });

        process.on('error', (error) => {
          resolve({ 
            success: false, 
            error: `Failed to start Whisper process: ${error.message}` 
          });
        });
      });
    } catch (error) {
      return { 
        success: false, 
        error: `Whisper error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  private parseWhisperOutput(output: string, format: string): TranscriptionResult {
    switch (format) {
      case 'json':
        const jsonOutput = JSON.parse(output);
        return {
          text: jsonOutput.text || '',
          language: jsonOutput.language,
          segments: jsonOutput.segments?.map((seg: any) => ({
            id: seg.id,
            start: seg.start,
            end: seg.end,
            text: seg.text,
            confidence: seg.avg_logprob ? Math.exp(seg.avg_logprob) : undefined,
          })),
          duration: jsonOutput.segments?.length > 0 
            ? jsonOutput.segments[jsonOutput.segments.length - 1].end 
            : undefined,
        };
      
      case 'txt':
        return {
          text: output.trim(),
        };
      
      default:
        return {
          text: output.trim(),
        };
    }
  }

  async getAvailableModels(): Promise<Array<{ name: string; size: string; description: string }>> {
    return [
      {
        name: 'tiny',
        size: '~39 MB',
        description: 'Fastest, lowest accuracy. Good for real-time applications.'
      },
      {
        name: 'base',
        size: '~74 MB',
        description: 'Good balance of speed and accuracy.'
      },
      {
        name: 'small',
        size: '~244 MB',
        description: 'Better accuracy, moderate speed.'
      },
      {
        name: 'medium',
        size: '~769 MB',
        description: 'High accuracy, slower processing.'
      },
      {
        name: 'large',
        size: '~1550 MB',
        description: 'Highest accuracy, slowest processing.'
      },
      {
        name: 'large-v2',
        size: '~1550 MB',
        description: 'Improved version of large model.'
      },
      {
        name: 'large-v3',
        size: '~1550 MB',
        description: 'Latest and most accurate model.'
      },
    ];
  }

  async getSupportedLanguages(): Promise<Array<{ code: string; name: string }>> {
    // Based on Whisper's supported languages
    return [
      { code: 'af', name: 'Afrikaans' },
      { code: 'ar', name: 'Arabic' },
      { code: 'hy', name: 'Armenian' },
      { code: 'az', name: 'Azerbaijani' },
      { code: 'be', name: 'Belarusian' },
      { code: 'bs', name: 'Bosnian' },
      { code: 'bg', name: 'Bulgarian' },
      { code: 'ca', name: 'Catalan' },
      { code: 'zh', name: 'Chinese' },
      { code: 'hr', name: 'Croatian' },
      { code: 'cs', name: 'Czech' },
      { code: 'da', name: 'Danish' },
      { code: 'nl', name: 'Dutch' },
      { code: 'en', name: 'English' },
      { code: 'et', name: 'Estonian' },
      { code: 'fi', name: 'Finnish' },
      { code: 'fr', name: 'French' },
      { code: 'gl', name: 'Galician' },
      { code: 'de', name: 'German' },
      { code: 'el', name: 'Greek' },
      { code: 'he', name: 'Hebrew' },
      { code: 'hi', name: 'Hindi' },
      { code: 'hu', name: 'Hungarian' },
      { code: 'is', name: 'Icelandic' },
      { code: 'id', name: 'Indonesian' },
      { code: 'it', name: 'Italian' },
      { code: 'ja', name: 'Japanese' },
      { code: 'kn', name: 'Kannada' },
      { code: 'kk', name: 'Kazakh' },
      { code: 'ko', name: 'Korean' },
      { code: 'lv', name: 'Latvian' },
      { code: 'lt', name: 'Lithuanian' },
      { code: 'mk', name: 'Macedonian' },
      { code: 'ms', name: 'Malay' },
      { code: 'mr', name: 'Marathi' },
      { code: 'mi', name: 'Maori' },
      { code: 'ne', name: 'Nepali' },
      { code: 'no', name: 'Norwegian' },
      { code: 'fa', name: 'Persian' },
      { code: 'pl', name: 'Polish' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'ro', name: 'Romanian' },
      { code: 'ru', name: 'Russian' },
      { code: 'sr', name: 'Serbian' },
      { code: 'sk', name: 'Slovak' },
      { code: 'sl', name: 'Slovenian' },
      { code: 'es', name: 'Spanish' },
      { code: 'sw', name: 'Swahili' },
      { code: 'sv', name: 'Swedish' },
      { code: 'tl', name: 'Tagalog' },
      { code: 'ta', name: 'Tamil' },
      { code: 'th', name: 'Thai' },
      { code: 'tr', name: 'Turkish' },
      { code: 'uk', name: 'Ukrainian' },
      { code: 'ur', name: 'Urdu' },
      { code: 'vi', name: 'Vietnamese' },
      { code: 'cy', name: 'Welsh' },
    ];
  }

  async validateConfig(config: Partial<WhisperConfig>): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const availableModels = await this.getAvailableModels();
    const supportedLanguages = await this.getSupportedLanguages();

    if (config.model && !availableModels.some(m => m.name === config.model)) {
      errors.push(`Unsupported model: ${config.model}`);
    }

    if (config.language && !supportedLanguages.some(l => l.code === config.language)) {
      errors.push(`Unsupported language: ${config.language}`);
    }

    if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 1)) {
      errors.push('Temperature must be between 0 and 1');
    }

    if (config.beamSize !== undefined && (config.beamSize < 1 || config.beamSize > 10)) {
      errors.push('Beam size must be between 1 and 10');
    }

    return { valid: errors.length === 0, errors };
  }
}