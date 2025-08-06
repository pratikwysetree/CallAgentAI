import twilio from 'twilio';
import { storage } from '../storage';
import { elevenLabsService } from './elevenLabsService';

const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.TWILIO_TOKEN;
const phoneNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER;

if (!accountSid || !authToken || !phoneNumber) {
  throw new Error('Twilio credentials not found. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.');
}

const client = twilio(accountSid, authToken);

export interface CallOptions {
  to: string;
  campaignId: string;
  contactId?: string;
}

export class TwilioService {
  async initiateCall(options: CallOptions): Promise<string> {
    try {
      // Format phone number properly for Twilio
      let formattedNumber = options.to;
      if (!options.to.startsWith('+')) {
        // Handle Indian numbers - if starts with 91, add +
        if (options.to.startsWith('91') && options.to.length === 12) {
          formattedNumber = `+${options.to}`;
        }
        // If starts with 9 and length 10, assume Indian number
        else if (options.to.startsWith('9') && options.to.length === 10) {
          formattedNumber = `+91${options.to}`;
        }
        // Otherwise add + if it's a full international number
        else if (options.to.length > 10) {
          formattedNumber = `+${options.to}`;
        }
      }
      
      console.log(`Initiating call from ${phoneNumber} to ${formattedNumber} for campaign ${options.campaignId}`);
      
      // Create webhook URL for TwiML
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
      const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
      const webhookUrl = `${protocol}://${baseUrl}/api/twilio/voice`;

      const call = await client.calls.create({
        to: formattedNumber,
        from: phoneNumber!,
        url: `${webhookUrl}?campaignId=${options.campaignId}&contactId=${options.contactId || ''}`,
        statusCallback: `${protocol}://${baseUrl}/api/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
      });

      console.log(`Call initiated successfully. SID: ${call.sid}`);

      // Store call in database
      const callRecord = await storage.createCall({
        contactId: options.contactId,
        campaignId: options.campaignId,
        phoneNumber: formattedNumber,
        status: 'active',
        twilioCallSid: call.sid,
      });

      return call.sid;
    } catch (error: any) {
      console.error('Error initiating call:', error);
      
      // Provide more specific error messages
      if (error.code === 21219) {
        throw new Error(`Phone number ${options.to} is not verified. For Twilio trial accounts, you need to verify phone numbers in the Twilio Console first. Go to Twilio Console > Phone Numbers > Verified Caller IDs to add this number.`);
      } else if (error.code === 21215) {
        throw new Error('Invalid phone number format. Please check the number and try again.');
      } else if (error.code === 21210) {
        throw new Error('Phone number is not a valid mobile number or is unreachable.');
      } else {
        throw new Error(`Failed to initiate call: ${error.message}`);
      }
    }
  }

  // Send WhatsApp message
  async sendWhatsAppMessage(to: string, message: string): Promise<{ success: boolean; messageSid?: string }> {
    try {
      const result = await client.messages.create({
        body: message,
        from: `whatsapp:${phoneNumber}`,
        to: to,
      });

      return { success: true, messageSid: result.sid };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return { success: false };
    }
  }

  async endCall(twilioCallSid: string): Promise<void> {
    try {
      await client.calls(twilioCallSid).update({ status: 'completed' });
      
      // Update call status in database
      const call = await storage.getCallByTwilioSid(twilioCallSid);
      if (call) {
        await storage.updateCall(call.id, {
          status: 'completed',
          endTime: new Date(),
        });
      }
    } catch (error) {
      console.error('Error ending call:', error);
      throw new Error('Failed to end call');
    }
  }

  async getCallStatus(twilioCallSid: string): Promise<string> {
    try {
      const call = await client.calls(twilioCallSid).fetch();
      return call.status;
    } catch (error) {
      console.error('Error getting call status:', error);
      throw new Error('Failed to get call status');
    }
  }

  /**
   * Generate TwiML with speech recognition (no recordings)
   */
  async generateSpeechTwiML(message: string): Promise<string> {
    console.log(`🎤 [SPEECH MODE] Using Gather instead of Record - No delays!`);
    
    const voice = "alice";
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="${voice}">${this.escapeXML(message)}</Say>
    <Gather input="speech" action="/api/twilio/speech-result" speechTimeout="4" language="en-IN">
        <Pause length="6"/>
        <Say voice="${voice}">Please tell me about your business</Say>
    </Gather>
</Response>`;
  }

  async generateTwiML(message: string, campaignId?: string): Promise<string> {
    try {
      // Detect language of AI response to match customer's language for ElevenLabs
      const detectLanguage = (text: string): 'hindi' | 'english' | 'mixed' => {
        const hindiWords = (text.match(/\b(namaste|kya|haan|nahi|theek|accha|matlab|samjha|mera|aap|kaise|main|hai|hoon|se|ka|ke|ki|ko|me|pe|par|aur|ya|jo|kuch|koi|kyun|kahan|kab|kaun|kaam|ghar|office|paisa|free|partner|company|whatsapp|gmail|call|calling|business|lab|pathology|doctor|hospital|test|checkup|report|result|medical|health|busy|time|dhanyawad|thank|english|hindi|boliye|suniye|bataye|dijiye|milega|hoga|karenge|karte|dete|lete|denge|lenge|bhej|send|message|details|labscheck)\b/gi) || []).length;
        const englishWords = (text.match(/\b(hello|hi|what|yes|no|good|okay|my|you|how|i|am|is|are|the|and|or|that|some|any|why|where|when|who|work|home|office|money|free|partner|company|whatsapp|gmail|call|calling|business|lab|pathology|doctor|hospital|test|checkup|report|result|medical|health|busy|time|thank|thanks|english|hindi|speak|tell|give|will|can|get|send|message|details|labscheck)\b/gi) || []).length;
        
        if (hindiWords > englishWords) return 'hindi';
        if (englishWords > hindiWords) return 'english';
        return 'mixed';
      };

      const responseLanguage = detectLanguage(message);
      console.log(`🌐 [AI RESPONSE LANGUAGE] Detected: ${responseLanguage.toUpperCase()} for message: "${message}"`);

      // Check if campaign has specific voice configuration
      let voiceConfig = null;
      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        voiceConfig = campaign?.voiceConfig;
      }

      // Check for ElevenLabs TTS first (premium option)
      if (voiceConfig && (voiceConfig as any)?.useElevenLabs) {
        console.log(`🎤 [ELEVENLABS] ACTIVATED - Using ElevenLabs premium TTS!`);
        console.log(`🎤 [ELEVENLABS] Voice ID: ${(voiceConfig as any).voiceId}, Model: ${(voiceConfig as any).model}`);
        console.log(`🎤 [ELEVENLABS] Message: "${message}"`);
        
        try {
          const audioFilename = await elevenLabsService.generateAudioFile(message, {
            voiceId: (voiceConfig as any).voiceId,
            model: (voiceConfig as any).model || 'eleven_monolingual_v1',
            stability: (voiceConfig as any).stability || 0.5,
            similarityBoost: (voiceConfig as any).similarityBoost || 0.75,
            style: (voiceConfig as any).style || 0,
            useSpeakerBoost: (voiceConfig as any).useSpeakerBoost || true,
          });
          
          const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
          const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
          const audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
          
          console.log(`🎤 [ELEVENLABS] SUCCESS - Premium audio generated: ${audioUrl}`);
          console.log(`🎤 [ELEVENLABS] Using <Play> tag for ElevenLabs voice synthesis!`);
          
          return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioUrl}</Play>
    <Pause length="0.1"/>
    <Record action="/api/twilio/record" maxLength="10" timeout="2" playBeep="false" recordingStatusCallback="/api/twilio/recording-status" />
</Response>`;
        } catch (error) {
          console.error('🎤 [ELEVENLABS] ERROR:', error);
          console.log('🎤 [ELEVENLABS] Falling back to Twilio voice');
        }
      } else {
        console.log(`🎤 [TWILIO-VOICE] Using Twilio's built-in English voice - ElevenLabs not configured`);
      }

      // Fallback to Twilio's built-in voice synthesis with Whisper recording
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-IN" rate="fast">${message}</Say>
    <Pause length="0.1"/>
    <Record action="/api/twilio/record" maxLength="10" timeout="2" playBeep="false" recordingStatusCallback="/api/twilio/recording-status" />
</Response>`;
    } catch (error) {
      console.error('Error generating TwiML:', error);
      // Fallback to simple TwiML with recording
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" rate="fast">${message}</Say>
    <Pause length="0.1"/>
    <Record action="/api/twilio/record" maxLength="10" timeout="2" playBeep="false" recordingStatusCallback="/api/twilio/recording-status" />
</Response>`;
    }
  }

  async generateHangupTwiML(campaignId?: string): Promise<string> {
    try {
      const goodbyeMessage = "Thank you for your time. Goodbye!";
      
      // Check if campaign has voice configuration
      let voiceConfig = null;
      if (campaignId) {
        const campaign = await storage.getCampaign(campaignId);
        voiceConfig = campaign?.voiceConfig;
      }
      
      // Check for ElevenLabs TTS first
      if (voiceConfig && (voiceConfig as any)?.useElevenLabs) {
        console.log(`🎤 [ELEVENLABS] Generating goodbye message with ElevenLabs TTS`);
        
        try {
          const audioFilename = await elevenLabsService.generateAudioFile(goodbyeMessage, {
            voiceId: (voiceConfig as any).voiceId,
            model: (voiceConfig as any).model || 'eleven_monolingual_v1',
            stability: (voiceConfig as any).stability || 0.5,
            similarityBoost: (voiceConfig as any).similarityBoost || 0.75,
            style: (voiceConfig as any).style || 0,
            useSpeakerBoost: (voiceConfig as any).useSpeakerBoost || true,
          });
          
          const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
          const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
          const audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
          
          console.log(`🎤 [ELEVENLABS] Goodbye message generated: ${audioUrl}`);
          
          return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioUrl}</Play>
    <Hangup/>
</Response>`;
        } catch (error) {
          console.error('🎤 [ELEVENLABS] Error generating goodbye:', error);
        }
      }


      // Default fallback
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${goodbyeMessage}</Say>
    <Hangup/>
</Response>`;
    } catch (error) {
      console.error('Error generating hangup TwiML:', error);
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for your time. Goodbye!</Say>
    <Hangup/>
</Response>`;
    }
  }
}

export const twilioService = new TwilioService();
