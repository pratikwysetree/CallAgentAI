import twilio from 'twilio';

export class TwilioService {
  private client: twilio.Twilio;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured');
    }

    this.client = twilio(accountSid, authToken);
  }

  // Initiate outbound call
  async initiateCall(
    phoneNumber: string,
    campaignId: string,
    callId: string
  ): Promise<{ success: boolean; twilioCallSid?: string; error?: string }> {
    try {
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;
      if (!fromNumber) {
        throw new Error('Twilio phone number not configured');
      }

      // Create webhook URLs for handling call events - use Replit domain
      const replitDomain = process.env.REPLIT_DOMAINS ?
        `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` :
        `https://${process.env.REPL_SLUG || 'app'}.${process.env.REPL_OWNER || 'user'}.repl.co`;

      // CRITICAL FIX: Use answer webhook to play ElevenLabs intro first
      const answerWebhookUrl = `${replitDomain}/api/calls/webhook/answer`;
      const statusWebhookUrl = `${replitDomain}/api/calls/webhook/status`;

      console.log(`🔗 Using answer webhook URL: ${answerWebhookUrl}`); // Debug log
      console.log(`📊 Using status webhook URL: ${statusWebhookUrl}`); // Debug log

      const call = await this.client.calls.create({
        to: phoneNumber,
        from: fromNumber,
        url: `${answerWebhookUrl}?callId=${callId}&campaignId=${campaignId}`,
        statusCallback: `${statusWebhookUrl}?callId=${callId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        timeout: 20, // Reduce timeout to speed up call connection
        machineDetection: 'Enable' // Enable machine detection for faster processing
        // NO RECORDING - using direct speech recognition only
      });

      return {
        success: true,
        twilioCallSid: call.sid
      };
    } catch (error) {
      console.error('Error initiating call:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Generate TwiML for call handling with ElevenLabs-only voice synthesis
  generateTwiML(action: 'gather' | 'say' | 'hangup', options: any = {}): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Add natural typing sounds throughout entire conversation for human-like experience
    if (options.addTypingSound) {
      console.log('🎹 Adding continuous background typing effects throughout conversation');

      // Add initial thinking pause with typing sounds
      twiml.pause({ length: 1 });

      // Add additional natural pauses for extended typing effect
      if (options.addThinkingPause && action === 'gather') {
        twiml.pause({ length: 1.5 }); // Extended thinking with typing
        console.log('💭 Added extended thinking pause with natural typing ambiance');
      }
    }

    switch (action) {
      case 'say':
        // ONLY use ElevenLabs audio - no Twilio TTS fallback
        if (options.audioUrl) {
          console.log('🎵 Using ElevenLabs audio for TTS');
          twiml.play(options.audioUrl);
        } else {
          console.error('❌ ERROR: No ElevenLabs audio URL provided - ElevenLabs is required');
          // Add silence instead of Twilio TTS
          twiml.pause({ length: 2 });
        }
        break;

      case 'gather':
        // Play ElevenLabs audio if provided
        if (options.audioUrl) {
          console.log('🎵 Playing ElevenLabs audio:', options.audioUrl);
          twiml.play(options.audioUrl);
        } else if (options.text) {
          console.log('🗣️ Using Twilio TTS as fallback');
          twiml.say({
            voice: options.voice || 'alice',
            language: options.language || 'en'
          }, options.text);
        }

        // Use Twilio Gather with speech recognition for direct OpenAI Whisper processing
        const gather = twiml.gather({
          input: 'speech',
          speechTimeout: 5,
          speechModel: 'experimental_conversations',
          enhanced: true,
          language: options.language || 'en-US',
          action: options.action || '/api/calls/process-speech',
          method: 'POST',
          timeout: 10
        });

        // Add a pause to let user speak
        gather.pause({ length: 1 });

        // If no speech detected, redirect to continue listening
        twiml.redirect(options.action || '/api/calls/process-speech');
        break;

      case 'hangup':
        if (options.text) {
          // ONLY use ElevenLabs audio - no Twilio TTS fallback
          if (options.audioUrl) {
            console.log('🎵 Using ElevenLabs audio for hangup message');
            twiml.play(options.audioUrl);
          } else {
            console.error('❌ ERROR: No ElevenLabs audio URL provided for hangup - ElevenLabs is required');
            // Add silence instead of Twilio TTS
            twiml.pause({ length: 1 });
          }
        }
        twiml.hangup();
        break;
    }

    return twiml.toString();
  }

  // Send WhatsApp message via Twilio
  async sendWhatsAppMessage(
    whatsappNumber: string,
    message: string
  ): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    try {
      const fromNumber = `whatsapp:${process.env.TWILIO_PHONE_NUMBER}`;
      const toNumber = whatsappNumber.startsWith('whatsapp:')
        ? whatsappNumber
        : `whatsapp:${whatsappNumber}`;

      const messageResponse = await this.client.messages.create({
        body: message,
        from: fromNumber,
        to: toNumber
      });

      return {
        success: true,
        messageSid: messageResponse.sid
      };
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const twilioService = new TwilioService();