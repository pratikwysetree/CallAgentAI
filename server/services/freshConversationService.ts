import fs from 'fs';
import path from 'path';
import { WebSocketServer } from 'ws';
import OpenAI from 'openai';

const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
});

export class FreshConversationService {
  private wsServer: WebSocketServer;
  private collectedData: Map<string, any> = new Map();

  constructor(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
  }

  private broadcastConversationEvent(callSid: string, eventType: string, content: string, metadata: any = {}) {
    if (!this.wsServer) return;

    const eventData = {
      type: 'live_conversation',
      callSid,
      eventType,
      content,
      metadata,
      timestamp: new Date().toISOString()
    };

    // Broadcast to all connected WebSocket clients safely
    this.wsServer.clients.forEach(client => {
      try {
        if (client && typeof client.send === 'function' && client.readyState === 1) { // WebSocket.OPEN = 1
          client.send(JSON.stringify(eventData));
        }
      } catch (error) {
        console.error('❌ [WEBSOCKET] Broadcast error:', error);
      }
    });

    console.log(`📡 [WEBSOCKET] Broadcasted ${eventType} for call ${callSid}`);
  }

  // Quick responses for common queries - no OpenAI needed
  private getQuickResponse(customerText: string): any | null {
    const text = customerText.toLowerCase().trim();
    
    // Detect language
    const isHindi = /[\u0900-\u097F]/.test(customerText) || 
                   /(hai|hain|kya|kaise|kahan|nahin|nahi|acha|thik|lab|test)/i.test(customerText);
    
    // Lab owner confirmation responses - only if they explicitly mention being owner
    if (/(yes.*owner|owner.*yes|i.*am.*owner|main.*owner|mai.*malik|haan.*owner)/i.test(text) && !(/(nahin|nahi|no)/i.test(text))) {
      return {
        message: isHindi ? "महान! LabsCheck India का पहला diagnostic aggregator platform है। हम trusted diagnostics को affordable prices पर provide करते हैं। क्या आप partnership में interested हैं?" : 
                           "Great! LabsCheck is India's first diagnostic aggregator platform. We provide trusted diagnostics at affordable prices. Are you interested in partnership?",
        collected_data: { contact_person: "lab_owner" },
        should_end: false
      };
    }
    
    // Common greetings/responses - only for simple greetings without owner context
    if (/(^hello$|^hi$|^namaste$)/i.test(text)) {
      return {
        message: isHindi ? "हैलो! मैं आविका हूँ LabsCheck से। क्या आप लैब के owner हैं?" : 
                           "Hi! I am Aavika from LabsCheck. Are you the lab owner?",
        collected_data: {},
        should_end: false
      };
    }
    
    if (/(owner|malik|malkin)/i.test(text) && /(nahin|nahi|no)/i.test(text)) {
      return {
        message: isHindi ? "क्या आप owner का WhatsApp number share कर सकते हैं?" : 
                           "Can you share the owner's WhatsApp number?",
        collected_data: {},
        should_end: false
      };
    }
    
    if (/(benefit|faayda|labh)/i.test(text)) {
      return {
        message: isHindi ? "आपको 100% payment मिलेगा, zero commission! अधिक visibility भी।" : 
                           "You get 100% payment, zero commission! More visibility too.",
        collected_data: {},
        should_end: false
      };
    }
    
    return null; // Use OpenAI for complex queries
  }

