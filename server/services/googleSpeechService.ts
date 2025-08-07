import OpenAI from 'openai';
import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAISpeechService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
  }

  // Transcribe audio stream from Twilio recording
  async transcribeAudioStream(audioStream: Readable): Promise<string> {
    try {
      // Convert stream to buffer
      const chunks: Buffer[] = [];
      for await (const chunk of audioStream) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);
      
      return await this.transcribeAudioBuffer(audioBuffer);
    } catch (error) {
      console.error('OpenAI Whisper stream transcription error:', error);
      return 'Speech recognition failed';
    }
  }

  // Transcribe audio buffer directly using OpenAI Whisper
  async transcribeAudioBuffer(audioBuffer: Buffer): Promise<string> {
    let tempFilePath: string | null = null;
    
    try {
      // Create temporary file for Whisper API
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      tempFilePath = path.join(tempDir, `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.wav`);
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      console.log(`🎙️ Created temp audio file: ${tempFilePath} (${audioBuffer.length} bytes)`);
      
      // Transcribe using OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en", // Can handle Hindi/English mix automatically
        response_format: "text",
        temperature: 0.2, // Lower temperature for more consistent results
      });
      
      console.log(`🎤 OpenAI Whisper transcription: "${transcription}"`);
      
      return transcription.trim() || 'No speech detected';
    } catch (error) {
      console.error('OpenAI Whisper API error:', error);
      return 'Speech recognition failed';
    } finally {
      // Clean up temporary file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          console.log(`🗑️ Cleaned up temp file: ${tempFilePath}`);
        } catch (cleanupError) {
          console.error('Error cleaning up temp file:', cleanupError);
        }
      }
    }
  }

  // Transcribe audio from URL (for Twilio recordings)
  async transcribeFromUrl(audioUrl: string): Promise<string> {
    let tempFilePath: string | null = null;
    
    try {
      // Download audio from URL
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`Failed to download audio: ${response.statusText}`);
      }
      
      const audioBuffer = Buffer.from(await response.arrayBuffer());
      console.log(`📥 Downloaded audio from URL: ${audioUrl} (${audioBuffer.length} bytes)`);
      
      return await this.transcribeAudioBuffer(audioBuffer);
    } catch (error) {
      console.error('Error transcribing from URL:', error);
      return 'Speech recognition failed';
    }
  }
}

export const openaiSpeechService = new OpenAISpeechService();