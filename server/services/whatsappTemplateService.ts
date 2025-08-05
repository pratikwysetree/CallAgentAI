import { storage } from '../storage';
import { WhatsAppTemplate, BulkMessageJob, InsertWhatsAppTemplate, InsertBulkMessageJob } from '@shared/schema';

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT';
  text?: string;
  parameters?: TemplateParameter[];
  buttons?: TemplateButton[];
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time';
  text?: string;
}

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export interface BulkRecipient {
  phoneNumber: string;
  variables?: string[];
  status: 'PENDING' | 'SENT' | 'FAILED';
  error?: string;
}

export class WhatsAppTemplateService {
  private static baseUrl = 'https://graph.facebook.com/v18.0';
  private static accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  private static businessAccountId = process.env.META_WHATSAPP_BUSINESS_ACCOUNT_ID;
  private static phoneNumberId = process.env.META_WHATSAPP_BUSINESS_PHONE_NUMBER_ID;

  // Create a new template
  static async createTemplate(template: InsertWhatsAppTemplate): Promise<WhatsAppTemplate> {
    try {
      const response = await fetch(`${this.baseUrl}/${this.businessAccountId}/message_templates`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: template.name,
          category: template.category,
          language: template.language,
          components: template.components
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(`Failed to create template: ${result.error?.message || 'Unknown error'}`);
      }

      const newTemplate: InsertWhatsAppTemplate = {
        ...template,
        metaTemplateId: result.id,
        status: 'PENDING'
      };

      // Store in database
      const dbTemplate = await storage.createWhatsAppTemplate(newTemplate);
      
      return dbTemplate;
    } catch (error) {
      console.error('Error creating template:', error);
      throw error;
    }
  }

  // Get all templates
  static async getTemplates(): Promise<WhatsAppTemplate[]> {
    try {
      return await storage.getWhatsAppTemplates();
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  // Send template message to single recipient
  static async sendTemplateMessage(
    phoneNumber: string, 
    templateName: string, 
    languageCode: string = 'en_US',
    variables?: string[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const components = variables ? [{
        type: 'body',
        parameters: variables.map(variable => ({
          type: 'text',
          text: variable
        }))
      }] : undefined;

      const payload = {
        messaging_product: 'whatsapp',
        to: phoneNumber.replace(/\D/g, ''), // Remove non-digits
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components && { components })
        }
      };

      const response = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (response.ok && result.messages) {
        return {
          success: true,
          messageId: result.messages[0].id
        };
      } else {
        return {
          success: false,
          error: result.error?.message || 'Failed to send message'
        };
      }
    } catch (error) {
      console.error('Error sending template message:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Bulk send template messages
  static async sendBulkTemplateMessages(
    templateName: string,
    recipients: BulkRecipient[],
    languageCode: string = 'en_US',
    delayMs: number = 1000
  ): Promise<BulkMessageJob> {
    const jobId = `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const jobData: InsertBulkMessageJob = {
      templateName,
      recipients: recipients.map(r => ({ ...r, status: 'PENDING' })),
      status: 'PENDING',
      totalMessages: recipients.length,
      sentMessages: 0,
      failedMessages: 0,
      languageCode
    };

    // Store job in database
    const job = await storage.createBulkMessageJob(jobData);

    // Process bulk messages asynchronously
    this.processBulkMessages(job, languageCode, delayMs).catch(console.error);

    return job;
  }

  // Process bulk messages in background
  private static async processBulkMessages(
    job: BulkMessageJob, 
    languageCode: string, 
    delayMs: number
  ): Promise<void> {
    try {
      // Update job status
      job.status = 'IN_PROGRESS';
      await storage.updateBulkMessageJob(job);

      for (let i = 0; i < job.recipients.length; i++) {
        const recipient = job.recipients[i];
        
        try {
          const result = await this.sendTemplateMessage(
            recipient.phoneNumber,
            job.templateName,
            languageCode,
            recipient.variables
          );

          if (result.success) {
            recipient.status = 'SENT';
            job.sentMessages++;
          } else {
            recipient.status = 'FAILED';
            recipient.error = result.error;
            job.failedMessages++;
          }

          // Rate limiting delay
          if (i < job.recipients.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
          }
        } catch (error) {
          recipient.status = 'FAILED';
          recipient.error = error instanceof Error ? error.message : 'Unknown error';
          job.failedMessages++;
        }

        // Update job progress
        await storage.updateBulkMessageJob(job);
      }

      // Mark job as completed
      job.status = 'COMPLETED';
      job.completedAt = new Date();
      await storage.updateBulkMessageJob(job);

      console.log(`Bulk message job ${job.id} completed: ${job.sentMessages} sent, ${job.failedMessages} failed`);
    } catch (error) {
      console.error(`Error processing bulk job ${job.id}:`, error);
      job.status = 'FAILED';
      await storage.updateBulkMessageJob(job);
    }
  }

  // Get bulk message job status
  static async getBulkMessageJob(jobId: string): Promise<BulkMessageJob | null> {
    try {
      return await storage.getBulkMessageJob(jobId);
    } catch (error) {
      console.error('Error fetching bulk message job:', error);
      return null;
    }
  }

  // Get all bulk message jobs
  static async getBulkMessageJobs(): Promise<BulkMessageJob[]> {
    try {
      return await storage.getBulkMessageJobs();
    } catch (error) {
      console.error('Error fetching bulk message jobs:', error);
      return [];
    }
  }

  // Predefined template examples
  static getTemplateExamples(): Partial<InsertWhatsAppTemplate>[] {
    return [
      {
        name: 'order_confirmation',
        category: 'UTILITY',
        language: 'en_US',
        components: [
          {
            type: 'BODY',
            text: 'Hello {{1}}! Your order #{{2}} has been confirmed. Expected delivery: {{3}}. Track your order: {{4}}'
          }
        ]
      },
      {
        name: 'payment_reminder',
        category: 'UTILITY',
        language: 'en_US',
        components: [
          {
            type: 'BODY',
            text: 'Hi {{1}}, your invoice #{{2}} of ${{3}} is due on {{4}}. Pay now: {{5}}'
          }
        ]
      },
      {
        name: 'promotional_offer',
        category: 'MARKETING',
        language: 'en_US',
        components: [
          {
            type: 'HEADER',
            format: 'TEXT',
            text: '🎉 Special Offer!'
          },
          {
            type: 'BODY',
            text: 'Hello {{1}}! Get {{2}}% off on {{3}}. Valid until {{4}}. Shop now: {{5}}'
          },
          {
            type: 'FOOTER',
            text: 'Terms and conditions apply'
          }
        ]
      }
    ];
  }
}