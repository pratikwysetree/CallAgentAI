import { storage } from "../storage";

export interface WhatsAppMessage {
  messaging_product: string;
  to: string;
  type: string;
  text?: {
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: any[];
  };
}

export class WhatsAppService {
  private accessToken: string;
  private phoneNumberId: string;
  private baseUrl = 'https://graph.facebook.com/v18.0';

  constructor(accessToken?: string, phoneNumberId?: string) {
    this.accessToken = accessToken || process.env.WHATSAPP_ACCESS_TOKEN || '';
    this.phoneNumberId = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  }

  // Get WABA ID from environment variable
  private async getWABAId(): Promise<string> {
    const wabaId = process.env.WHATSAPP_WABA_ID;
    
    if (!wabaId) {
      throw new Error('WHATSAPP_WABA_ID environment variable not configured');
    }

    console.log('📋 Using WABA ID from environment:', wabaId);
    return wabaId;
  }

  // Fetch approved message templates from Meta Business API
  async fetchApprovedTemplates(): Promise<any[]> {
    try {
      console.log('🔄 Fetching approved templates from Meta Business API...');
      
      if (!this.accessToken || !this.phoneNumberId) {
        console.log('❌ WhatsApp credentials not configured');
        return [];
      }

      const wabaId = await this.getWABAId();
      console.log('📋 WABA ID:', wabaId);
      
      const url = `${this.baseUrl}/${wabaId}/message_templates?fields=name,status,category,components,language,id&limit=50`;
      console.log('📋 Requesting URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text();
      console.log('📋 Meta API response status:', response.status);
      console.log('📋 Meta API response:', responseText);

      if (!response.ok) {
        console.error('❌ Meta API error response:', responseText);
        throw new Error(`Failed to fetch templates: ${responseText}`);
      }

      const data = JSON.parse(responseText);
      console.log('📋 Parsed Meta API data:', JSON.stringify(data, null, 2));
      
      const templates = data.data || [];
      console.log(`📋 Found ${templates.length} templates from Meta Business API`);
      
      // Filter only approved templates and parse content
      const approvedTemplates = templates
        .filter((template: any) => template.status === 'APPROVED')
        .map((template: any) => {
          const bodyComponent = template.components?.find((comp: any) => comp.type === 'BODY');
          const content = bodyComponent?.text || '';
          
          // Extract variables from components
          const variables = bodyComponent?.example?.body_text?.[0] || null;
          
          console.log(`📋 Template ${template.name}:`, {
            status: template.status,
            content: content,
            variables: variables
          });
          
          return {
            id: template.id,
            name: template.name,
            status: template.status,
            category: template.category,
            content: content,
            variables: variables,
            language: template.language,
            components: template.components,
            createdAt: new Date().toISOString()
          };
        });

      console.log(`✅ Processed ${approvedTemplates.length} approved templates`);
      return approvedTemplates;
      
    } catch (error) {
      console.error('❌ Error fetching templates from Meta:', error);
      return [];
    }
  }

  // Send a WhatsApp message via Meta Business API
  async sendMessage(message: WhatsAppMessage): Promise<any> {
    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    const url = `${this.baseUrl}/${this.phoneNumberId}/messages`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WhatsApp API error: ${error}`);
    }

    return await response.json();
  }

  // Clean phone number for WhatsApp (remove + and any non-digits)
  private cleanPhoneNumber(phone: string): string {
    // Remove + sign and any non-digit characters
    const cleaned = phone.replace(/\+/g, '').replace(/\D/g, '');
    console.log(`📱 Phone number cleaned: ${phone} → ${cleaned}`);
    return cleaned;
  }

  // Send a text message
  async sendTextMessage(to: string, message: string): Promise<any> {
    const cleanedPhoneNumber = this.cleanPhoneNumber(to);
    
    const whatsappMessage: WhatsAppMessage = {
      messaging_product: 'whatsapp',
      to: cleanedPhoneNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    console.log(`📱 Sending WhatsApp message to ${cleanedPhoneNumber}: ${message.substring(0, 50)}...`);
    return await this.sendMessage(whatsappMessage);
  }

  // Process incoming webhook from WhatsApp
  async processWebhook(body: any): Promise<void> {
    console.log('📨 WhatsApp webhook received:', JSON.stringify(body, null, 2));

    if (body.object === 'whatsapp_business_account') {
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field === 'messages') {
            await this.processMessage(change.value);
          }
        }
      }
    }
  }

  // Process incoming messages and status updates
  private async processMessage(value: any): Promise<void> {
    // Process incoming messages
    if (value.messages) {
      for (const message of value.messages) {
        await this.handleIncomingMessage(message, value.contacts?.[0]);
      }
    }

    // Process message status updates (delivery, read receipts)
    if (value.statuses) {
      for (const status of value.statuses) {
        await this.handleStatusUpdate(status);
      }
    }
  }

  // Handle incoming message from customer
  private async handleIncomingMessage(message: any, contact: any): Promise<void> {
    try {
      console.log('📥 Processing incoming message:', message.id);

      // Extract message content
      let messageText = '';
      if (message.type === 'text') {
        messageText = message.text.body;
      } else if (message.type === 'image') {
        messageText = `[Image] ${message.image?.caption || ''}`;
      } else if (message.type === 'document') {
        messageText = `[Document] ${message.document?.filename || ''}`;
      } else {
        messageText = `[${message.type}] Unsupported message type`;
      }

      // Find or create contact
      let existingContact = await storage.getContactByPhone(message.from);
      if (!existingContact && contact) {
        // Create new contact from WhatsApp contact info
        existingContact = await storage.createContact({
          name: contact.profile?.name || `WhatsApp User ${message.from.slice(-4)}`,
          phone: message.from,
          whatsappNumber: message.from,
          notes: 'Created from WhatsApp message'
        });
      }

      if (existingContact) {
        // Store incoming message
        await storage.createWhatsAppMessage({
          contactId: existingContact.id,
          phone: message.from,
          message: messageText,
          messageType: message.type,
          direction: 'inbound',
          status: 'received',
          whatsappMessageId: message.id
        });

        console.log('✅ Incoming message stored for contact:', existingContact.name);
      } else {
        console.error('❌ Could not find or create contact for phone:', message.from);
      }
    } catch (error) {
      console.error('❌ Error processing incoming message:', error);
    }
  }

  // Handle message status updates (delivered, read, failed)
  private async handleStatusUpdate(status: any): Promise<void> {
    try {
      console.log('📊 Processing status update:', status.id, status.status);

      // Find message by WhatsApp message ID
      const messages = await storage.getWhatsAppMessageByWhatsAppId(status.id);
      if (messages.length > 0) {
        const message = messages[0];
        
        // Update message status
        const updateData: any = { status: status.status };
        
        if (status.status === 'delivered' && status.timestamp) {
          updateData.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
        } else if (status.status === 'read' && status.timestamp) {
          updateData.readAt = new Date(parseInt(status.timestamp) * 1000);
        } else if (status.status === 'failed') {
          updateData.failedReason = status.errors?.[0]?.title || 'Message failed to send';
        }

        await storage.updateWhatsAppMessage(message.id, updateData);
        console.log('✅ Message status updated:', message.id, status.status);
      } else {
        console.log('⚠️ No message found for status update:', status.id);
      }
    } catch (error) {
      console.error('❌ Error processing status update:', error);
    }
  }

  // Verify webhook signature (optional security measure)
  verifyWebhookSignature(body: string, signature: string): boolean {
    // Implementation would use HMAC-SHA256 with app secret
    // For now, we'll skip signature verification
    return true;
  }
}

export const whatsappService = new WhatsAppService();