  async processAudio(recordingUrl: string, callSid: string): Promise<string> {
    const startTime = Date.now();
    
    // Get campaign voice configuration from the call
    let voiceConfig: any = null;
    try {
      const { storage } = await import('../storage');
      const calls = await storage.getCalls();
      const currentCall = calls.find(call => call.twilioCallSid === callSid);
      
      if (currentCall?.campaignId) {
        const campaign = await storage.getCampaign(currentCall.campaignId);
        voiceConfig = campaign?.voiceConfig;
        console.log(`🎤 [VOICE-CONFIG] Found campaign voice config:`, voiceConfig);
      }
    } catch (error) {
      console.error('❌ [VOICE-CONFIG] Could not load campaign voice config:', error);
    }
    
    try {
      console.log(`🎙️ [FRESH-RECORDING] Call: ${callSid}, Recording: ${recordingUrl.split('/').pop()}, URL: ${recordingUrl}`);
      console.log(`🎙️ [FRESH-SERVICE] Processing audio from: ${recordingUrl}`);
      
      // 1. Download and save audio with proper extension detection
      const audioBuffer = await this.downloadTwilioRecording(recordingUrl);
      console.log(`📥 [FRESH-SERVICE] Downloaded ${audioBuffer.length} bytes`);
      
      // Auto-detect format based on buffer header
      let audioExtension = 'wav'; // Default
      if (audioBuffer.subarray(0, 4).toString('hex') === 'fff3') {
        audioExtension = 'mp3';
      } else if (audioBuffer.subarray(8, 12).toString('ascii') === 'WAVE') {
        audioExtension = 'wav';
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
      
      // 4. Get conversation history to provide context to AI
      const { storage } = await import('../storage');
      const conversationHistory = await storage.getCallMessages(callSid);
      
      console.log('🧠 [OPENAI] Processing FRESH customer response with complete conversation context');
      let aiResponse: any;
      let openaiRequestStart = Date.now();
      
      // Build conversation messages with complete history for fresh response
      const messages: Array<{role: "system" | "user" | "assistant", content: string}> = [
        {
          role: "system" as const,
          content: `You are Aavika from LabsCheck calling pathology labs for partnership.

CRITICAL INSTRUCTION: Respond DIRECTLY to what the customer just said. DO NOT ignore their response.

IMPORTANT: You must acknowledge and respond to the customer's actual words. If they are rude, acknowledge it professionally. If they ask questions, answer them. If they confirm ownership, move forward.

CONVERSATION FLOW:
1. OPENING: "Hi I am Aavika from LabsCheck. Am I speaking with the owner of the lab? This is about listing your lab as a trusted laboratory in your location."

2. IF OWNER CONFIRMS (yes/haan/ji/owner): "Great! LabsCheck is India's first diagnostic aggregator platform providing trusted diagnostics at affordable prices. We partner with NABL accredited labs for better visibility and business. Are you interested?"

3. IF NOT OWNER: "Will it be possible for you to share the owner's email ID or WhatsApp number? Can I have your WhatsApp number? I will forward you details and you can share with the owner."

4. IF CUSTOMER IS RUDE/NEGATIVE: Acknowledge professionally: "I understand your concern. This is a genuine business opportunity for lab partnership. Would you like to know more or shall I call back later?"

5. IF CUSTOMER ASKS QUESTIONS: Answer their specific questions about LabsCheck, partnership benefits, commission structure, etc.

6. CLOSING: "For further understanding, I would request you to share your WhatsApp number and email ID so I shall share all information officially."

LANGUAGE MATCHING:
- Respond in the same language/style as customer
- Match their tone appropriately

CRITICAL RULES:
- ALWAYS respond to what customer actually said
- NEVER ignore customer's response  
- Progress conversation based on their actual words
- If conversation seems stuck, acknowledge and pivot appropriately

IMPORTANT: Always respond in JSON format exactly like this:
{"message": "your direct response to customer in same language", "collected_data": {"contact_person": "", "whatsapp_number": "", "email": "", "lab_name": ""}, "should_end": false}

RESPOND TO THEIR ACTUAL WORDS, NOT A SCRIPT.`
        }
      ];

      // Add ALL conversation history for complete context
      if (conversationHistory && conversationHistory.length > 0) {
        console.log(`📜 [FRESH-CONTEXT] Loading ALL ${conversationHistory.length} previous messages for complete context`);
        
        // Include ALL conversation history to ensure AI has complete context
        for (const msg of conversationHistory) {
          if (msg.role === 'assistant') {
            messages.push({
              role: "assistant" as const,
              content: `Previous AI response: ${msg.content}`
            });
          } else if (msg.role === 'user') {
            messages.push({
              role: "user" as const, 
              content: `Previous customer: ${msg.content}`
            });
          }
        }
      } else {
        console.log('📜 [FRESH-CONTEXT] No previous history - this is the first interaction');
      }

      // Add current customer message with emphasis
      messages.push({
        role: "user" as const,
        content: `CURRENT CUSTOMER RESPONSE: "${customerText}" - Respond directly to this.`
      });

      const requestPayload = {
        model: "gpt-4o" as const,
        messages,
        response_format: { type: "json_object" as const },
        temperature: 0.3
      };
      
      // Broadcast OpenAI request
      this.broadcastConversationEvent(callSid, 'openai_request', JSON.stringify(requestPayload, null, 2), {
        model: "gpt-4o",
        temperature: 0.3
      });
      
      const openaiResponse = await openai.chat.completions.create(requestPayload);
      
      const openaiProcessingTime = Date.now() - openaiRequestStart;
      
      // Validate OpenAI response structure
      if (!openaiResponse || !openaiResponse.choices || !Array.isArray(openaiResponse.choices) || openaiResponse.choices.length === 0) {
        throw new Error('Invalid OpenAI response structure');
      }
      
      const aiResponseContent = openaiResponse.choices[0]?.message?.content || '{}';
      
      // Broadcast OpenAI response
      this.broadcastConversationEvent(callSid, 'openai_response', aiResponseContent, {
        model: "gpt-4o",
        processingTime: openaiProcessingTime,
        tokens: openaiResponse.usage?.total_tokens || 0
      });
      
      // Parse AI response
      try {
        aiResponse = JSON.parse(aiResponseContent);
      } catch (parseError) {
        console.error('❌ [AI PARSE ERROR]:', parseError);
        aiResponse = {
          message: "Great! Can I get your WhatsApp number for partnership details?",
          should_end: false,
          collected_data: {}
        };
      }

      // Validate aiResponse structure to prevent crashes
      if (!aiResponse || typeof aiResponse !== 'object') {
        console.error('❌ [AI DATA] Invalid AI response structure');
        aiResponse = {
          message: "Great! Can I get your WhatsApp number for partnership details?",
          should_end: false,
          collected_data: {}
        };
      }

      // Ensure required fields exist
      if (!aiResponse.message) aiResponse.message = "Great! Can I get your WhatsApp number for partnership details?";
      if (!aiResponse.collected_data) aiResponse.collected_data = {};
      if (typeof aiResponse.should_end !== 'boolean') aiResponse.should_end = false;

      console.log(`🤖 [AI] Response: "${aiResponse.message}"`);
      
      // 5. Generate voice with ElevenLabs using campaign voice config
      let audioUrl = null;
      try {
        // Use campaign voice settings or fallback to default
        const voiceSettings = voiceConfig && voiceConfig.useElevenLabs ? {
          voiceId: voiceConfig.voiceId || '7w5JDCUNbeKrn4ySFgfu', // Use selected voice or Aavika default
          model: voiceConfig.model || 'eleven_multilingual_v2',
          stability: voiceConfig.stability || 0.5,
          similarityBoost: voiceConfig.similarityBoost || 0.75,
          style: voiceConfig.style || 0,
          useSpeakerBoost: voiceConfig.useSpeakerBoost || true,
        } : {
          voiceId: '7w5JDCUNbeKrn4ySFgfu', // Default Aavika voice
          model: 'eleven_multilingual_v2',
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          useSpeakerBoost: true,
        };
        
        const { elevenLabsService } = await import('./elevenLabsService');
        
        const voiceSynthesisStart = Date.now();
        console.log(`🎤 [VOICE-SYNTHESIS] Using voice settings:`, voiceSettings);
        const audioFilename = await elevenLabsService.generateAudioFile(aiResponse.message, voiceSettings);
        
        // Validate audio filename exists
        if (!audioFilename || typeof audioFilename !== 'string') {
          throw new Error('ElevenLabs returned invalid audio filename');
        }
        
        const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
        audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
        
        const voiceProcessingTime = Date.now() - voiceSynthesisStart;
        console.log(`🎵 [ELEVENLABS] Generated audio: ${audioUrl}`);
        
        // Broadcast voice synthesis event with actual voice settings used
        this.broadcastConversationEvent(callSid, 'voice_synthesis', aiResponse.message, {
          voiceId: voiceSettings.voiceId,
          model: voiceSettings.model,
          processingTime: voiceProcessingTime,
          audioUrl,
          campaignVoice: voiceConfig ? 'selected' : 'default'
        });
        
      } catch (ttsError) {
        console.error('❌ [ELEVENLABS] Error:', ttsError);
        this.broadcastConversationEvent(callSid, 'error', `Voice synthesis failed: ${(ttsError as Error).message}`);
        
        // CRITICAL: Do not fall back to different voice - instead try to retry with same voice or fail gracefully
        console.log('🔄 [VOICE-CONSISTENCY] ElevenLabs failed but maintaining voice consistency by not using fallback voice');
        audioUrl = null; // This will use the same voice settings in TwiML generation
      }
      
      // 6. Store conversation message history
      await this.saveConversationMessage(callSid, customerText, aiResponse.message);
      
      // 7. Store conversation data if collected
      if (aiResponse.collected_data && Object.keys(aiResponse.collected_data).length > 0) {
        await this.storeCollectedData(callSid, aiResponse.collected_data);
      }
      
      // 8. Generate TwiML response with typing sound and consistent voice settings
      const twimlResponse = this.generateTwiMLResponseWithTyping(audioUrl, aiResponse.message, aiResponse.should_end, callSid, voiceConfig);
      
      // 9. Cleanup temp file
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
  
  private generateTwiMLResponseWithTyping(audioUrl: string | null, message: string, shouldEnd: boolean, callSid: string, voiceConfig?: any): string {
    // Use consistent voice settings even in fallback scenarios
    const fallbackVoice = voiceConfig?.useElevenLabs ? 'alice' : 'alice'; // Keep consistent even for fallback
    
    // Generate typing sound URL
    const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
    const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
    const typingUrl = `${protocol}://${baseUrl}/api/typing-sound`;
    
    if (shouldEnd) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${typingUrl}</Play>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="${fallbackVoice}" language="en-IN">${message}</Say>`}
  <Hangup/>
</Response>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${typingUrl}</Play>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="${fallbackVoice}" language="en-IN">${message}</Say>`}
  <Record action="/api/twilio/fresh-recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
    }
  }

  private generateTwiMLResponse(audioUrl: string | null, message: string, shouldEnd: boolean, callSid: string, voiceConfig?: any): string {
    // Use consistent voice settings even in fallback scenarios
    const fallbackVoice = voiceConfig?.useElevenLabs ? 'alice' : 'alice'; // Keep consistent even for fallback
    if (shouldEnd) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="${fallbackVoice}" language="en-IN">${message}</Say>`}
  <Hangup/>
</Response>`;
    } else {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="${fallbackVoice}" language="en-IN">${message}</Say>`}
  <Record action="/api/twilio/fresh-recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
    }
  }

  private async downloadTwilioRecording(recordingUrl: string): Promise<Buffer> {
    const recordingId = recordingUrl.split('/').pop();
    console.log(`📞 [TWILIO-AUTH] Getting recording: ${recordingId}`);
    
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not found');
    }

    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    
    const response = await fetch(recordingUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download recording: ${response.status} ${response.statusText}`);
    }

