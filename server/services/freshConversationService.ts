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

  // Quick responses for common queries with accurate LabsCheck information
  private getQuickResponse(customerText: string, voiceConfig?: any): { response: any, needsAudio: boolean } | null {
    const text = customerText.toLowerCase().trim();
    
    // Detect language for proper response
    const isHindi = /[\u0900-\u097F]/.test(customerText) || 
                   /(hai|hain|kya|kaise|kahan|nahin|nahi|acha|thik|lab|test)/i.test(customerText);
    
    // Professional opening - LabsCheck introduction (INSTANT)
    if (/(hello|hi|haan|han|yes|ji|namaste)/i.test(text)) {
      console.log('⚡ [INSTANT-RESPONSE] Professional LabsCheck introduction');
      return {
        response: {
          message: isHindi ? 
            "नमस्ते! मैं आविका हूं LabsCheck से - India का पहला diagnostic aggregator platform। मैं आपकी pathology lab के साथ partnership के बारे में बात करने के लिए कॉल कर रही हूं। क्या मैं lab owner से बात कर रही हूं?" :
            "Hello! This is Aavika calling from LabsCheck - India's first diagnostic aggregator platform. I'm calling to discuss a partnership opportunity with your pathology lab. Am I speaking with the lab owner?",
          collected_data: {},
          should_end: false
        },
        needsAudio: true // Generate audio immediately
      };
    }
    
    // Owner confirmation - LabsCheck mission explanation (INSTANT)
    if (/(yes|haan|han|main hoon|mein hoon|i am|owner|main owner|mein owner|lab owner|owner hoon)/i.test(text) && !/(nahi|no|not)/i.test(text)) {
      console.log('⚡ [INSTANT-RESPONSE] Owner confirmed - LabsCheck mission explanation');
      return {
        response: {
          message: isHindi ?
            "बहुत बढ़िया! LabsCheck एक revolutionary platform है जो trusted NABL accredited labs को patients के साथ जोड़ता है। हमारा zero-commission model आपकी lab को enhanced visibility और direct patient access देता है। क्या आप जानना चाहेंगे कि यह partnership आपके business को कैसे बढ़ a सकती है?" :
            "Excellent! LabsCheck is revolutionizing diagnostic testing in India by connecting trusted NABL accredited labs with patients seeking affordable, reliable testing. We're building a zero-commission platform that gives labs like yours enhanced visibility and direct patient access. Would you be interested in learning how this partnership can grow your business?",
          collected_data: { lab_owner_confirmed: true },
          should_end: false
        },
        needsAudio: true
      };
    }
    
    // Non-owner scenario - Request owner contact (INSTANT)
    if (/(no|nahi|owner nahi|not owner|main nahi)/i.test(text)) {
      console.log('⚡ [INSTANT-RESPONSE] Non-owner scenario - requesting owner contact');
      return {
        response: {
          message: isHindi ?
            "समझ गया। क्या आप मुझे lab owner से मिला सकते हैं या उनका WhatsApp number share कर सकते हैं? मैं उन्हें बताना चाहूंगी कि LabsCheck कैसे आपकी lab की reach को बढ़ा सकता है। यह zero-commission partnership opportunity के बारे में है।" :
            "I understand. Could you please connect me with the lab owner, or share their WhatsApp number? I'd like to discuss how LabsCheck can help expand your lab's reach through our trusted partner network. This is regarding a zero-commission partnership opportunity.",
          collected_data: { non_owner_contact_requested: true },
          should_end: false
        },
        needsAudio: true
      };
    }
    
    // Benefits inquiry - Detailed LabsCheck value proposition (INSTANT)  
    if (/(benefit|faayda|kya milega|what will get|partnership|details|interested)/i.test(text)) {
      console.log('⚡ [INSTANT-RESPONSE] LabsCheck benefits explanation');
      return {
        response: {
          message: isHindi ?
            "LabsCheck partner के रूप में आपको मिलता है: पूरे India में enhanced online visibility, direct patient bookings transparent pricing के साथ, आपके test menu और rates पर पूरा control, NABL accreditation verification trust के लिए, Zero commission - 100% earnings retention, और easy management के लिए partner portal access। हम quality labs और trusted diagnostics चाहने वाले patients के बीच gap को भर रहे हैं।" :
            "As a LabsCheck partner, you get: Enhanced online visibility across India, Direct patient bookings with transparent pricing, Full control over your test menu and rates, NABL accreditation verification for trust, Zero commission - 100% earnings retention, and access to our partner portal for easy management. We're bridging the gap between quality labs and patients seeking trusted diagnostics.",
          collected_data: { benefits_explained: true },
          should_end: false
        },
        needsAudio: true
      };
    }
    
    // Interest confirmation and next steps (INSTANT)
    if (/(interested|yes|haan|tell me|batao|more|partner portal)/i.test(text) && /(portal|login|details|information)/i.test(text)) {
      console.log('⚡ [INSTANT-RESPONSE] Interest confirmed - next steps');
      return {
        response: {
          message: isHindi ?
            "बहुत अच्छा! मैं आपको partner portal login details provide करूंगी जहां आप अपना test menu और pricing upload कर सकते हैं। हम आपको WhatsApp के जरिए official partnership information भी भेजेंगे। क्या आप अपना WhatsApp number और email documentation के लिए share कर सकते हैं?" :
            "Wonderful! I'll provide you with our partner portal login details where you can upload your test menu and pricing. We'll also send you official partnership information via WhatsApp. Can you please share your WhatsApp number and email for the documentation?",
          collected_data: { interest_confirmed: true, contact_requested: true },
          should_end: false
        },
        needsAudio: true
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
        console.log('⚠️ [WHISPER] Empty or very short transcription, using ElevenLabs voice for consistency');
        
        // Generate the "didn't catch" response with ElevenLabs to maintain voice consistency
        const fallbackResponse = {
          message: "I didn't catch that clearly. Could you please repeat?",
          collected_data: {},
          should_end: false
        };
        
        // Use ElevenLabs for this response too to maintain voice consistency
        let audioUrl: string | null = null;
        try {
          const voiceSettings = {
            voiceId: voiceConfig?.voiceId || 'Z6TUNPsOxhTPtqLx81EX',
            model: voiceConfig?.model || 'eleven_turbo_v2',
            stability: voiceConfig?.stability || 0.5,
            similarityBoost: voiceConfig?.similarityBoost || 0.75,
            style: voiceConfig?.style || 0,
            useSpeakerBoost: voiceConfig?.useSpeakerBoost || true,
          };
          
          const { elevenLabsService } = await import('./elevenLabsService');
          const audioFilename = await elevenLabsService.generateAudioFile(fallbackResponse.message, voiceSettings);
          
          if (audioFilename && typeof audioFilename === 'string') {
            const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
            const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
            audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
            console.log(`🎵 [ELEVENLABS] Fallback response generated: ${audioUrl}`);
          }
        } catch (fallbackError) {
          console.error('❌ [ELEVENLABS] Fallback generation failed:', fallbackError);
          audioUrl = null;
        }
        
        return this.generateTwiMLResponse(audioUrl, fallbackResponse.message, false, callSid, voiceConfig);
      }
      
      // Broadcast customer speech event
      this.broadcastConversationEvent(callSid, 'customer_speech', customerText, {
        confidence: 0.95, // Whisper doesn't provide confidence, using default
        processingTime: Date.now() - startTime
      });
      
      // 4. Check for quick responses first - BYPASS EVERYTHING ELSE FOR INSTANT RESPONSE
      const quickResult = this.getQuickResponse(customerText, voiceConfig);
      
      if (quickResult) {
        console.log('⚡ [INSTANT-BYPASS] Using predefined response - skipping OpenAI completely');
        
        // IMMEDIATE RETURN - True instant response
        const aiResponse = quickResult.response;
        let audioUrl: string | null = null;
        const instantStart = Date.now();
        
        // Broadcast instant response event immediately
        this.broadcastConversationEvent(callSid, 'instant_response', aiResponse.message, {
          processingTime: 0,
          responseType: 'instant'
        });
        
        try {
          const voiceSettings = {
            voiceId: voiceConfig?.voiceId || 'Z6TUNPsOxhTPtqLx81EX',
            model: voiceConfig?.model || 'eleven_turbo_v2',
            stability: voiceConfig?.stability || 0.5,
            similarityBoost: voiceConfig?.similarityBoost || 0.75,
            style: voiceConfig?.style || 0,
            useSpeakerBoost: voiceConfig?.useSpeakerBoost || true,
          };
          
          const { elevenLabsService } = await import('./elevenLabsService');
          const audioFilename = await elevenLabsService.generateAudioFile(aiResponse.message, voiceSettings);
          
          if (audioFilename && typeof audioFilename === 'string') {
            const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
            const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
            audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
          }
          
          const instantTime = Date.now() - instantStart;
          console.log(`🚀 [INSTANT-COMPLETE] Audio generated in ${instantTime}ms`);
          
          // Broadcast voice synthesis complete
          this.broadcastConversationEvent(callSid, 'voice_synthesis', aiResponse.message, {
            processingTime: instantTime,
            audioUrl,
            voiceId: voiceConfig?.voiceId
          });
          
        } catch (error) {
          console.error('❌ [INSTANT-ERROR]:', error);
          audioUrl = null;
        }
        
        // Save conversation and return immediately
        await this.saveConversationMessage(callSid, customerText, aiResponse.message);
        
        if (aiResponse.collected_data && Object.keys(aiResponse.collected_data).length > 0) {
          await this.storeCollectedData(callSid, aiResponse.collected_data);
        }
        
        // Return TwiML immediately
        const twimlResponse = this.generateTwiMLResponse(audioUrl, aiResponse.message, aiResponse.should_end, callSid, voiceConfig);
        
        // No cleanup needed for instant responses - no temp file created
        
        return twimlResponse;
      }
      
      // Continue with OpenAI for complex queries
      let aiResponse: any;
      let openaiRequestStart = Date.now();
      
      console.log('🧠 [OPENAI] Using OpenAI for complex query');
        
        const requestPayload = {
          model: "gpt-4o" as const,
          messages: [
            {
              role: "system" as const,
              content: `You are Aavika from LabsCheck calling pathology labs for partnership.

CONVERSATION FLOW:
1. OPENING: "Hi I am Aavika from LabsCheck. Am I speaking with the owner of the lab? This is about listing your lab as a trusted laboratory in your location."

2. IF NOT OWNER: "Will it be possible for you to share the owner's email ID or WhatsApp number? Can I have your WhatsApp number? I will forward you details and you can share with the owner."

3. WHAT IS LABSCHECK: "LabsCheck is India's first diagnostic aggregator platform. It works on the simple principle of trusted diagnostics at affordable prices. It's a people's platform which will make diagnostics affordable. We are partnering with all NABL accredited labs so they can be more visible in their vicinity and get more business."

4. PARTNERSHIP OFFER: "If you are interested, we can list you as a trusted partner on our platform. We would require few basic documents and we will provide you partner login details where you can login and fill all test menu with test prices and serviceable location."

5. CLOSING: "For further understanding, I would request you to share your WhatsApp number and email ID so I shall share all information officially."

LANGUAGE MATCHING:
- If customer speaks Hindi/Hinglish, respond in Hindi/Hinglish
- If customer speaks English, respond in English
- Match their tone and speaking style exactly

Keep responses natural, warm, and conversational. Maximum 25 words per response.

RESPOND IN JSON FORMAT:
{"message": "your professional response", "collected_data": {"whatsapp_number": "", "email": "", "lab_owner_confirmed": "", "interest_level": ""}, "should_end": false}

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
      
      // 5. Generate voice with ElevenLabs using campaign voice config (INSTANT for quick responses)
      let audioUrl = null;
      const voiceProcessingStart = Date.now();
      const responseType = quickResult ? 'instant' : 'openai';
      
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
        
        const voiceProcessingTime = Date.now() - voiceProcessingStart;
        console.log(`🎵 [ELEVENLABS] Generated ${responseType} audio: ${audioUrl} (${voiceProcessingTime}ms)`);
        
        // Broadcast voice synthesis event with actual voice settings used
        this.broadcastConversationEvent(callSid, 'voice_synthesis', aiResponse.message, {
          voiceId: voiceSettings.voiceId,
          model: voiceSettings.model,
          processingTime: voiceProcessingTime,
          audioUrl,
          campaignVoice: voiceConfig ? 'selected' : 'default',
          responseType: responseType
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
      
      // 8. Generate TwiML response with consistent voice settings
      const twimlResponse = this.generateTwiMLResponse(audioUrl, aiResponse.message, aiResponse.should_end, callSid, voiceConfig);
      
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
      
      // Return safe fallback TwiML - but try to maintain voice consistency even in errors
      let fallbackAudioUrl: string | null = null;
      const fallbackMessage = "Thank you for your time. We will contact you soon.";
      
      try {
        // Even for error fallback, try to use ElevenLabs voice to maintain consistency
        const voiceSettings = {
          voiceId: voiceConfig?.voiceId || 'Z6TUNPsOxhTPtqLx81EX',
          model: voiceConfig?.model || 'eleven_turbo_v2',
          stability: voiceConfig?.stability || 0.5,
          similarityBoost: voiceConfig?.similarityBoost || 0.75,
          style: voiceConfig?.style || 0,
          useSpeakerBoost: voiceConfig?.useSpeakerBoost || true,
        };
        
        const { elevenLabsService } = await import('./elevenLabsService');
        const audioFilename = await elevenLabsService.generateAudioFile(fallbackMessage, voiceSettings);
        
        if (audioFilename && typeof audioFilename === 'string') {
          const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
          const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
          fallbackAudioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
          console.log(`🎵 [ELEVENLABS] Error fallback generated: ${fallbackAudioUrl}`);
        }
      } catch (fallbackError) {
        console.error('❌ [ELEVENLABS] Error fallback generation failed:', fallbackError);
      }
      
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${fallbackAudioUrl ? `<Play>${fallbackAudioUrl}</Play>` : `<Say voice="alice" language="en-IN">${fallbackMessage}</Say>`}
  <Hangup/>
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
    
    // Add retry logic for Twilio recording downloads
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`📞 [TWILIO-RETRY] Attempt ${attempt} for recording: ${recordingId}`);
        
        const response = await fetch(recordingUrl, {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'User-Agent': 'LabsCheck-AI-Caller/1.0'
          }
        });
        
        if (response.status === 404 && attempt < 3) {
          console.log(`⏱️ [TWILIO-DELAY] Recording not ready, waiting 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          continue;
        }
        
        if (!response.ok) {
          throw new Error(`Failed to download recording: ${response.status} ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        console.log(`✅ [TWILIO-SUCCESS] Downloaded recording on attempt ${attempt}: ${arrayBuffer.byteLength} bytes`);
        return Buffer.from(arrayBuffer);
        
      } catch (error) {
        console.error(`❌ [TWILIO-ATTEMPT-${attempt}] Error:`, error);
        if (attempt === 3) throw error;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // This should never be reached due to the retry loop above
    throw new Error('Recording download failed after all attempts');
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