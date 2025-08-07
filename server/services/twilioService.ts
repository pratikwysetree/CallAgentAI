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

      // Create webhook URL for handling call events - use Replit domain
      const replitDomain = process.env.REPLIT_DOMAINS ? 
        `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 
        `https://${process.env.REPL_SLUG || 'app'}.${process.env.REPL_OWNER || 'user'}.repl.co`;
      const webhookUrl = `${replitDomain}/api/calls/webhook`;
      
      console.log(`🔗 Using webhook URL: ${webhookUrl}`); // Debug log
      
      const call = await this.client.calls.create({
        to: phoneNumber,
        from: fromNumber,
        url: `${webhookUrl}?callId=${callId}&campaignId=${campaignId}`,
        statusCallback: `${webhookUrl}/status?callId=${callId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true, // Record for Google Speech processing
        recordingStatusCallback: `${webhookUrl}/recording?callId=${callId}`,
        recordingChannels: 'dual', // Separate channels for better processing
        recordingStatusCallbackEvent: ['completed']
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

  // Generate TwiML for call handling with background typing simulation
  generateTwiML(action: 'gather' | 'say' | 'hangup', options: any = {}): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    // Add thinking pause with typing sounds for natural conversation flow
    if (options.addTypingSound && action === 'gather') {
      console.log('🎹 Simulating background typing sounds in TwiML generation');
      // Add a small pause to simulate typing/thinking
      twiml.pause({ length: 1 });
    }

    switch (action) {
      case 'say':
        twiml.say({
          voice: 'alice',
          language: 'en-IN'
        }, options.text || 'Hello');
        break;
        
      case 'gather':
        // Use simple pause and record instead of Twilio speech recognition
        const gather = twiml.gather({
          input: 'dtmf', // Just for key presses, not speech
          timeout: 1, // Short timeout to proceed to recording quickly
          numDigits: 1,
          action: options.action || '/api/calls/process-speech',
          method: 'POST'
        });
        
        if (options.text) {
          // Add subtle pause before speaking to simulate thinking/typing
          if (options.addTypingSound) {
            gather.pause({ length: 0.5 });
          }
          
          gather.say({
            voice: 'alice',
            language: 'en-IN'
          }, options.text);
        }
        
        // After speaking, record user response for Google Speech processing
        twiml.record({
          maxLength: 30, // Max 30 seconds per response
          timeout: 3, // Stop recording after 3 seconds of silence
          transcribe: false, // We'll use Google Speech instead
          action: options.recordAction || '/api/calls/process-recording',
          method: 'POST',
          recordingStatusCallback: options.recordingCallback || '/api/calls/recording-complete',
          recordingStatusCallbackMethod: 'POST'
        });
        break;
        
      case 'hangup':
        if (options.text) {
          twiml.say({
            voice: 'alice',
            language: 'en-IN'
          }, options.text);
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