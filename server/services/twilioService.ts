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

      // Create webhook URL for handling call events
      const webhookUrl = `${process.env.REPL_URL || 'https://localhost:5000'}/api/calls/webhook`;
      
      const call = await this.client.calls.create({
        to: phoneNumber,
        from: fromNumber,
        url: `${webhookUrl}?callId=${callId}&campaignId=${campaignId}`,
        statusCallback: `${webhookUrl}/status?callId=${callId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: true, // Record the call
        recordingStatusCallback: `${webhookUrl}/recording?callId=${callId}`,
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

  // Generate TwiML for call handling
  generateTwiML(action: 'gather' | 'say' | 'hangup', options: any = {}): string {
    const VoiceResponse = twilio.twiml.VoiceResponse;
    const twiml = new VoiceResponse();

    switch (action) {
      case 'say':
        twiml.say({
          voice: 'alice',
          language: 'en-IN'
        }, options.text || 'Hello');
        break;
        
      case 'gather':
        const gather = twiml.gather({
          input: 'speech',
          timeout: 10,
          speechTimeout: 'auto',
          speechModel: 'experimental_conversations',
          enhanced: true,
          language: 'en-IN',
          action: options.action || '/api/calls/process-speech',
          method: 'POST'
        });
        
        if (options.text) {
          gather.say({
            voice: 'alice',
            language: 'en-IN'
          }, options.text);
        }
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