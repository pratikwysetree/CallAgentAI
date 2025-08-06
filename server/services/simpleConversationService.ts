import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class SimpleConversationService {
  
  // Simple conversation flow: Audio → Whisper → GPT → ElevenLabs → Audio
  async processCustomerAudio(audioBuffer: Buffer, callSid: string, campaignId: string): Promise<string> {
    const startTime = Date.now();
    console.log(`🎙️ [SIMPLE-FLOW] Processing ${audioBuffer.length} bytes of customer audio`);
    
    try {
      // 1. Save audio file for Whisper
      const tempAudioPath = path.join(__dirname, '../../temp', `customer_${callSid}_${Date.now()}.mp3`);
      fs.writeFileSync(tempAudioPath, audioBuffer);
      
      // 2. Transcribe with OpenAI Whisper
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: "whisper-1",
        prompt: "LabsCheck partnership, laboratory, pathology, WhatsApp, email",
      });
      
      console.log(`🧠 [WHISPER] Customer said: "${transcription.text}"`);
      
      // 3. Get AI response
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Aavika from LabsCheck calling pathology labs for partnership.

LabsCheck is a platform connecting 500+ labs to 100k+ users. Zero commission - labs keep 100% payments.

Goal: Get lab owner/manager contact details (WhatsApp, email) for partnership.

Keep responses brief, warm, and natural. Max 15 words.

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
      
      let aiData;
      try {
        aiData = JSON.parse(aiResponse.choices[0].message.content || '{}');
      } catch (parseError) {
        console.error('❌ [AI PARSE ERROR]:', parseError);
        aiData = {
          message: "Great! Can I get your WhatsApp number for partnership details?",
          should_end: false,
          collected_data: {}
        };
      }
      
      console.log(`🧠 [AI] Response: "${aiData.message}"`);
      
      // 4. Generate voice with ElevenLabs
      let audioUrl = null;
      try {
        const { elevenLabsService } = await import('../services/elevenLabsService');
        
        const audioFilename = await elevenLabsService.generateAudioFile(aiData.message, {
          voiceId: '7w5JDCUNbeKrn4ySFgfu', // Aavika's voice
          model: 'eleven_multilingual_v2',
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          useSpeakerBoost: true,
        });
        
        const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
        audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
        
        console.log(`🎤 [ELEVENLABS] Generated audio: ${audioUrl}`);
        
      } catch (ttsError) {
        console.error('❌ [ELEVENLABS] Error:', ttsError);
      }
      
      // 5. Store conversation data if collected
      if (aiData.collected_data && Object.keys(aiData.collected_data).length > 0) {
        await this.updateContactData(callSid, aiData.collected_data);
      }
      
      // 6. Create TwiML response
      let twiml;
      if (aiData.should_end) {
        // End call
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="alice">${aiData.message}</Say>`}
  <Hangup/>
</Response>`;
      } else {
        // Continue conversation
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="alice">${aiData.message}</Say>`}
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
      }
      
      // 7. Cleanup temp file
      setTimeout(() => {
        try {
          fs.unlinkSync(tempAudioPath);
        } catch (e) {
          console.log('Temp file cleanup:', (e as Error).message);
        }
      }, 10000);
      
      const totalTime = Date.now() - startTime;
      console.log(`⚡ [SIMPLE-FLOW] Total: ${totalTime}ms`);
      
      return twiml;
      
    } catch (error) {
      console.error('❌ [SIMPLE-FLOW] Error:', error);
      
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, technical issue. Thank you for calling.</Say>
  <Hangup/>
</Response>`;
    }
  }
  
  // Store contact data from conversation
  private async updateContactData(callSid: string, collectedData: any) {
    try {
      console.log(`💾 [CONTACT-DATA] Updating for call ${callSid}:`, collectedData);
      // Get call info and update contact
      const call = await storage.getCallByTwilioSid(callSid);
      if (call && call.contactId) {
        const updates: any = {};
        if (collectedData.whatsapp_number) updates.whatsappNumber = collectedData.whatsapp_number;
        if (collectedData.email) updates.email = collectedData.email;
        if (collectedData.lab_name) updates.company = collectedData.lab_name;
        if (collectedData.contact_person) updates.notes = `Contact person: ${collectedData.contact_person}`;
        
        if (Object.keys(updates).length > 0) {
          await storage.updateContact(call.contactId, updates);
        }
      }
    } catch (error) {
      console.error('❌ [CONTACT-UPDATE] Error:', error);
    }
  }
}

export const simpleConversationService = new SimpleConversationService();