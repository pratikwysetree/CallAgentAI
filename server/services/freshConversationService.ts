import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class FreshConversationService {
  
  private broadcastConversationEvent(callSid: string, eventType: string, content: string, metadata?: any) {
    try {
      const broadcastFunction = (global as any).broadcastToClients;
      if (broadcastFunction) {
        broadcastFunction({
          type: 'live_conversation',
          callSid,
          eventType,
          content,
          metadata,
          timestamp: new Date().toISOString()
        });
        console.log(`📡 [WEBSOCKET] Broadcasted ${eventType} for call ${callSid}`);
      } else {
        console.log('WebSocket broadcast not available: function not initialized');
      }
    } catch (error) {
      console.log('WebSocket broadcast error:', (error as Error).message);
    }
  }
  
  async processRecordedAudio(recordingUrl: string, callSid: string): Promise<string> {
    const startTime = Date.now();
    console.log(`🎙️ [FRESH-SERVICE] Processing audio from: ${recordingUrl}`);
    
    try {
      // 1. Download the audio file directly from Twilio 
      // Try multiple formats that Twilio supports
      let audioBuffer: Buffer;
      let audioExtension = 'wav';
      
      try {
        // Use Twilio client to access authenticated recording
        let twilioClient;
        try {
          const twilio = await import('twilio');
          twilioClient = twilio.default(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        } catch (importError) {
          console.error('❌ [TWILIO-IMPORT] Failed to import Twilio:', importError);
          throw new Error('Twilio client initialization failed');
        }
        
        // Extract recording SID from URL
        const recordingSid = recordingUrl.split('/').pop();
        console.log(`📞 [TWILIO-AUTH] Getting recording: ${recordingSid}`);
        
        // Fetch authenticated recording
        const recording = await twilioClient.recordings(recordingSid).fetch();
        const authenticatedUrl = `https://api.twilio.com${recording.uri.replace('.json', '.wav')}`;
        
        // Download with authentication
        const audioResponse = await fetch(authenticatedUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`
          }
        });
        
        if (!audioResponse.ok) {
          throw new Error(`Failed to download authenticated audio: ${audioResponse.status}`);
        }
        
        audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
        audioExtension = 'wav';
      } catch (fetchError) {
        throw new Error(`Audio download failed: ${(fetchError as Error).message}`);
      }
      
      console.log(`📥 [FRESH-SERVICE] Downloaded ${audioBuffer.length} bytes (${audioExtension} format)`);
      
      // 2. Save audio file with proper extension for OpenAI Whisper
      const audioFilename = `fresh_audio_${callSid}_${Date.now()}.${audioExtension}`;
      const tempDir = path.join(process.cwd(), 'temp');
      
      // Ensure temp directory exists
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
        console.log('📁 [TEMP] Created temp directory');
      }
      
      const audioPath = path.join(tempDir, audioFilename);
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
      
      // Check if transcription is empty
      if (!customerText || customerText.length < 2) {
        console.log('⚠️ [WHISPER] Empty or very short transcription, using default response');
        return this.generateTwiMLResponse(null, "I didn't catch that. Could you please repeat?", false, callSid);
      }
      
      // Broadcast customer speech event
      this.broadcastConversationEvent(callSid, 'customer_speech', customerText, {
        confidence: 0.95, // Whisper doesn't provide confidence, using default
        processingTime: Date.now() - startTime
      });
      
      // 4. Generate AI response with language matching
      const openaiRequestStart = Date.now();
      
      const requestPayload = {
        model: "gpt-4o" as const,
        messages: [
          {
            role: "system" as const,
            content: `You are Aavika from LabsCheck calling pathology labs for partnership.

LabsCheck connects 500+ labs to 100k+ users. Zero commission - labs keep 100% payments.

Goal: Get lab owner/manager contact details (WhatsApp, email) for partnership.

LANGUAGE MATCHING:
- If customer speaks Hindi/Hinglish, respond in Hindi/Hinglish
- If customer speaks English, respond in English
- Match their tone and speaking style exactly

Keep responses brief, warm, natural. Maximum 15 words.

IMPORTANT: Always respond in JSON format exactly like this:
{"message": "your response in same language as customer", "collected_data": {"contact_person": "", "whatsapp_number": "", "email": "", "lab_name": ""}, "should_end": false}

Use JSON format for all responses.`
          },
          {
            role: "user" as const,
            content: customerText
          }
        ],
        response_format: { type: "json_object" as const },
        temperature: 0.3
      };
      
      // Broadcast OpenAI request
      this.broadcastConversationEvent(callSid, 'openai_request', JSON.stringify(requestPayload, null, 2), {
        model: "gpt-4o",
        temperature: 0.3
      });
      
      const aiResponse = await openai.chat.completions.create(requestPayload);
      
      const openaiProcessingTime = Date.now() - openaiRequestStart;
      const aiResponseContent = aiResponse.choices[0].message.content || '{}';
      
      // Broadcast OpenAI response
      this.broadcastConversationEvent(callSid, 'openai_response', aiResponseContent, {
        model: "gpt-4o",
        processingTime: openaiProcessingTime,
        tokens: aiResponse.usage?.total_tokens || 0
      });
      
      // Parse AI response for processing
      let aiData;
      try {
        aiData = JSON.parse(aiResponseContent);
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
        
        const voiceSynthesisStart = Date.now();
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
        
        const voiceProcessingTime = Date.now() - voiceSynthesisStart;
        console.log(`🎵 [ELEVENLABS] Generated audio: ${audioUrl}`);
        
        // Broadcast voice synthesis event
        this.broadcastConversationEvent(callSid, 'voice_synthesis', aiData.message, {
          voiceId: '7w5JDCUNbeKrn4ySFgfu',
          model: 'eleven_multilingual_v2',
          processingTime: voiceProcessingTime,
          audioUrl
        });
        
      } catch (ttsError) {
        console.error('❌ [ELEVENLABS] Error:', ttsError);
        this.broadcastConversationEvent(callSid, 'error', `Voice synthesis failed: ${(ttsError as Error).message}`);
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
      this.broadcastConversationEvent(callSid, 'error', `Processing failed: ${(error as Error).message}`);
      
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