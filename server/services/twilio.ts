import twilio from 'twilio';
import { storage } from '../storage';

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
      // Create webhook URL for TwiML
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
      const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
      const webhookUrl = `${protocol}://${baseUrl}/api/twilio/voice`;

      const call = await client.calls.create({
        to: options.to,
        from: phoneNumber!,
        url: `${webhookUrl}?campaignId=${options.campaignId}&contactId=${options.contactId || ''}`,
        statusCallback: `${protocol}://${baseUrl}/api/twilio/status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
      });

      // Store call in database
      const callRecord = await storage.createCall({
        contactId: options.contactId,
        campaignId: options.campaignId,
        phoneNumber: options.to,
        status: 'active',
        twilioCallSid: call.sid,
      });

      return call.sid;
    } catch (error) {
      console.error('Error initiating call:', error);
      throw new Error('Failed to initiate call');
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

  generateTwiML(message: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">${message}</Say>
    <Gather input="speech" action="/api/twilio/gather" speechTimeout="3" timeout="10">
        <Say voice="alice">Please respond when you're ready.</Say>
    </Gather>
</Response>`;
  }

  generateHangupTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice">Thank you for your time. Goodbye!</Say>
    <Hangup/>
</Response>`;
  }
}

export const twilioService = new TwilioService();
