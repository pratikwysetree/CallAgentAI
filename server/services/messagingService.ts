import { twilioService } from './twilio';

export class MessagingService {
  // Send WhatsApp message
  static async sendWhatsAppMessage(
    whatsappNumber: string, 
    message: string, 
    callSummary?: string
  ): Promise<boolean> {
    try {
      // Format WhatsApp number
      const formattedNumber = whatsappNumber.startsWith('whatsapp:') 
        ? whatsappNumber 
        : `whatsapp:${whatsappNumber}`;

      // Create personalized message
      const personalizedMessage = callSummary 
        ? `${message}\n\nCall Summary: ${callSummary}`
        : message;

      // Send via Twilio WhatsApp API
      const result = await twilioService.sendWhatsAppMessage(
        formattedNumber,
        personalizedMessage
      );

      return result.success;
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      return false;
    }
  }

  // Send Email
  static async sendEmail(
    emailAddress: string, 
    subject: string, 
    message: string, 
    callSummary?: string
  ): Promise<boolean> {
    try {
      // For now, we'll log the email (in production, use actual email service)
      console.log(`
        EMAIL NOTIFICATION:
        To: ${emailAddress}
        Subject: ${subject}
        Message: ${message}
        ${callSummary ? `Call Summary: ${callSummary}` : ''}
      `);

      // In production, integrate with email service like SendGrid, SES, etc.
      // await emailService.send({
      //   to: emailAddress,
      //   subject,
      //   html: this.createEmailTemplate(message, callSummary)
      // });

      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Process extracted contact data and send messages
  static async processExtractedData(
    callId: string,
    extractedWhatsapp?: string,
    extractedEmail?: string,
    callSummary?: string
  ): Promise<void> {
    try {
      const { storage } = await import('../storage');
      
      // Default messages
      const defaultWhatsAppMessage = "Thank you for your time during our call. We'll follow up with the information discussed.";
      const defaultEmailSubject = "Follow-up from our call";
      const defaultEmailMessage = "Thank you for your time during our call. Please find the summary and next steps below.";

      let whatsappSent = false;
      let emailSent = false;

      // Send WhatsApp message if number was extracted
      if (extractedWhatsapp) {
        whatsappSent = await this.sendWhatsAppMessage(
          extractedWhatsapp,
          defaultWhatsAppMessage,
          callSummary
        );
      }

      // Send email if address was extracted
      if (extractedEmail) {
        emailSent = await this.sendEmail(
          extractedEmail,
          defaultEmailSubject,
          defaultEmailMessage,
          callSummary
        );
      }

      // Update call record with messaging status
      await storage.updateCall(callId, {
        extractedWhatsapp,
        extractedEmail,
        whatsappSent,
        emailSent,
      });

    } catch (error) {
      console.error('Error processing extracted data:', error);
    }
  }

  // Extract contact information from conversation text
  static extractContactInfo(conversationText: string): {
    whatsappNumber?: string;
    email?: string;
  } {
    const result: { whatsappNumber?: string; email?: string } = {};

    // Extract WhatsApp number patterns
    const whatsappPatterns = [
      /whatsapp.*?(\+?\d{1,3}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/gi,
      /wa.*?(\+?\d{1,3}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/gi,
      /my.*?whatsapp.*?(\+?\d{1,3}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9})/gi,
    ];

    for (const pattern of whatsappPatterns) {
      const match = conversationText.match(pattern);
      if (match && match[1]) {
        result.whatsappNumber = match[1].replace(/[-.\s()]/g, '');
        break;
      }
    }

    // Extract email patterns
    const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emailMatch = conversationText.match(emailPattern);
    if (emailMatch && emailMatch[0]) {
      result.email = emailMatch[0];
    }

    return result;
  }

  // Create HTML email template
  private static createEmailTemplate(message: string, callSummary?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .summary { background-color: #e9ecef; padding: 15px; border-radius: 5px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Follow-up from our call</h2>
          </div>
          <div class="content">
            <p>${message}</p>
            ${callSummary ? `
              <div class="summary">
                <h3>Call Summary:</h3>
                <p>${callSummary}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }
}