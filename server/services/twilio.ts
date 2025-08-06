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

  async generateTwiML(message: string, campaignId?: string): Promise<string> {
    try {
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
    <Pause length="1"/>
    <Gather input="speech" action="/api/twilio/gather" speechTimeout="3" timeout="10" language="en-IN" enhanced="true" profanityFilter="false"/>
</Response>`;
        } catch (error) {
          console.error('🎤 [ELEVENLABS] ERROR:', error);
          console.log('🎤 [ELEVENLABS] Falling back to Twilio voice');
        }
      } else {
        console.log(`🎤 [TWILIO-VOICE] Using Twilio's built-in English voice - ElevenLabs not configured`);
      }

      // Fallback to Twilio's built-in voice synthesis for conversational flow
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-IN" rate="medium">${message}</Say>
    <Pause length="1"/>
    <Gather input="speech" action="/api/twilio/gather" speechTimeout="3" timeout="10" language="en-IN" enhanced="true" profanityFilter="false"/>
</Response>`;
    } catch (error) {
      console.error('Error generating TwiML:', error);
      // Fallback to simple TwiML
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${message}</Say>
    <Gather input="speech" action="/api/twilio/gather" speechTimeout="3" timeout="10">
        <Say voice="alice">Please respond when you're ready.</Say>
    </Gather>
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
