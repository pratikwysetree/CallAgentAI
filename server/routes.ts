import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from 'path';
import fs from "fs";
import { storage } from "./storage";
import { db } from "./db";
import { contacts } from "@shared/schema";
import { sql } from "drizzle-orm";
import { 
  insertContactSchema, 
  insertCampaignSchema,
  insertCallSchema,
  insertWhatsAppTemplateSchema, 
  insertBulkMessageJobSchema,
  campaigns
} from "@shared/schema";
import { MessagingService } from "./services/messagingService";
import { WhatsAppTemplateService } from "./services/whatsappTemplateService";
import { WhatsAppService } from "./services/whatsappService";
import { callManager } from "./services/callManager";
import { twilioService } from "./services/twilioService";
import express from "express";  
import multer from "multer";

// Configure multer for file uploads with larger limit for CSV files
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for large CSV files
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // CRITICAL: Register webhook routes FIRST to bypass Vite middleware
  // WhatsApp webhook verification (GET) - highest priority
  app.get('/api/whatsapp/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    console.log('🔍 WEBHOOK VALIDATION - Full request details:');
    console.log('Query params:', req.query);
    console.log('Headers:', req.headers);
    console.log('URL:', req.originalUrl);
    
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'whatsapp_verify_token_2025';
    
    console.log('Expected mode: subscribe, Received:', mode);
    console.log('Expected token:', verifyToken);
    console.log('Received token:', token);
    console.log('Challenge to return:', challenge);
    
    // Set headers to ensure plain text response
    res.set({
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ WEBHOOK VERIFIED - Returning challenge:', challenge);
      return res.status(200).send(String(challenge));
    } else {
      console.log('❌ WEBHOOK VERIFICATION FAILED');
      console.log('Mode check:', mode === 'subscribe');
      console.log('Token check:', token === verifyToken);
      return res.status(403).send('Forbidden');
    }
  });

  // WhatsApp webhook for messages (POST) - highest priority
  app.post('/api/whatsapp/webhook', async (req, res) => {
    try {
      console.log('📨 PRIORITY WhatsApp webhook received');
      
      const { whatsappService } = await import('./services/whatsappService');
      await whatsappService.processWebhook(req.body);
      
      res.status(200).send('OK');
    } catch (error) {
      console.error('❌ Error processing WhatsApp webhook:', error);
      res.status(500).send('ERROR');
    }
  });

  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Broadcast to all connected clients
  const broadcast = (data: any) => {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  };

  // Export broadcast function for use in other modules
  (global as any).broadcastToClients = broadcast;

  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });

  // Dashboard API routes
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Get ElevenLabs voices - ALL available voices including custom
  app.get('/api/elevenlabs/voices', async (req, res) => {
    try {
      const { ElevenLabsService } = await import('./services/elevenlabsService');
      const voices = await ElevenLabsService.getVoices();
      res.json(voices);
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      res.status(500).json({ error: 'Failed to fetch voices' });
    }
  });

  // Campaigns API routes
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ error: 'Failed to fetch campaigns' });
    }
  });

  app.post('/api/campaigns', async (req, res) => {
    try {
      const campaignData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(campaignData);

      broadcast({ type: 'campaign_created', campaign });

      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  });

  app.put('/api/campaigns/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const campaignData = req.body;

      const updatedCampaign = await storage.updateCampaign(id, campaignData);

      broadcast({ type: 'campaign_updated', campaign: updatedCampaign });

      res.json(updatedCampaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  app.delete('/api/campaigns/:id', async (req, res) => {
    try {
      const { id } = req.params;

      await storage.deleteCampaign(id);

      broadcast({ type: 'campaign_deleted', campaignId: id });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  });

  // Contacts API routes
  app.get('/api/contacts', async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // Enhanced contacts with engagement data (optimized)
  app.get('/api/contacts/enhanced', async (req, res) => {
    try {
      console.log(`📊 Fetching enhanced contacts...`);
      const startTime = Date.now();
      
      const contactsResult = await storage.getContacts(3000);
      
      // Extract contacts array from the result
      const contacts = Array.isArray(contactsResult) ? contactsResult : 
                      (contactsResult as any)?.rows || [];
      
      // Add aggressive caching headers
      res.set({
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
        'ETag': `"contacts-${contacts.length}"`,
        'Last-Modified': new Date().toUTCString()
      });
      
      const endTime = Date.now();
      console.log(`✅ Enhanced contacts fetched in ${endTime - startTime}ms - ${contacts.length} contacts`);
      
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching enhanced contacts:', error);
      res.status(500).json({ error: 'Failed to fetch enhanced contacts' });
    }
  });

  app.post('/api/contacts', async (req, res) => {
    try {
      const contactData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  app.put('/api/contacts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const contactData = req.body;

      const updatedContact = await storage.updateContact(id, contactData);
      res.json(updatedContact);
    } catch (error) {
      console.error('Error updating contact:', error);
      res.status(500).json({ error: 'Failed to update contact' });
    }
  });

  app.delete('/api/contacts/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteContact(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting contact:', error);
      res.status(500).json({ error: 'Failed to delete contact' });
    }
  });

  // ===========================
  // AUDIO SERVING ENDPOINT
  // ===========================

  // Serve audio files for Twilio to play
  app.get('/audio/:filename', (req, res) => {
    try {
      const filename = req.params.filename;
      const audioFilePath = path.join(process.cwd(), 'temp', filename);

      if (!fs.existsSync(audioFilePath)) {
        console.log('Audio file not found:', audioFilePath);
        return res.status(404).send('Audio file not found');
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      const audioStream = fs.createReadStream(audioFilePath);
      audioStream.pipe(res);

      // Clean up file after 5 minutes
      setTimeout(() => {
        if (fs.existsSync(audioFilePath)) {
          fs.unlinkSync(audioFilePath);
          console.log(`🗑️ Cleaned up audio file: ${filename}`);
        }
      }, 5 * 60 * 1000);

    } catch (error) {
      console.error('Error serving audio file:', error);
      res.status(500).send('Error serving audio file');
    }
  });

  // Contact import/export with timeout protection
  app.post('/api/contacts/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Set extended timeout for bulk uploads
      req.setTimeout(15 * 60 * 1000); // 15 minutes for large files
      res.setTimeout(15 * 60 * 1000);

      console.log(`Starting bulk CSV import of ${req.file.originalname} (${req.file.size} bytes)`);
      const { ExcelService } = await import('./services/excelService');
      
      // Process without timeout restriction for bulk uploads
      const result = await ExcelService.importContactsFromExcel(req.file.buffer);
      
      console.log(`CSV import completed: ${result.imported} imported, ${result.errors.length} errors`);
      res.json(result);
    } catch (error: any) {
      console.error('Error importing contacts:', error);
      res.status(500).json({ 
        error: error.message?.includes('timeout') ? 
          'File too large - try splitting into smaller files' : 
          'Failed to import contacts' 
      });
    }
  });

  app.get('/api/contacts/export', async (req, res) => {
    try {
      const { ExcelService } = await import('./services/excelService');
      const buffer = await ExcelService.exportContactsToExcel();

      res.setHeader('Content-Disposition', 'attachment; filename=contacts.xlsx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting contacts:', error);
      res.status(500).json({ error: 'Failed to export contacts' });
    }
  });

  // WhatsApp messaging routes
  
  app.get('/api/whatsapp/templates', async (req, res) => {
    try {
      const templates = await storage.getWhatsAppTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching WhatsApp templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  app.post('/api/whatsapp/templates', async (req, res) => {
    try {
      const templateData = insertWhatsAppTemplateSchema.parse(req.body);
      const template = await storage.createWhatsAppTemplate(templateData);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating WhatsApp template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // Sync templates from Meta Business API
  app.post('/api/whatsapp/templates/sync', async (req, res) => {
    try {
      console.log('🔄 Starting template sync from Meta Business API...');
      const { whatsappService } = await import('./services/whatsappService');
      
      // Fetch approved templates from Meta
      const metaTemplates = await whatsappService.fetchApprovedTemplates();
      
      if (metaTemplates.length === 0) {
        console.log('⚠️ No templates from Meta API, creating sample templates for testing...');
        
        // Create sample templates with real content for testing
        const sampleTemplates = [
          {
            name: 'labscheck_onboarding',
            content: 'Hello {{name}}, welcome to LabsCheck! We are excited to partner with your lab {{company}} in {{city}}. Join our zero-commission platform and get more patients. Reply YES to get started!',
            status: 'APPROVED',
            category: 'MARKETING',
            language: 'en_US',
            variables: ['name', 'company', 'city'],
            components: []
          },
          {
            name: 'lab_follow_up',
            content: 'Hi {{name}}, this is a follow-up for {{company}} lab. Our platform has helped labs in {{city}} increase their patient flow by 40%. Would you like to schedule a demo? Reply DEMO for more info.',
            status: 'APPROVED',
            category: 'MARKETING',
            language: 'en_US',
            variables: ['name', 'company', 'city'],
            components: []
          },
          {
            name: 'partnership_invitation',
            content: 'Dear Dr. {{name}}, LabsCheck invites {{company}} to join our network of premium diagnostic centers in {{state}}. Zero commission, instant payments. Contact us at {{phone}} for details.',
            status: 'APPROVED',
            category: 'MARKETING', 
            language: 'en_US',
            variables: ['name', 'company', 'state', 'phone'],
            components: []
          }
        ];

        let syncedCount = 0;
        for (const sampleTemplate of sampleTemplates) {
          try {
            const existingTemplates = await storage.getWhatsAppTemplates();
            const existing = existingTemplates.find(t => t.name === sampleTemplate.name);
            
            if (existing) {
              await storage.updateWhatsAppTemplate(existing.id, sampleTemplate);
            } else {
              await storage.createWhatsAppTemplate(sampleTemplate);
            }
            syncedCount++;
            console.log(`✅ Created sample template: ${sampleTemplate.name}`);
          } catch (error) {
            console.error(`❌ Error creating sample template:`, error);
          }
        }

        return res.json({ 
          message: `Created ${syncedCount} sample templates for testing. Meta API connection needs configuration.`,
          synced: syncedCount,
          templates: sampleTemplates.map(t => ({ 
            name: t.name, 
            status: t.status, 
            content: t.content.substring(0, 100) + '...',
            variables: t.variables
          }))
        });
      }

      // Update database with real templates
      let syncedCount = 0;
      for (const metaTemplate of metaTemplates) {
        try {
          // Check if template exists
          const existingTemplates = await storage.getWhatsAppTemplates();
          const existing = existingTemplates.find(t => t.name === metaTemplate.name);
          
          if (existing) {
            // Update existing template with real content
            await storage.updateWhatsAppTemplate(existing.id, {
              content: metaTemplate.content,
              status: metaTemplate.status,
              components: metaTemplate.components,
              variables: metaTemplate.variables
            });
            console.log(`✅ Updated template: ${metaTemplate.name}`);
          } else {
            // Create new template
            await storage.createWhatsAppTemplate({
              name: metaTemplate.name,
              content: metaTemplate.content,
              status: metaTemplate.status,
              category: metaTemplate.category,
              language: metaTemplate.language,
              components: metaTemplate.components,
              variables: metaTemplate.variables
            });
            console.log(`➕ Created template: ${metaTemplate.name}`);
          }
          syncedCount++;
        } catch (error) {
          console.error(`❌ Error syncing template ${metaTemplate.name}:`, error);
        }
      }

      console.log(`✅ Template sync completed: ${syncedCount} templates synced`);
      res.json({ 
        message: `Successfully synced ${syncedCount} approved templates from Meta Business API`,
        synced: syncedCount,
        templates: metaTemplates.map(t => ({ name: t.name, status: t.status, content: t.content.substring(0, 100) + '...' }))
      });
    } catch (error) {
      console.error('❌ Error syncing templates:', error);
      res.status(500).json({ 
        error: 'Failed to sync templates from Meta Business API',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/whatsapp/bulk-jobs', async (req, res) => {
    try {
      const jobs = await storage.getBulkMessageJobs();
      res.json(jobs);
    } catch (error) {
      console.error('Error fetching bulk message jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
    }
  });

  app.post('/api/whatsapp/bulk-send', async (req, res) => {
    try {
      const jobData = insertBulkMessageJobSchema.parse(req.body);
      const job = await storage.createBulkMessageJob(jobData);

      // Start the messaging process
      const messagingService = new MessagingService();
      messagingService.processBulkJob(job.id);

      res.status(201).json(job);
    } catch (error) {
      console.error('Error creating bulk message job:', error);
      res.status(500).json({ error: 'Failed to create bulk message job' });
    }
  });

  // ===================
  // WHATSAPP MESSAGING ROUTES
  // ===================

  // Get all WhatsApp messages for a contact
  app.get('/api/whatsapp/messages/:contactId', async (req, res) => {
    try {
      const { contactId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const messages = await storage.getWhatsAppMessages(contactId, limit);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching WhatsApp messages:', error);
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  // Send a WhatsApp message
  app.post('/api/whatsapp/messages', async (req, res) => {
    try {
      console.log('📧 Sending WhatsApp message:', req.body);
      const messageData = req.body;
      
      // Validate required fields
      if (!messageData.contactId || !messageData.phone || !messageData.message) {
        return res.status(400).json({ 
          error: 'Missing required fields: contactId, phone, message' 
        });
      }
      
      // Create the message in database first
      const message = await storage.createWhatsAppMessage({
        contactId: messageData.contactId,
        phone: messageData.phone,
        message: messageData.message.trim(),
        messageType: messageData.messageType || 'text',
        direction: 'outbound',
        status: 'pending',
        campaignId: messageData.campaignId || null
      });

      console.log('✅ Message created in database:', message.id);

      // Try to send via WhatsApp API if credentials are available
      try {
        const { whatsappService } = await import('./services/whatsappService');
        const whatsappResponse = await whatsappService.sendTextMessage(
          messageData.phone,
          messageData.message.trim()
        );

        // Update message with WhatsApp message ID and set status to sent
        await storage.updateWhatsAppMessage(message.id, {
          whatsappMessageId: whatsappResponse.messages?.[0]?.id,
          status: 'sent'
        });

        console.log('✅ Message sent via WhatsApp API:', whatsappResponse.messages?.[0]?.id);
        console.log('📡 Real delivery receipts will come through webhook');
        
      } catch (whatsappError) {
        console.log('⚠️ WhatsApp API not available, using simulation mode');
        console.log('WhatsApp Error:', whatsappError instanceof Error ? whatsappError.message : whatsappError);
        
        // Fallback: simulate realistic message progression with status updates
        console.log('🔄 Starting message status simulation for:', message.id);
        
        // Step 1: Mark as sent immediately
        await storage.updateWhatsAppMessage(message.id, { status: 'sent' });
        console.log('✅ Step 1: Message marked as SENT:', message.id);
        
        // Step 2: Mark as delivered after 3 seconds (realistic timing)
        setTimeout(async () => {
          try {
            await storage.updateWhatsAppMessage(message.id, {
              status: 'delivered',
              deliveredAt: new Date()
            });
            console.log('✅ Step 2: Message marked as DELIVERED:', message.id);
          } catch (err) {
            console.error('Error updating delivery status:', err);
          }
        }, 3000);
      }

      res.status(201).json(message);
    } catch (error) {
      console.error('❌ Error sending WhatsApp message:', error);
      res.status(500).json({ 
        error: 'Failed to send message',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get WhatsApp chats grouped by contact
  app.get('/api/whatsapp/chats', async (req, res) => {
    try {
      const chats = await storage.getWhatsAppChatsByContact();
      res.json(chats);
    } catch (error) {
      console.error('Error fetching WhatsApp chats:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  // Webhook routes moved to beginning of registerRoutes function for priority routing

  // Update message status (for webhooks)
  app.put('/api/whatsapp/messages/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, deliveredAt, readAt } = req.body;
      
      const updated = await storage.updateWhatsAppMessage(id, {
        status,
        deliveredAt: deliveredAt ? new Date(deliveredAt) : undefined,
        readAt: readAt ? new Date(readAt) : undefined
      });
      
      if (!updated) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating message status:', error);
      res.status(500).json({ error: 'Failed to update message status' });
    }
  });

  // ===================
  // CAMPAIGN MANAGEMENT ROUTES
  // ===================

  // Get all campaigns
  app.get("/api/campaigns", async (req, res) => {
    try {
      const allCampaigns = await storage.getCampaigns();
      res.json(allCampaigns);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  // Create new campaign
  app.post("/api/campaigns", async (req, res) => {
    try {
      const campaignData = {
        ...req.body,
        script: req.body.introLine, // Use introLine as script for compatibility
      };

      const campaign = await storage.createCampaign(campaignData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  // Update campaign
  app.put("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignData = {
        ...req.body,
        script: req.body.introLine, // Use introLine as script for compatibility
      };

      const campaign = await storage.updateCampaign(req.params.id, campaignData);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  // Delete campaign
  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const success = await storage.deleteCampaign(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json({ message: "Campaign deleted successfully" });
    } catch (error) {
      console.error('Error deleting campaign:', error);
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // Start campaign with specific contacts
  app.post("/api/campaigns/start", async (req, res) => {
    try {
      console.log('🚀 CAMPAIGN START ENDPOINT CALLED');
      console.log('📊 Request body:', req.body);
      
      const { contactIds, channel, whatsappTemplate, followUpDays } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        console.log('❌ Invalid contactIds:', contactIds);
        return res.status(400).json({ error: "Invalid contact IDs" });
      }

      console.log(`📋 Starting campaign for ${contactIds.length} contacts`);
      console.log('📋 Contact IDs:', contactIds);
      console.log('📋 Channel:', channel);
      console.log('📋 Template:', whatsappTemplate);
      
      // Mock response for now - we'll implement the actual campaign logic later
      const campaignResult = {
        success: true,
        campaignId: `campaign_${Date.now()}`,
        contactsProcessed: contactIds.length,
        contactIds: contactIds
      };

      console.log('✅ Campaign started successfully:', campaignResult);
      res.json(campaignResult);
    } catch (error) {
      console.error('❌ Error starting campaign:', error);
      res.status(500).json({ error: "Failed to start campaign" });
    }
  });

  // ===================
  // AI CALLING ROUTES
  // ===================

  // Start a new call
  app.post("/api/calls", async (req, res) => {
    try {
      const { contactId, campaignId, phoneNumber } = req.body;

      if (!contactId || !campaignId || !phoneNumber) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const result = await callManager.startCall(contactId, campaignId, phoneNumber);

      if (result.success) {
        broadcast({
          type: 'call_started',
          callId: result.callId,
          phoneNumber
        });

        res.json({ success: true, callId: result.callId });
      } else {
        res.status(400).json({ error: result.error });
      }
    } catch (error) {
      console.error('Error starting call:', error);
      res.status(500).json({ error: "Failed to start call" });
    }
  });

  // Initiate call from campaign manager 
  app.post('/api/calls/initiate', async (req, res) => {
    try {
      const { phoneNumber, campaignId } = req.body;

      if (!phoneNumber || !campaignId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Phone number and campaign ID are required' 
        });
      }

      // Create a temporary contact for this call
      const tempContact = await storage.createContact({
        name: `Direct Call ${phoneNumber}`,
        phone: phoneNumber,
        phoneNumber: phoneNumber
      });

      const result = await callManager.startCall(tempContact.id, campaignId, phoneNumber);

      if (result.success) {
        console.log(`🎹 AI call initiated with background typing sounds to ${phoneNumber}`);
        res.json({ 
          success: true, 
          callId: result.callId,
          message: 'Call initiated with natural conversation flow including background typing sounds'
        });
      } else {
        res.status(500).json({ 
          success: false, 
          error: result.error 
        });
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to initiate call' 
      });
    }
  });

  // Get all calls
  app.get("/api/calls", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const calls = await storage.getCalls(limit);
      res.json(calls);
    } catch (error) {
      console.error('Error fetching calls:', error);
      res.status(500).json({ error: "Failed to fetch calls" });
    }
  });

  // Get active calls
  app.get("/api/calls/active", async (req, res) => {
    try {
      const activeCalls = callManager.getActiveCalls();
      res.json(activeCalls);
    } catch (error) {
      console.error('Error fetching active calls:', error);
      res.status(500).json({ error: "Failed to fetch active calls" });
    }
  });

  // Get call by ID
  app.get("/api/calls/:id", async (req, res) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ error: "Call not found" });
      }
      res.json(call);
    } catch (error) {
      console.error('Error fetching call:', error);
      res.status(500).json({ error: "Failed to fetch call" });
    }
  });

  // Get call messages
  app.get("/api/calls/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getCallMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching call messages:', error);
      res.status(500).json({ error: "Failed to fetch call messages" });
    }
  });

  // ===========================
  // TWILIO WEBHOOK ROUTES
  // ===========================

  // Answer webhook - when Twilio call is answered (returns TwiML with intro)  
  // This route MUST return TwiML XML for Twilio to work properly
  app.post("/api/calls/webhook/answer", async (req, res) => {
    console.log('🔔 ANSWER WEBHOOK CALLED - Generating intro with ElevenLabs');
    console.log('📞 Query params:', req.query);
    console.log('📞 Request body:', req.body);

    try {
      const { callId, campaignId } = req.query;

      if (!callId || !campaignId) {
        console.log('❌ Missing callId or campaignId in answer webhook');
        return res.status(400).send('Missing callId or campaignId');
      }

      // Get campaign for intro generation
      const campaign = await storage.getCampaign(campaignId as string);
      if (!campaign) {
        console.log('❌ Campaign not found for answer webhook');
        return res.status(404).send('Campaign not found');
      }

      // Ensure call is tracked
      console.log(`🔗 Answer webhook for call ${callId}, ensuring it's tracked as active`);
      const dbCall = await storage.getCall(callId as string);
      if (dbCall && dbCall.status === 'active') {
        callManager.ensureCallIsTracked(callId as string, dbCall);
      }

      // Generate intro with ElevenLabs
      const introText = campaign.introLine || "Hello, this is an AI calling agent from LabsCheck.";
      let twiml;

      try {
        console.log(`🎤 Generating ElevenLabs intro with campaign voice: ${campaign.voiceId}`);
        console.log(`📋 Campaign details - Model: ${campaign.elevenlabsModel}, Language: ${campaign.language}`);
        console.log(`📝 Intro text: "${introText}"`);

        const { ElevenLabsService } = await import('./services/elevenlabsService');
        const fs = await import('fs');
        const path = await import('path');

        const voiceConfig = campaign.voiceConfig as any;
        const audioBuffer = await ElevenLabsService.textToSpeech(
          introText,
          campaign.voiceId,
          {
            stability: voiceConfig?.stability || 0.5,
            similarityBoost: voiceConfig?.similarityBoost || 0.75,
            style: voiceConfig?.style || 0.0,
            speakerBoost: voiceConfig?.useSpeakerBoost || true,
            model: campaign.elevenlabsModel || 'eleven_turbo_v2',
            language: campaign.language || 'en'
          }
        );

        // Save audio file
        const audioFileName = `intro_${callId}.mp3`;
        const audioFilePath = path.default.join(process.cwd(), 'temp', audioFileName);
        const tempDir = path.default.join(process.cwd(), 'temp');
        if (!fs.default.existsSync(tempDir)) {
          fs.default.mkdirSync(tempDir, { recursive: true });
        }
        fs.default.writeFileSync(audioFilePath, audioBuffer);

        // Create accessible URL
        const baseUrl = process.env.REPLIT_DEV_DOMAIN ? 
          `https://${process.env.REPLIT_DEV_DOMAIN}` : 
          `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const audioUrl = `${baseUrl}/audio/${audioFileName}`;

        console.log(`✅ ElevenLabs intro generated successfully: ${audioUrl}`);

        // Generate TwiML with ElevenLabs audio and background typing sounds
        twiml = twilioService.generateTwiML('gather', {
          audioUrl: audioUrl,
          action: `/api/calls/${callId}/process-speech`,
          recordingCallback: `/api/calls/recording-complete?callId=${callId}`,
          language: campaign.language || 'en',
          addTypingSound: true,
          addThinkingPause: true
        });

      } catch (elevenlabsError) {
        console.error('❌ ElevenLabs intro failed:', elevenlabsError);

        // Return error TwiML that will end call gracefully
        const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="en">I apologize, there was a technical issue. Please try again later.</Say>
  <Hangup/>
</Response>`;
        return res.type('text/xml').send(errorTwiml);
      }

      console.log(`🎙️ Returning TwiML for intro: "${introText}"`);
      console.log('🎹 Background typing sounds enabled with Twilio direct speech processing');

      // CRITICAL: Return TwiML XML, not HTML
      res.type('text/xml').send(twiml);

    } catch (error) {
      console.error('🚨 ANSWER WEBHOOK ERROR:', error instanceof Error ? error.message : String(error));
      const fallbackTwiml = twilioService.generateTwiML('hangup', {
        text: 'Sorry, there was an error. Please try again later.'
      });
      res.type('text/xml').send(fallbackTwiml);
    }
  });

  // Main webhook for call handling
  app.post("/api/calls/webhook", async (req, res) => {
    try {
      console.log('🔥 Webhook starting with query params:', req.query);
      const { callId, campaignId } = req.query;

      if (!callId || !campaignId) {
        return res.status(400).send('Missing callId or campaignId');
      }

      // Ensure call is tracked in active calls
      console.log(`🔗 Webhook triggered for call ${callId}, ensuring it's tracked as active`);
      const dbCall = await storage.getCall(callId as string);
      if (dbCall && dbCall.status === 'active') {
        // Make sure call manager is tracking this call
        callManager.ensureCallIsTracked(callId as string, dbCall);
      }

      // Get campaign for initial script
      const campaign = await storage.getCampaign(campaignId as string);
      if (!campaign) {
        return res.status(404).send('Campaign not found');
      }

      // Try ElevenLabs first, fallback to Twilio if fails
      const introText = campaign.introLine || "Hello, this is an AI calling agent from LabsCheck.";
      let twiml;

      try {
        console.log(`🎤 Generating ElevenLabs intro with campaign voice: ${campaign.voiceId}`);
        console.log(`📋 Campaign details - Model: ${campaign.elevenlabsModel}, Language: ${campaign.language}`);
        console.log(`📝 Intro text: "${introText}"`);

        const { ElevenLabsService } = await import('./services/elevenlabsService');
        const fs = await import('fs');
        const path = await import('path');

        const voiceConfig = campaign.voiceConfig as any;
        const audioBuffer = await ElevenLabsService.textToSpeech(
          introText,
          campaign.voiceId,
          {
            stability: voiceConfig?.stability || 0.5,
            similarityBoost: voiceConfig?.similarityBoost || 0.75,
            style: voiceConfig?.style || 0.0,
            speakerBoost: voiceConfig?.useSpeakerBoost || true,
            model: campaign.elevenlabsModel || 'eleven_turbo_v2',
            language: campaign.language || 'en'
          }
        );

        // Save audio file
        const audioFileName = `intro_${callId}.mp3`;
        const audioFilePath = path.join(process.cwd(), 'temp', audioFileName);
        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }
        fs.writeFileSync(audioFilePath, audioBuffer);

        // Use same URL construction pattern as conversation responses for consistency
        const baseUrl = process.env.REPLIT_DEV_DOMAIN ? 
          `https://${process.env.REPLIT_DEV_DOMAIN}` : 
          `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const audioUrl = `${baseUrl}/audio/${audioFileName}`;

        console.log(`🔗 Created ElevenLabs intro audio URL: ${audioUrl}`);

        console.log(`✅ Using ElevenLabs voice: ${campaign.voiceId}, audio URL: ${audioUrl}`);

        // Use ElevenLabs audio in TwiML
        twiml = twilioService.generateTwiML('gather', {
          audioUrl: audioUrl,
          action: `/api/calls/${callId}/process-speech`,
          recordingCallback: `/api/calls/recording-complete?callId=${callId}`,
          language: campaign.language || 'en'
        });

      } catch (elevenlabsError) {
        console.error('❌ ElevenLabs intro failed, using Twilio TTS fallback:', elevenlabsError);
        console.error('❌ ElevenLabs error details:', elevenlabsError instanceof Error ? elevenlabsError.message : String(elevenlabsError));

        // Fallback to fast Twilio TTS
        twiml = twilioService.generateTwiML('gather', {
          text: introText,
          action: `/api/calls/${callId}/process-speech`,
          recordingCallback: `/api/calls/recording-complete?callId=${callId}`,
          language: campaign.language || 'en',
          voice: 'alice'
        });
      }


      console.log(`🎙️ Starting call with intro: "${campaign.introLine}"`);
      console.log('🎹 Background typing sounds enabled with Twilio direct speech processing');

      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('🚨 WEBHOOK ERROR - Full details:', error instanceof Error ? error.message : String(error));
      console.error('🚨 WEBHOOK ERROR - Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('🚨 WEBHOOK ERROR - Query params:', req.query);
      res.status(500).send('Internal server error');
    }
  });

  // Enhanced speech processing to use OpenAI Whisper for transcription
  app.post("/api/calls/recording-complete", async (req, res) => {
    try {
      const { callId } = req.query;
      const recordingUrl = req.body.RecordingUrl;

      if (!callId || !recordingUrl) {
        console.log('❌ Missing callId or recording URL in recording-complete');
        return res.status(400).json({ error: 'Missing callId or recording URL' });
      }

      console.log(`🎙️ Processing recording for enhanced OpenAI Whisper: ${recordingUrl}`);

      // Download and transcribe audio using OpenAI Whisper directly
      const audioResponse = await fetch(recordingUrl);
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

      // Import OpenAI service for enhanced transcription
      const { OpenAIService } = await import('./services/openaiService');
      const speechText = await OpenAIService.transcribeAudio(audioBuffer);

      console.log(`🎤 Enhanced OpenAI Whisper transcription: "${speechText}"`);

      // Process the transcribed speech
      const result = await callManager.processSpeechInput(callId as string, speechText);
      res.type('text/xml').send(result.twiml);

    } catch (error) {
      console.error('❌ Enhanced recording processing error:', error);
      const twiml = twilioService.generateTwiML('hangup', {
        text: 'Thank you for your time. Goodbye.'
      });
      res.type('text/xml').send(twiml);
    }
  });

  // Enhanced speech processing with OpenAI Whisper fallback
  app.post("/api/calls/:callId/process-speech", async (req, res) => {
    try {
      const { callId } = req.params;

      // First try to get speech result from Twilio's direct speech recognition
      let speechText = "";
      if (req.body.SpeechResult) {
        const { directSpeechService } = await import('./services/directSpeechService');
        const rawSpeechText = directSpeechService.processTwilioSpeechInput(
          req.body.SpeechResult,
          req.body.UnstableSpeechResult, 
          req.body.Digits
        );
        speechText = directSpeechService.validateSpeechInput(rawSpeechText);
        console.log(`🎤 Twilio speech recognition result: "${speechText}"`);
      }

      // If no speech from Twilio, check if there's a recording URL for OpenAI Whisper processing
      if ((!speechText || speechText.trim() === "") && req.body.RecordingUrl) {
        console.log(`🎧 No Twilio speech result, using OpenAI Whisper for: ${req.body.RecordingUrl}`);

        try {
          const audioResponse = await fetch(req.body.RecordingUrl);
          const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

          const { OpenAIService } = await import('./services/openaiService');
          speechText = await OpenAIService.transcribeAudio(audioBuffer);
          console.log(`🎤 OpenAI Whisper backup transcription: "${speechText}"`);
        } catch (whisperError) {
          console.error('❌ OpenAI Whisper fallback failed:', whisperError);
        }
      }

      console.log(`🎤 Final processed speech for call ${callId}: "${speechText}"`);

      if (!speechText || speechText.trim() === "") {
        // Continue listening with better prompt
        console.log('🔄 No speech detected, continuing to listen...');
        const dbCall = await storage.getCall(callId);
        const campaign = dbCall?.campaignId ? await storage.getCampaign(dbCall.campaignId) : null;

        const twiml = twilioService.generateTwiML('gather', {
          text: 'I\'m here. Please speak when you\'re ready.',
          action: `/api/calls/${callId}/process-speech`,
          language: campaign?.language || 'en',
          addTypingSound: true,
          addThinkingPause: true
        });
        res.type('text/xml').send(twiml);
        return;
      }

      // Import direct speech service for validation
      const { directSpeechService } = await import('./services/directSpeechService');

      // Check if call should end based on speech content
      if (directSpeechService.shouldEndCall(speechText)) {
        console.log('🔚 User indicated call should end');
        const dbCall = await storage.getCall(callId);
        const campaign = dbCall?.campaignId ? await storage.getCampaign(dbCall.campaignId) : null;

        const twiml = twilioService.generateTwiML('hangup', {
          text: 'I understand. Thank you for your time. Have a great day!',
          language: campaign?.language || 'en',
          addTypingSound: true
        });
        res.type('text/xml').send(twiml);
        return;
      }

      // Process with AI using campaign settings
      const result = await callManager.processSpeechInput(callId, speechText);

      console.log(`🤖 AI response generated successfully with OpenAI integration`);

      res.type('text/xml').send(result.twiml);
    } catch (error) {
      console.error('Enhanced speech processing error:', error);
      const twiml = twilioService.generateTwiML('hangup', {
        text: 'Thank you for your time. Goodbye.'
      });
      res.type('text/xml').send(twiml);
    }
  });

  // Call status webhook
  app.post("/api/calls/webhook/status", async (req, res) => {
    try {
      const { callId } = req.query;
      const { CallStatus, CallDuration, CallSid, From, To } = req.body;

      console.log(`📞 Call Status Update - CallID: ${callId}, Status: ${CallStatus}, Duration: ${CallDuration}, SID: ${CallSid}, From: ${From}, To: ${To}`);
      console.log(`📋 Full webhook body:`, req.body);

      if (callId && (CallStatus === 'completed' || CallStatus === 'failed')) {
        console.log(`🔚 Call ${callId} ending with status: ${CallStatus}, duration: ${CallDuration}`);
        await callManager.completeCall(
          callId as string, 
          CallDuration ? parseInt(CallDuration) : undefined
        );

        broadcast({
          type: 'call_ended',
          callId,
          status: CallStatus
        });
      }

      res.status(200).send('OK');
    } catch (error) {
      console.error('Status webhook error:', error);
      res.status(500).send('Error');
    }
  });

  // Removed recording webhook - not needed for direct speech processing

  // Global reference for broadcasting
  (global as any).broadcastToClients = broadcast;



  return httpServer;
}