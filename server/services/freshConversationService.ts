import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class FreshConversationService {
  
  async processRecordedAudio(recordingUrl: string, callSid: string): Promise<string> {
    console.log(`🎙️ [FRESH-SERVICE] Processing audio from: ${recordingUrl}`);
    
    try {
      // 1. Download the audio file directly from Twilio 
      // Try multiple formats that Twilio supports
      let audioBuffer: Buffer;
      let audioExtension = 'wav';
      
      try {
        // First try WAV format (best for Whisper)
        const audioResponse = await fetch(recordingUrl + '.wav');
        if (audioResponse.ok) {
          audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
          audioExtension = 'wav';
        } else {
          // Fallback to MP3 format
          const mp3Response = await fetch(recordingUrl + '.mp3');
          if (mp3Response.ok) {
            audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
            audioExtension = 'mp3';
          } else {
            // Try without extension (Twilio default)
            const defaultResponse = await fetch(recordingUrl);
            if (!defaultResponse.ok) {
              throw new Error(`Failed to download audio: ${defaultResponse.status}`);
            }
            audioBuffer = Buffer.from(await defaultResponse.arrayBuffer());
            audioExtension = 'wav'; // Default assumption
          }
        }
      } catch (fetchError) {
        throw new Error(`Audio download failed: ${(fetchError as Error).message}`);
      }
      
      console.log(`📥 [FRESH-SERVICE] Downloaded ${audioBuffer.length} bytes (${audioExtension} format)`);
      
      // 2. Save audio file with proper extension for OpenAI Whisper
      const audioFilename = `fresh_audio_${callSid}_${Date.now()}.${audioExtension}`;
      const audioPath = path.join(process.cwd(), 'temp', audioFilename);
      fs.writeFileSync(audioPath, audioBuffer);
      
      // 3. Transcribe with OpenAI Whisper (auto-detect language)
      console.log(`🧠 [WHISPER] Transcribing audio file: ${audioFilename} (${audioExtension} format)`);
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioPath),
        model: "whisper-1",
        // Auto-detect language (Hindi/English/Hinglish)
        prompt: "LabsCheck, laboratory, pathology, partnership, WhatsApp, email, phone number, lab owner, manager, Hindi, English, Hinglish"
      });
      
      const customerText = transcription.text.trim();
      console.log(`🎤 [CUSTOMER] Said: "${customerText}"`);
      
      // 4. Generate AI response with language matching
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are Aavika from LabsCheck calling pathology labs for partnership.

LabsCheck connects 500+ labs to 100k+ users. Zero commission - labs keep 100% payments.

Goal: Get lab owner/manager contact details (WhatsApp, email) for partnership.

LANGUAGE MATCHING:
- If customer speaks Hindi/Hinglish, respond in Hindi/Hinglish
- If customer speaks English, respond in English
- Match their tone and speaking style exactly

Keep responses brief, warm, natural. Maximum 15 words.

RESPONSE FORMAT: {"message": "your response in same language as customer", "collected_data": {"contact_person": "", "whatsapp_number": "", "email": "", "lab_name": ""}, "should_end": false}`
          },
          {
            role: "user",
            content: customerText
          }
        ],
        max_tokens: 120,
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
      
      console.log(`🤖 [AI] Response: "${aiData.message}"`);
      
      // 5. Generate voice with ElevenLabs
      let audioUrl = null;
      try {
        const { elevenLabsService } = await import('./elevenLabsService');
        
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
        
        console.log(`🎵 [ELEVENLABS] Generated audio: ${audioUrl}`);
        
      } catch (ttsError) {
        console.error('❌ [ELEVENLABS] Error:', ttsError);
      }
      
      // 6. Store conversation data if collected
      if (aiData.collected_data && Object.keys(aiData.collected_data).length > 0) {
        await this.storeCollectedData(callSid, aiData.collected_data);
      }
      
      // 7. Generate TwiML response
      const twimlResponse = this.generateTwiMLResponse(audioUrl, aiData.message, aiData.should_end, callSid);
      
      // 8. Cleanup temp file
      try {
        fs.unlinkSync(audioPath);
      } catch (cleanupError) {
        console.log('🗑️ [CLEANUP] File already removed:', audioPath);
      }
      
      return twimlResponse;
      
    } catch (error) {
      console.error('❌ [FRESH-SERVICE] Error:', error);
      
      // Return safe fallback TwiML
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en-IN">Thank you for your time. We will contact you soon.</Say>
  <Hangup/>
</Response>`;
    }
  }
  
  private generateTwiMLResponse(audioUrl: string | null, message: string, shouldEnd: boolean, callSid: string): string {
    if (shouldEnd) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="alice" language="en-IN">${message}</Say>`}
  <Hangup/>
</Response>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="alice" language="en-IN">${message}</Say>`}
  <Record action="/api/twilio/fresh-recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
    }
  }
  
  private async storeCollectedData(callSid: string, collectedData: any): Promise<void> {
    try {
      console.log(`💾 [STORE-DATA] Call: ${callSid}, Data:`, collectedData);
      
      // Store the collected contact data
      const { storage } = await import('../storage');
      
      // Get call info
      const call = await storage.getCallByTwilioSid(callSid);
      if (call && call.contactId) {
        // Update contact with collected data
        const contact = await storage.getContact(call.contactId);
        if (contact) {
          const updatedContact = {
            ...contact,
            name: collectedData.contact_person || contact.name,
            whatsappNumber: collectedData.whatsapp_number || contact.whatsappNumber,
            email: collectedData.email || contact.email,
          };
          
          await storage.updateContact(call.contactId, updatedContact);
          console.log(`✅ [STORE-DATA] Updated contact: ${call.contactId}`);
        }
      }
      
    } catch (error) {
      console.error('❌ [STORE-DATA] Error:', error);
    }
  }
}

export const freshConversationService = new FreshConversationService();