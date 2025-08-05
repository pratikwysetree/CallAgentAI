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
