import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class WhisperService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required for Whisper service');
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper with enhanced support for Indian languages
   */
  async transcribeAudio(audioBuffer: Buffer, options: {
    language?: string;
    format?: 'wav' | 'mp3' | 'webm' | 'mp4';
    prompt?: string;
  } = {}): Promise<{
    text: string;
    language: string;
    confidence: number;
  }> {
    try {
      console.log(`🎙️ [WHISPER] Starting transcription...`);
      console.log(`🎙️ [WHISPER] Audio buffer size: ${audioBuffer.length} bytes`);
      
      // Create temporary audio file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilename = `whisper_${Date.now()}_${Math.random().toString(36).substring(7)}.${options.format || 'wav'}`;
      const tempFilePath = path.join(tempDir, tempFilename);
      
      // Write audio buffer to temporary file
      fs.writeFileSync(tempFilePath, audioBuffer);
      console.log(`🎙️ [WHISPER] Temporary audio file created: ${tempFilename}`);
      
      // Ultra-fast transcription prompt
      const transcriptionPrompt = options.prompt || 
        "Hindi English mixed pathology lab business call. Common: lab, pathology, partner, WhatsApp, email, haan, nahi, accha, kya, main, aap.";
      
      // Ultra-fast Whisper transcription (maximum speed)
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: 'whisper-1',
        language: options.language || 'hi',
        prompt: options.prompt || "lab business call", // Minimal prompt
        response_format: 'text', // Fastest format
        temperature: 0,
      }) as any;
      
      // Clean up temporary file
      fs.unlinkSync(tempFilePath);
      console.log(`🎙️ [WHISPER] Temporary file cleaned up`);
      
      // Handle both text and object responses
      const transcribedText = typeof transcription === 'string' ? transcription.trim() : transcription.text?.trim() || '';
      const detectedLanguage = typeof transcription === 'object' ? transcription.language || 'unknown' : 'unknown';
      
      // Calculate confidence based on text quality and length
      const confidence = this.calculateConfidence(transcribedText);
      
      console.log(`🎙️ [WHISPER] SUCCESS - Transcribed: "${transcribedText}"`);
      console.log(`🎙️ [WHISPER] Detected language: ${detectedLanguage}`);
      console.log(`🎙️ [WHISPER] Confidence: ${confidence}`);
      
      return {
        text: transcribedText,
        language: detectedLanguage,
        confidence
      };
      
    } catch (error) {
      console.error('🎙️ [WHISPER] Error during transcription:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Whisper transcription failed: ${errorMessage}`);
    }
  }

  /**
   * Calculate confidence score based on transcription quality
   */
  private calculateConfidence(text: string): number {
    if (!text || text.length < 2) return 0.1;
    
    // Basic confidence calculation
    let confidence = 0.7; // Base confidence for Whisper
    
    // Boost confidence for longer, coherent text
    if (text.length > 10) confidence += 0.1;
    if (text.length > 20) confidence += 0.1;
    
    // Reduce confidence for very short or unclear text
    if (text.length < 5) confidence -= 0.2;
    if (text.includes('...') || text.includes('[inaudible]')) confidence -= 0.3;
    
    // Boost confidence for known business terms
    const businessTerms = ['lab', 'laboratory', 'pathology', 'partner', 'business', 'whatsapp', 'email', 'labscheck'];
    const hindiTerms = ['haan', 'nahi', 'theek', 'accha', 'kya', 'main', 'aap', 'hai'];
    
    businessTerms.forEach(term => {
      if (text.toLowerCase().includes(term)) confidence += 0.05;
    });
    
    hindiTerms.forEach(term => {
      if (text.toLowerCase().includes(term)) confidence += 0.05;
    });
    
    return Math.min(0.95, Math.max(0.1, confidence));
  }

  /**
   * Download audio from Twilio recording URL and transcribe
   */
  async transcribeFromUrl(recordingUrl: string, options: {
    language?: string;
    prompt?: string;
  } = {}): Promise<{
    text: string;
    language: string;
    confidence: number;
  }> {
    try {
      console.log(`🎙️ [WHISPER] Downloading audio from URL: ${recordingUrl}`);
      
      // Add Twilio authentication for downloading recordings
      const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
      
      const response = await fetch(recordingUrl, {
        headers: {
          'Authorization': `Basic ${auth}`,
          'User-Agent': 'LabsCheck-Whisper/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`🎙️ [WHISPER] Download failed: ${response.status} ${response.statusText}`);
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }
      
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`🎙️ [WHISPER] Downloaded ${audioBuffer.length} bytes`);
      
      if (audioBuffer.length === 0) {
        throw new Error('Downloaded audio file is empty');
      }
      
      // Determine format from URL
      const format = recordingUrl.includes('.mp3') ? 'mp3' : 
                   recordingUrl.includes('.wav') ? 'wav' : 'wav';
      
      return await this.transcribeAudio(audioBuffer, {
        ...options,
        format
      });
      
    } catch (error) {
      console.error('🎙️ [WHISPER] Error downloading and transcribing:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Whisper download failed: ${errorMessage}`);
    }
  }
}

export const whisperService = new WhisperService();