import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

// Ensure temp directory exists
const tempDir = path.join(__dirname, '../../temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class DirectAudioService {
  
  // Process audio directly from Twilio using OpenAI Whisper + GPT + TTS
  async processAudioRealtime(audioBuffer: Buffer, callSid: string, campaignId: string): Promise<string> {
    const startTime = Date.now();
    console.log(`🎤 [DIRECT-AUDIO] Processing ${audioBuffer.length} bytes of audio`);
    
    try {
      // 1. Save audio temporarily
      const tempAudioPath = path.join(__dirname, '../../temp', `audio_${callSid}_${Date.now()}.wav`);
      fs.writeFileSync(tempAudioPath, audioBuffer);
      
      // 2. Transcribe with Whisper (ultra-fast)
      const transcriptionStart = Date.now();
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: "whisper-1",
        language: "en", // English for Indian market
        prompt: "LabsCheck partnership, laboratory, pathology, WhatsApp, email", // Context hints
      });
      
      const transcriptionTime = Date.now() - transcriptionStart;
      console.log(`🧠 [WHISPER] ${transcriptionTime}ms: "${transcription.text}"`);
      
      // 3. Get AI response (optimized prompt)
      const aiStart = Date.now();
      const campaign = await storage.getCampaign(campaignId);
      
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are calling pathology labs for LabsCheck partnership. 
            
BUSINESS: LabsCheck is a neutral platform connecting 500+ labs to 100k+ users. Zero commission - labs keep 100% payments.

GOAL: Get lab owner/manager contact details (WhatsApp, email) for partnership.

STYLE: Warm, brief Indian English. Max 15 words. Say key benefit upfront.

RESPONSE FORMAT: {"message": "your response", "collected_data": {"contact_person": "name", "whatsapp_number": "number", "email": "email", "lab_name": "name"}, "should_end": false}`
          },
          {
            role: "user", 
            content: transcription.text
          }
        ],
        max_tokens: 100,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const aiTime = Date.now() - aiStart;
      const aiData = JSON.parse(aiResponse.choices[0].message.content || '{}');
      console.log(`🧠 [AI] ${aiTime}ms: "${aiData.message}"`);
      
      // 4. Generate speech with OpenAI TTS (faster than ElevenLabs)
      const ttsStart = Date.now();
      const speechResponse = await openai.audio.speech.create({
        model: "tts-1", // Fastest model
        voice: "alloy", // Natural voice
        input: aiData.message,
        speed: 1.1, // Slightly faster for efficiency
      });
      
      const ttsTime = Date.now() - ttsStart;
      const audioArrayBuffer = await speechResponse.arrayBuffer();
      const audioBuffer = Buffer.from(audioArrayBuffer);
      
      const totalTime = Date.now() - startTime;
      console.log(`⚡ [TOTAL] ${totalTime}ms (Whisper: ${transcriptionTime}ms, AI: ${aiTime}ms, TTS: ${ttsTime}ms)`);
      
      // 5. For now, use Twilio Say instead of audio file serving for simplicity
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" rate="normal">${aiData.message}</Say>
  <Gather input="speech" speechTimeout="auto" timeout="8" language="en-IN" action="/api/twilio/direct-audio/${callSid}" method="POST">
    <Say voice="alice">Please continue</Say>
  </Gather>
</Response>`;

      // 7. Store conversation data
      if (aiData.collected_data) {
        this.updateContactData(callSid, aiData.collected_data);
      }
      
      // 8. Cleanup temp files after delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempAudioPath);
          fs.unlinkSync(responseAudioPath);
        } catch (e) {
          console.log('Temp file cleanup:', e.message);
        }
      }, 30000); // 30 seconds
      
      return twiml;
      
    } catch (error) {
      console.error('❌ [DIRECT-AUDIO] Error:', error);
      
      // Fallback TwiML
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was a technical issue. Thank you for your time.</Say>
  <Hangup/>
</Response>`;
    }
  }
  
  private async updateContactData(callSid: string, collectedData: any) {
    try {
      const call = await storage.getCallByTwilioSid(callSid);
      if (!call) return;
      
      // Update call with collected data
      await storage.updateCall(call.id, { 
        collectedData: collectedData 
      });
      
      // Update contact if we have contact details
      if (call.contactId && (collectedData.whatsapp_number || collectedData.email)) {
        const updateData: any = {};
        if (collectedData.whatsapp_number) updateData.whatsappNumber = collectedData.whatsapp_number;
        if (collectedData.email) updateData.email = collectedData.email;
        
        await storage.updateContact(call.contactId, updateData);
      }
      
    } catch (error) {
      console.error('Error updating contact data:', error);
    }
  }
}

export const directAudioService = new DirectAudioService();