    return Buffer.from(await response.arrayBuffer());
  }

  private async saveConversationMessage(callSid: string, userMessage: string, aiMessage: string) {
    try {
      const { storage } = await import('../storage');
      const calls = await storage.getCalls();
      const call = calls.find(c => c.twilioCallSid === callSid);
      
      if (call) {
        // Save user message
        await storage.createCallMessage({
          callId: call.id,
          role: 'user',
          content: userMessage,
        });
        
        // Save AI response
        await storage.createCallMessage({
          callId: call.id,
          role: 'assistant',
          content: aiMessage,
        });
        
        console.log(`💾 [CONVERSATION-HISTORY] Saved messages for call: ${callSid}`);
      } else {
        console.warn(`⚠️ [CONVERSATION-HISTORY] Call not found for SID: ${callSid}`);
      }
    } catch (error) {
      console.error('❌ [CONVERSATION-HISTORY] Error saving messages:', error);
    }
  }

  private async storeCollectedData(callSid: string, data: any): Promise<void> {
    // Merge with existing data for this call
    const existingData = this.collectedData.get(callSid) || {};
    const mergedData = { ...existingData, ...data };
    this.collectedData.set(callSid, mergedData);
    
    console.log(`💾 [STORE-DATA] Call: ${callSid}, Data:`, mergedData);
  }

  getStoredData(callSid: string): any {
    return this.collectedData.get(callSid) || {};
  }

  clearStoredData(callSid: string): void {
    this.collectedData.delete(callSid);
  }
}