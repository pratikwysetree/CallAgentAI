import { SpeechClient } from '@google-cloud/speech';
import { Readable } from 'stream';

export class GoogleSpeechService {
  private client: SpeechClient;

  constructor() {
    // Initialize Google Cloud Speech client with service account credentials
    this.client = new SpeechClient({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: {
        client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
    });
  }

  // Transcribe audio stream from Twilio recording
  async transcribeAudioStream(audioStream: Readable): Promise<string> {
    try {
      const request = {
        config: {
          encoding: 'MULAW' as const, // Twilio uses μ-law encoding
          sampleRateHertz: 8000, // Twilio standard sample rate
          languageCode: 'en-IN', // Indian English for better recognition
          alternativeLanguageCodes: ['hi-IN', 'en-US'], // Support Hindi and US English
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: false,
          model: 'latest_long', // Best model for phone calls
          useEnhanced: true,
        },
        audio: {
          content: '', // Will be populated from stream
        },
      };

      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);
      request.audio.content = audioBuffer.toString('base64');

      const [response] = await this.client.recognize(request);
      
      if (response.results && response.results.length > 0) {
        const transcription = response.results
          .map(result => result.alternatives?.[0]?.transcript || '')
          .join(' ')
          .trim();
        
        console.log(`🎤 Google Speech transcription: "${transcription}"`);
        return transcription;
      }

      return 'No speech detected';
    } catch (error) {
      console.error('Google Speech API error:', error);
      return 'Speech recognition failed';
    }
  }

  // Transcribe audio buffer directly
  async transcribeAudioBuffer(audioBuffer: Buffer): Promise<string> {
    try {
      const request = {
        config: {
          encoding: 'WEBM_OPUS' as const, // For web audio
          sampleRateHertz: 48000,
          languageCode: 'en-IN',
          alternativeLanguageCodes: ['hi-IN', 'en-US'],
          enableAutomaticPunctuation: true,
          model: 'latest_short', // For short utterances
          useEnhanced: true,
        },
        audio: {
          content: audioBuffer.toString('base64'),
        },
      };

      const [response] = await this.client.recognize(request);
      
      if (response.results && response.results.length > 0) {
        const transcription = response.results
          .map(result => result.alternatives?.[0]?.transcript || '')
          .join(' ')
          .trim();
        
        console.log(`🎤 Google Speech transcription: "${transcription}"`);
        return transcription;
      }

      return 'No speech detected';
    } catch (error) {
      console.error('Google Speech API error:', error);
      return 'Speech recognition failed';
    }
  }

  // Real-time streaming transcription (for future use)
  async createStreamingRecognition() {
    const request = {
      config: {
        encoding: 'LINEAR16' as const,
        sampleRateHertz: 16000,
        languageCode: 'en-IN',
        enableAutomaticPunctuation: true,
        model: 'phone_call',
      },
      interimResults: true,
    };

    return this.client.streamingRecognize(request);
  }
}

export const googleSpeechService = new GoogleSpeechService();