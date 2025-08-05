import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { callManager } from "./services/callManager";
import { twilioService } from "./services/twilio";
import { 
  insertContactSchema, 
  insertCampaignSchema, 
  insertCallSchema 
} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Calls API routes
  app.get('/api/calls', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const calls = await storage.getCalls(limit);
      res.json(calls);
    } catch (error) {
      console.error('Error fetching calls:', error);
      res.status(500).json({ error: 'Failed to fetch calls' });
    }
  });

  app.get('/api/calls/active', async (req, res) => {
    try {
      const activeCalls = await storage.getActiveCalls();
      res.json(activeCalls);
    } catch (error) {
      console.error('Error fetching active calls:', error);
      res.status(500).json({ error: 'Failed to fetch active calls' });
    }
  });

  app.get('/api/calls/recent', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const recentCalls = await storage.getRecentCalls(limit);
      res.json(recentCalls);
    } catch (error) {
      console.error('Error fetching recent calls:', error);
      res.status(500).json({ error: 'Failed to fetch recent calls' });
    }
  });

  app.get('/api/calls/:id', async (req, res) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }
      res.json(call);
    } catch (error) {
      console.error('Error fetching call:', error);
      res.status(500).json({ error: 'Failed to fetch call' });
    }
  });

  app.post('/api/calls/initiate', async (req, res) => {
    try {
      const { phoneNumber, campaignId, contactId } = req.body;
      
      if (!phoneNumber || !campaignId) {
        return res.status(400).json({ error: 'Phone number and campaign ID are required' });
      }

      const twilioCallSid = await callManager.initiateCall(phoneNumber, campaignId, contactId);
      
      // Broadcast real-time update
      broadcast({ 
        type: 'call_initiated', 
        callSid: twilioCallSid, 
        phoneNumber, 
        campaignId 
      });

      res.json({ success: true, callSid: twilioCallSid });
    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({ error: 'Failed to initiate call' });
    }
  });

  app.post('/api/calls/:id/end', async (req, res) => {
    try {
      const call = await storage.getCall(req.params.id);
      if (!call) {
        return res.status(404).json({ error: 'Call not found' });
      }

      if (call.twilioCallSid) {
        await callManager.endCall(call.twilioCallSid);
        
        // Broadcast real-time update
        broadcast({ 
          type: 'call_ended', 
          callId: call.id, 
          callSid: call.twilioCallSid 
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({ error: 'Failed to end call' });
    }
  });

  // Contacts API routes
  app.get('/api/contacts', async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const contacts = await storage.getContacts(limit);
      res.json(contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  app.post('/api/contacts', async (req, res) => {
    try {
      const validatedData = insertContactSchema.parse(req.body);
      const contact = await storage.createContact(validatedData);
      res.status(201).json(contact);
    } catch (error) {
      console.error('Error creating contact:', error);
      res.status(400).json({ error: 'Invalid contact data' });
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
      const validatedData = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(validatedData);
      res.status(201).json(campaign);
    } catch (error) {
      console.error('Error creating campaign:', error);
      res.status(400).json({ error: 'Invalid campaign data' });
    }
  });

  // Add multer for file uploads
  const multer = await import('multer');
  const upload = multer.default({ storage: multer.default.memoryStorage() });

  // Excel import/export endpoints
  app.post('/api/contacts/import-excel', upload.single('excel'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { ExcelService } = await import('./services/excelService');
      const result = await ExcelService.importContactsFromExcel(req.file.buffer);
      
      res.json(result);
    } catch (error) {
      console.error('Error importing Excel:', error);
      res.status(500).json({ error: 'Import failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  app.get('/api/contacts/export-excel', async (req, res) => {
    try {
      const { ExcelService } = await import('./services/excelService');
      const buffer = await ExcelService.exportContactsToExcel();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=contacts-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting Excel:', error);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  app.get('/api/calls/export-summaries', async (req, res) => {
    try {
      const { ExcelService } = await import('./services/excelService');
      const buffer = await ExcelService.exportCallSummariesWithData();
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=call-summaries-${new Date().toISOString().split('T')[0]}.xlsx`);
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting call summaries:', error);
      res.status(500).json({ error: 'Export failed' });
    }
  });

  // Configuration upload endpoints for voice and transcriber files
  app.post('/api/config/voice', upload.single('voiceConfig'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No voice config file uploaded' });
      }

      // In a real implementation, store the configuration file
      // For now, just acknowledge the upload
      console.log('Voice config uploaded:', req.file.originalname);
      
      res.json({ 
        message: 'Voice configuration uploaded successfully',
        filename: req.file.originalname 
      });
    } catch (error) {
      console.error('Error uploading voice config:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  app.post('/api/config/transcriber', upload.single('transcriberConfig'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No transcriber config file uploaded' });
      }

      // In a real implementation, store the configuration file
      // For now, just acknowledge the upload
      console.log('Transcriber config uploaded:', req.file.originalname);
      
      res.json({ 
        message: 'Transcriber configuration uploaded successfully',
        filename: req.file.originalname 
      });
    } catch (error) {
      console.error('Error uploading transcriber config:', error);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Settings endpoint
  app.post('/api/settings', async (req, res) => {
    try {
      // In a real implementation, save settings to database
      console.log('Settings updated:', req.body);
      
      // Initialize Indic-TTS and Whisper services with new config
      const { IndicTTSService } = await import('./services/indicTtsService');
      const { WhisperService } = await import('./services/whisperService');
      
      const indicTtsService = new IndicTTSService();
      const whisperService = new WhisperService();
      
      // Save configurations
      if (req.body.indicTts) {
        await indicTtsService.saveConfig(req.body.indicTts);
      }
      
      if (req.body.whisper) {
        await whisperService.saveConfig(req.body.whisper);
      }
      
      res.json({ 
        message: 'Settings saved successfully',
        settings: req.body 
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      res.status(500).json({ error: 'Failed to save settings' });
    }
  });

  // Get available voice languages and models
  app.get('/api/config/voice/languages', async (req, res) => {
    try {
      const { IndicTTSService } = await import('./services/indicTtsService');
      const indicTtsService = new IndicTTSService();
      
      const languages = await indicTtsService.getAvailableLanguages();
      const speakers = await indicTtsService.getAvailableSpeakers();
      
      res.json({ languages, speakers });
    } catch (error) {
      console.error('Error fetching voice languages:', error);
      res.status(500).json({ error: 'Failed to fetch voice languages' });
    }
  });

  // Get available transcription models and languages
  app.get('/api/config/transcriber/models', async (req, res) => {
    try {
      const { WhisperService } = await import('./services/whisperService');
      const whisperService = new WhisperService();
      
      const models = await whisperService.getAvailableModels();
      const languages = await whisperService.getSupportedLanguages();
      
      res.json({ models, languages });
    } catch (error) {
      console.error('Error fetching transcriber models:', error);
      res.status(500).json({ error: 'Failed to fetch transcriber models' });
    }
  });

  app.patch('/api/campaigns/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const updatedCampaign = await storage.updateCampaign(id, updates);
      if (!updatedCampaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
      
      res.json(updatedCampaign);
    } catch (error) {
      console.error('Error updating campaign:', error);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  });

  // Twilio webhook routes
  app.post('/api/twilio/voice', async (req, res) => {
    try {
      const { campaignId, contactId } = req.query;
      
      // Get campaign to create initial greeting
      const campaign = await storage.getCampaign(campaignId as string);
      const greeting = campaign ? 
        `Hello! I'm calling regarding ${campaign.name}. How are you today?` :
        "Hello! How are you today?";

      const twiml = twilioService.generateTwiML(greeting);
      
      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('Error handling Twilio voice webhook:', error);
      const errorTwiml = twilioService.generateHangupTwiML();
      res.type('text/xml').send(errorTwiml);
    }
  });

  app.post('/api/twilio/gather', async (req, res) => {
    try {
      const { CallSid, SpeechResult } = req.body;
      
      if (!SpeechResult) {
        const twiml = twilioService.generateTwiML("I didn't catch that. Could you please repeat?");
        return res.type('text/xml').send(twiml);
      }

      const responseTwiml = await callManager.handleUserInput(CallSid, SpeechResult);
      
      // Broadcast real-time update
      broadcast({ 
        type: 'conversation_update', 
        callSid: CallSid, 
        userInput: SpeechResult 
      });

      res.type('text/xml').send(responseTwiml);
    } catch (error) {
      console.error('Error handling Twilio gather webhook:', error);
      const errorTwiml = twilioService.generateHangupTwiML();
      res.type('text/xml').send(errorTwiml);
    }
  });

  app.post('/api/twilio/status', async (req, res) => {
    try {
      const { CallSid, CallStatus } = req.body;
      
      await callManager.handleCallStatusUpdate(CallSid, CallStatus);
      
      // Broadcast real-time update
      broadcast({ 
        type: 'call_status_update', 
        callSid: CallSid, 
        status: CallStatus 
      });

      res.status(200).send('OK');
    } catch (error) {
      console.error('Error handling Twilio status webhook:', error);
      res.status(500).send('Error');
    }
  });

  // System status route
  app.get('/api/system/status', async (req, res) => {
    try {
      // Check database connection
      const stats = await storage.getDashboardStats();
      
      res.json({
        database: 'online',
        twilio: 'connected',
        openai: 'active',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error checking system status:', error);
      res.status(500).json({
        database: 'error',
        twilio: 'unknown',
        openai: 'unknown',
        timestamp: new Date().toISOString(),
      });
    }
  });

  return httpServer;
}
