import { storage } from '../storage';
import { openaiSpeechService } from './googleSpeechService';
import { nanoid } from 'nanoid';

export class AudioRecordingService {
  // Store audio recording directly in database
  async storeAudioRecording(
    callId: string,
    audioData: Buffer,
    messageIndex: number,
    format: string = 'wav'
  ): Promise<string> {
    try {
      const recordingId = nanoid();
      const audioBase64 = audioData.toString('base64');
      
      console.log(`📁 Storing audio recording ${recordingId} for call ${callId} (${audioData.length} bytes)`);
      
      // Store audio in database
      await storage.createAudioRecording({
        id: recordingId,
        callId,
        audioData: audioBase64,
        duration: Math.floor(audioData.length / 16000), // Rough estimate
        format,
        sampleRate: 8000, // Twilio standard
        messageIndex,
        transcription: null // Will be updated after transcription
      });
      
      console.log(`✅ Audio recording stored successfully: ${recordingId}`);
      return recordingId;
    } catch (error) {
      console.error('❌ Error storing audio recording:', error);
      throw error;
    }
  }

  // Transcribe stored audio recording
  async transcribeStoredRecording(recordingId: string): Promise<string> {
    try {
      const recording = await storage.getAudioRecording(recordingId);
      if (!recording) {
        throw new Error(`Audio recording ${recordingId} not found`);
      }

      console.log(`🎤 Transcribing stored recording ${recordingId}`);
      
      // Convert base64 back to buffer
      const audioBuffer = Buffer.from(recording.audioData, 'base64');
      
      // Transcribe using OpenAI Whisper
      const transcription = await openaiSpeechService.transcribeAudioBuffer(audioBuffer);
      
      // Update recording with transcription
      await storage.updateAudioRecording(recordingId, { transcription });
      
      console.log(`📝 Transcription completed: "${transcription}"`);
      return transcription;
    } catch (error) {
      console.error('❌ Error transcribing stored recording:', error);
      return 'Speech recognition failed';
    }
  }

  // Get all audio recordings for a call
  async getCallAudioRecordings(callId: string) {
    try {
      return await storage.getAudioRecordingsByCall(callId);
    } catch (error) {
      console.error('❌ Error getting call audio recordings:', error);
      return [];
    }
  }

  // Process audio from webhook data
  async processWebhookAudio(callId: string, audioData: string, messageIndex: number): Promise<string> {
    try {
      // Convert base64 audio data to buffer
      const audioBuffer = Buffer.from(audioData, 'base64');
      
      // Store in database
      const recordingId = await this.storeAudioRecording(callId, audioBuffer, messageIndex);
      
      // Transcribe
      const transcription = await this.transcribeStoredRecording(recordingId);
      
      return transcription;
    } catch (error) {
      console.error('❌ Error processing webhook audio:', error);
      return 'Speech recognition failed';
    }
  }
}

export const audioRecordingService = new AudioRecordingService();