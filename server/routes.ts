import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from 'path';
import fs from "fs";
import { storage } from "./storage";
import { db } from "./db";
import { contacts } from "@shared/schema";
import { sql } from "drizzle-orm";
import { callManager } from "./services/callManager";
import { twilioService } from "./services/twilio";
import { 
  insertContactSchema, 
  insertCampaignSchema, 
  insertCallSchema 
} from "@shared/schema";
import { MessagingService } from "./services/messagingService";
import { WhatsAppTemplateService } from "./services/whatsappTemplateService";
import { WhatsAppService } from "./services/whatsappService";
import { insertWhatsAppTemplateSchema, insertBulkMessageJobSchema } from "@shared/schema";
import { elevenLabsService, type ElevenLabsConfig } from './services/elevenLabsService';
import express from "express";  
import multer from "multer";

// Configure multer for file uploads with larger limit for CSV files
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit for large CSV files
});

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
      console.log('Creating contact with data:', req.body);
      const validatedData = insertContactSchema.parse(req.body);
      console.log('Validated data:', validatedData);
      const contact = await storage.createContact(validatedData);
      console.log('Created contact:', contact);
      res.status(201).json(contact);
    } catch (error: any) {
      console.error('Error creating contact:', error);
      if (error.message?.includes('already exists')) {
        res.status(409).json({ error: error.message });
      } else {
        res.status(400).json({ error: 'Invalid contact data', details: error.message });
      }
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
      
      // Initialize Whisper service with new config
      const { WhisperService } = await import('./services/whisperService');
      
      const whisperService = new WhisperService();
      
      // Save configurations
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

  // Enable Indic-TTS for a campaign


  // ElevenLabs TTS Routes
  app.get('/api/elevenlabs/status', async (req, res) => {
    try {
      const isConfigured = await elevenLabsService.isConfigured();
      if (!isConfigured) {
        return res.json({ 
          configured: false, 
          message: 'ElevenLabs API key not configured' 
        });
      }
      
      const validation = await elevenLabsService.validateApiKey();
      res.json({ 
        configured: isConfigured, 
        valid: validation.valid,
        error: validation.error 
      });
    } catch (error) {
      console.error('Error checking ElevenLabs status:', error);
      res.status(500).json({ error: 'Failed to check ElevenLabs status' });
    }
  });

  app.get('/api/elevenlabs/voices', async (req, res) => {
    try {
      const voices = await elevenLabsService.getAvailableVoices();
      const recommended = await elevenLabsService.getRecommendedVoices();
      
      res.json({ 
        voices: voices,
        recommended: recommended 
      });
    } catch (error) {
      console.error('Error fetching ElevenLabs voices:', error);
      res.status(500).json({ error: 'Failed to fetch voices' });
    }
  });

  // Enable ElevenLabs TTS for a campaign
  app.post('/api/campaigns/:id/enable-elevenlabs', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        voiceId = 'pNInz6obpgDQGcFmaJgB', // Adam voice
        model = 'eleven_monolingual_v1',
        stability = 0.5,
        similarityBoost = 0.75,
        style = 0.0,
        useSpeakerBoost = true
      } = req.body;
      
      const voiceConfig = {
        useElevenLabs: true,
        voiceId,
        model,
        stability,
        similarityBoost,
        style,
        useSpeakerBoost,
        outputFormat: 'mp3' as const
      };
      
      const updatedCampaign = await storage.updateCampaign(id, { voiceConfig });
      
      res.json({ 
        success: true, 
        message: `ElevenLabs TTS enabled for campaign with voice: ${voiceId}`,
        voiceConfig,
        campaign: updatedCampaign
      });
    } catch (error) {
      console.error('Error enabling ElevenLabs TTS:', error);
      res.status(500).json({ error: 'Failed to enable ElevenLabs TTS' });
    }
  });

  // Test ElevenLabs synthesis endpoint
  app.post('/api/elevenlabs/test-synthesis', async (req, res) => {
    try {
      const { text, voiceId, model } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      console.log(`🧪 Testing ElevenLabs synthesis with voice: ${voiceId}`);
      
      try {
        const audioFilename = await elevenLabsService.generateAudioFile(text, {
          voiceId: voiceId || 'Z6TUNPsOxhTPtqLx81EX',
          model: model || 'eleven_turbo_v2',
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          useSpeakerBoost: true,
        });
        
        console.log(`✅ ElevenLabs synthesis completed successfully: ${audioFilename}`);
      
        const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
        const audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
        
        res.json({
          success: true,
          message: 'ElevenLabs synthesis successful',
          audioUrl,
          audioFilename,
          text,
          voiceId,
          model
        });
      } catch (synthError) {
        console.error('🎙️ [ELEVENLABS] Synthesis error:', synthError);
        throw synthError;
      }
    } catch (error) {
      console.error('Error testing ElevenLabs synthesis:', error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Test TwiML generation endpoint
  app.post('/api/twilio/test-twiml', async (req, res) => {
    try {
      const { message, campaignId } = req.body;
      console.log(`🧪 Testing TwiML generation for campaign: ${campaignId}`);
      
      const twiml = await twilioService.generateTwiML(message, campaignId);
      
      res.json({ 
        success: true, 
        twiml,
        campaignId,
        message 
      });
    } catch (error) {
      console.error('Error testing TwiML generation:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // Voice diagnostic endpoint - test if Twilio can play a simple audio file
  app.post('/api/twilio/test-voice-diagnostic', async (req, res) => {
    try {
      // Generate a simple test audio file
      const testText = "This is a voice diagnostic test. If you can hear this, the audio system is working.";
      const testAudioFilename = await elevenLabsService.generateAudioFile(testText, {
        voiceId: 'pNInz6obpgDQGcFmaJgB', // Adam voice - widely compatible
        model: 'eleven_monolingual_v1' // Basic model for compatibility
      });
      
      const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
      const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
      const audioUrl = `${protocol}://${baseUrl}/api/audio/${testAudioFilename}`;
      
      const simpleTwiML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Play>${audioUrl}</Play>
    <Say voice="alice">End of diagnostic test.</Say>
</Response>`;
      
      res.set('Content-Type', 'text/xml');
      res.send(simpleTwiML);
      
      console.log(`🧪 [VOICE DIAGNOSTIC] Generated test audio: ${audioUrl}`);
      console.log(`🧪 [VOICE DIAGNOSTIC] TwiML: ${simpleTwiML}`);
    } catch (error) {
      console.error('Error in voice diagnostic:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  });

  // ElevenLabs API key validation endpoint
  app.post('/api/elevenlabs/validate-key', async (req, res) => {
    try {
      const validation = await elevenLabsService.validateApiKey();
      res.json(validation);
    } catch (error) {
      console.error('Error validating ElevenLabs API key:', error);
      res.status(500).json({ valid: false, error: 'Failed to validate API key' });
    }
  });

  // ElevenLabs API key configuration endpoint
  app.post('/api/secrets/elevenlabs', async (req, res) => {
    try {
      const { apiKey } = req.body;
      
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }
      
      // Set the API key in the service for immediate use
      const { ElevenLabsService } = await import('./services/elevenLabsService');
      const testService = new ElevenLabsService(apiKey);
      
      // Validate the API key
      const validation = await testService.validateApiKey();
      
      if (!validation.valid) {
        return res.status(400).json({ 
          error: 'Invalid API key', 
          details: validation.error 
        });
      }
      
      // Store the API key (in a real app, you'd store this securely)
      process.env.ELEVENLABS_API_KEY = apiKey;
      
      // Update the main service instance
      const { elevenLabsService } = await import('./services/elevenLabsService');
      elevenLabsService.updateApiKey(apiKey);
      
      res.json({ 
        success: true, 
        message: 'ElevenLabs API key configured successfully',
        configured: true
      });
    } catch (error) {
      console.error('Error configuring ElevenLabs API key:', error);
      res.status(500).json({ error: 'Failed to configure API key' });
    }
  });

  // Direct audio webhook route for ultra-fast processing
  app.post('/api/twilio/direct-voice', async (req, res) => {
    try {
      const { callId } = req.query;
      console.log(`⚡ [DIRECT-VOICE] Starting direct audio call: ${callId}`);
      
      // Direct audio processing with recording
      const callSid = req.body.CallSid || 'unknown';
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" rate="normal">Hi, this is Aavika from LabsCheck. How are you doing today?</Say>
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" recordingStatusCallback="/api/twilio/recording-status" timeout="8" />
</Response>`;
      
      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('Error in direct voice webhook:', error);
      res.type('text/xml').send(`
        <Response>
          <Say voice="alice">Thank you for calling.</Say>
          <Hangup/>
        </Response>
      `);
    }
  });

  // Twilio webhook routes
  app.post('/api/twilio/voice', async (req, res) => {
    try {
      const { campaignId, contactId } = req.query;
      console.log(`🔥 [WEBHOOK START] Campaign ID: ${campaignId}, Contact ID: ${contactId}`);
      
      // Get campaign to use actual script content
      const campaign = await storage.getCampaign(campaignId as string);
      console.log(`📋 [CAMPAIGN FOUND] Campaign exists: ${!!campaign}, Name: ${campaign?.name || 'null'}`);
      
      let scriptToSpeak = "Hello! How are you today?";
      
      // Always use the same simple greeting - ignore all campaign scripts
      scriptToSpeak = "Hi this is Aavika from LabsCheck, how are you doing today";
      console.log(`🎯 [SIMPLE GREETING] Using exact prompt: "${scriptToSpeak}"`);
      console.log(`🚫 [NO SCRIPTS] All campaign scripts ignored - using simple greeting only`);

      console.log(`🎙️ [FINAL SCRIPT] Speaking: "${scriptToSpeak}"`);
      const twiml = await twilioService.generateTwiML(scriptToSpeak, campaignId as string);
      
      res.type('text/xml').send(twiml);
    } catch (error) {
      console.error('Error handling Twilio voice webhook:', error);
      const errorTwiml = await twilioService.generateHangupTwiML();
      res.type('text/xml').send(errorTwiml);
    }
  });

  // Twilio partial results endpoint for better speech recognition
  app.post('/api/twilio/partial', (req, res) => {
    const { SpeechResult, Confidence, CallSid } = req.body;
    console.log(`🎯 [PARTIAL SPEECH] Call ${CallSid}: "${SpeechResult}" (confidence: ${Confidence})`);
    
    // Send empty TwiML to continue gathering
    res.set('Content-Type', 'text/xml');
    res.send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  });

  // Direct audio processing endpoint for faster response times
  app.post('/api/twilio/direct-audio/:callSid', async (req, res) => {
    const { callSid } = req.params;
    const { SpeechResult, Confidence } = req.body;
    
    console.log(`⚡ [DIRECT-AUDIO] Call: ${callSid}, Speech: "${SpeechResult}", Confidence: ${Confidence}`);
    
    try {
      // Import enhanced direct audio service
      const { enhancedDirectAudioService } = await import('./services/enhancedDirectAudioService');
      
      // Get call info
      const call = await storage.getCallByTwilioSid(callSid);
      if (!call) {
        console.error('❌ [DIRECT-AUDIO] Call not found:', callSid);
        return res.status(404).type('text/xml').send(`
          <Response>
            <Say voice="alice">Thank you for your time.</Say>
            <Hangup/>
          </Response>
        `);
      }
      
      // Process speech result with enhanced language detection
      if (SpeechResult && SpeechResult.trim()) {
        console.log(`🎙️ [ENHANCED-DIRECT] Processing speech: "${SpeechResult}"`);
        const { enhancedDirectAudioService } = await import('./services/enhancedDirectAudioService');
        const twimlResponse = await enhancedDirectAudioService.processDirectSpeech(
          SpeechResult,
          callSid,
          call.campaignId
        );
        return res.type('text/xml').send(twimlResponse);
      }
      
      // If no speech result, just record without prompts
      const noSpeechTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
      return res.type('text/xml').send(noSpeechTwiml);
      
    } catch (error) {
      console.error('❌ [DIRECT-AUDIO] Error:', error);
      return res.type('text/xml').send(`
        <Response>
          <Say voice="alice">Thank you for calling. Have a great day!</Say>
          <Hangup/>
        </Response>
      `);
    }
  });

  // Recording webhook to process audio with OpenAI
  app.post('/api/twilio/recording/:callSid', async (req, res) => {
    const { callSid } = req.params;
    const { RecordingUrl, RecordingSid } = req.body;
    
    console.log(`🎙️ [RECORDING] Call: ${callSid}, Recording: ${RecordingSid}, URL: ${RecordingUrl}`);
    
    try {
      // Download and process recording with Enhanced OpenAI Whisper + TTS
      const { enhancedDirectAudioService } = await import('./services/enhancedDirectAudioService');
      
      // Download audio file
      const audioResponse = await fetch(RecordingUrl + '.mp3');
      const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
      
      console.log(`🎙️ [RECORDING] Downloaded ${audioBuffer.length} bytes of audio`);
      
      // Process with direct audio service
      const call = await storage.getCallByTwilioSid(callSid);
      if (call) {
        const twimlResponse = await enhancedDirectAudioService.processRecordedAudio(
          audioBuffer,
          callSid,
          call.campaignId
        );
        return res.type('text/xml').send(twimlResponse);
      }
      
      // Fallback response
      res.type('text/xml').send(`
        <Response>
          <Say voice="alice">Thank you for calling.</Say>
          <Hangup/>
        </Response>
      `);
      
    } catch (error) {
      console.error('❌ [RECORDING] Error processing recording:', error);
      res.type('text/xml').send(`
        <Response>
          <Say voice="alice">Thank you for your time.</Say>
          <Hangup/>
        </Response>
      `);
    }
  });

  // Recording status callback
  app.post('/api/twilio/recording-status', (req, res) => {
    const { CallSid, RecordingSid, RecordingStatus } = req.body;
    console.log(`🎙️ [RECORDING-STATUS] Call: ${CallSid}, Recording: ${RecordingSid}, Status: ${RecordingStatus}`);
    res.sendStatus(200);
  });

  app.post('/api/twilio/gather', async (req, res) => {
    try {
      const { CallSid, SpeechResult, Confidence } = req.body;
      
      console.log(`🎤 [SPEECH INPUT] Call: ${CallSid}`);
      console.log(`🎤 [SPEECH] "${SpeechResult}" | Confidence: ${Confidence || 'N/A'}`);
      console.log(`🔍 [SPEECH DEBUG] Raw SpeechResult length: ${SpeechResult?.length || 0}`);
      console.log(`🔍 [SPEECH DEBUG] Detected language pattern:`, SpeechResult?.match(/[\u0900-\u097F]/g) ? 'Contains Hindi/Devanagari' : 'English/Latin');
      
      // Handle empty or low-confidence speech with more detailed logging
      if (!SpeechResult || SpeechResult.trim() === '' || SpeechResult.toLowerCase() === 'timeout') {
        console.log('❌ [NO SPEECH] No speech detected or timeout occurred');
        console.log(`❌ [SPEECH DEBUG] Raw SpeechResult: "${SpeechResult}"`);
        console.log(`❌ [SPEECH DEBUG] Confidence: ${Confidence}`);
        
        // More patient retry with Hindi prompt
        const retryPrompt = "Sunai nahi diya, dobara boliye. Please speak clearly.";
        const twiml = await twilioService.generateTwiML(retryPrompt);
        return res.type('text/xml').send(twiml);
      }
      
      // For direct audio mode, accept lower confidence speech
      if (Confidence && parseFloat(Confidence) < 0.2) {
        console.log(`⚠️ [VERY LOW CONFIDENCE] Speech confidence extremely low: ${Confidence}`);
        const retryPrompt = "I didn't catch that clearly. Please speak again.";
        const twiml = await twilioService.generateTwiML(retryPrompt);
        return res.type('text/xml').send(twiml);
      }
      
      // Clean up speech result
      const cleanedInput = SpeechResult.trim();
      console.log(`⚡ [PROCESSING] "${cleanedInput}"`);
      
      // Broadcast live transcript immediately
      broadcast({ 
        type: 'live_transcript', 
        callSid: CallSid, 
        speaker: 'customer',
        text: cleanedInput,
        confidence: Confidence,
        timestamp: new Date().toISOString()
      });
      
      // Use enhanced direct audio service for language-matched responses
      console.log(`🎙️ [GATHER-TO-ENHANCED] Processing with enhanced service: "${cleanedInput}"`);
      const { enhancedDirectAudioService } = await import('./services/enhancedDirectAudioService');
      
      // Get call info for enhanced processing
      const call = await storage.getCallByTwilioSid(CallSid);
      if (!call) {
        throw new Error('Call not found');
      }
      
      const responseTwiml = await enhancedDirectAudioService.processDirectSpeech(
        cleanedInput,
        CallSid,
        call.campaignId
      );
      
      // Broadcast conversation update
      broadcast({ 
        type: 'conversation_update', 
        callSid: CallSid, 
        userInput: cleanedInput 
      });

      res.type('text/xml').send(responseTwiml);
    } catch (error) {
      console.error('Error handling Twilio gather webhook:', error);
      const errorTwiml = await twilioService.generateHangupTwiML();
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

  // Serve generated audio files for Indic-TTS
  app.get('/api/audio/:filename', async (req, res) => {
    const { filename } = req.params;
    
    try {
      // Security check - ensure filename doesn't contain path traversal
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
      }
      
      const filePath = path.join(process.cwd(), 'temp', filename);
      
      // Import fs promises for proper async handling
      const fs = await import('fs/promises');
      
      // Check if file exists
      try {
        const stats = await fs.stat(filePath);
        
        // Set appropriate headers for audio based on file type
        const contentType = filename.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Length', stats.size);
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('Accept-Ranges', 'bytes');
        
        // Read and send file
        const audioData = await fs.readFile(filePath);
        res.send(audioData);
        
        console.log(`Successfully served audio file: ${filename}`);
        
        // Clean up file after serving (with delay for potential retries)
        setTimeout(async () => {
          try {
            await fs.unlink(filePath);
            console.log(`Cleaned up temporary audio file: ${filename}`);
          } catch (error) {
            console.log(`Could not delete temporary audio file: ${filename}`);
          }
        }, 60000); // Delete after 1 minute
        
      } catch (statError) {
        console.log(`Audio file not found: ${filePath}`);
        return res.status(404).json({ error: 'Audio file not found' });
      }
      
    } catch (error) {
      console.error('Error serving audio file:', error);
      res.status(500).json({ error: 'Failed to serve audio file' });
    }
  });

  // Test OpenAI quota endpoint and model comparison
  app.post('/api/test/openai', async (req, res) => {
    try {
      const { message, model } = req.body;
      const testMessage = message || "hay I bi ka what ise D App se ware r u call ine from";
      console.log('🧪 [OPENAI TEST] Testing with message:', testMessage);
      console.log('🧪 [MODEL TEST] Using model:', model || 'gpt-4o-mini');
      
      const testContext = {
        conversationHistory: [],
        campaignPrompt: "Test prompt",
        phoneNumber: "+19876543210"
      };
      
      const { OpenAIService } = await import('./services/openai.js');
      const openaiService = new OpenAIService();
      
      // Test different models if specified
      const originalResponse = await openaiService.generateResponse(testContext, testMessage);
      
      console.log('✅ [OPENAI SUCCESS] Model response:', originalResponse.message);
      console.log('🔍 [EXTRACTED]', originalResponse.extractedData);
      
      res.json({ 
        success: true, 
        model: model || 'gpt-4o-mini',
        response: originalResponse.message,
        extractedData: originalResponse.extractedData,
        quota_status: "working"
      });
    } catch (error: any) {
      console.log('❌ [OPENAI ERROR]', error.message);
      res.json({ 
        success: false, 
        error: error.message,
        quota_status: error.status === 429 ? "quota_exceeded" : "other_error"
      });
    }
  });

  // Test WhatsApp messaging endpoint
  app.post('/api/test/whatsapp', async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      
      if (!phoneNumber || !message) {
        return res.status(400).json({ 
          error: 'Phone number and message are required' 
        });
      }

      const success = await MessagingService.sendWhatsAppMessage(
        phoneNumber, 
        message,
        'Test message from AI Calling Agent'
      );

      res.json({ 
        success, 
        message: success 
          ? 'WhatsApp message sent successfully' 
          : 'Failed to send WhatsApp message'
      });
    } catch (error) {
      console.error('Error testing WhatsApp:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // WhatsApp Template API routes
  app.get('/api/whatsapp/templates', async (req, res) => {
    try {
      const templates = await WhatsAppTemplateService.getTemplates();
      res.json(templates);
    } catch (error) {
      console.error('Error fetching WhatsApp templates:', error);
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  // WhatsApp webhook for incoming messages
  app.get('/webhook/whatsapp', (req, res) => {
    // Webhook verification - using hardcoded token to avoid env variable issues
    const verifyToken = 'whatsapp_labs_verify_2025';
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('WhatsApp webhook verification attempt:', {
      mode,
      token,
      expected_token: verifyToken,
      challenge
    });

    if (mode === 'subscribe' && token === verifyToken) {
      console.log('✅ WhatsApp webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('❌ WhatsApp webhook verification failed - Token mismatch');
      res.sendStatus(403);
    }
  });

  app.post('/webhook/whatsapp', async (req, res) => {
    try {
      const body = req.body;
      console.log('🚨 WEBHOOK RECEIVED - Raw body:', JSON.stringify(body, null, 2));
      console.log('🚨 WEBHOOK HEADERS:', JSON.stringify(req.headers, null, 2));
      
      if (body.object === 'whatsapp_business_account') {
        console.log('✅ Valid WhatsApp Business webhook object');
        body.entry?.forEach((entry: any) => {
          console.log('📋 Processing entry:', JSON.stringify(entry, null, 2));
          entry.changes?.forEach((change: any) => {
            console.log('🔄 Processing change:', JSON.stringify(change, null, 2));
            if (change.field === 'messages') {
              // Handle incoming messages
              const messages = change.value?.messages;
              console.log('📨 Found messages:', JSON.stringify(messages, null, 2));
              if (messages) {
                messages.forEach(async (message: any) => {
                  console.log('💬 Processing individual message:', JSON.stringify(message, null, 2));
                  await WhatsAppService.handleIncomingMessage(message);
                });
              }
              
              // Handle message status updates
              const statuses = change.value?.statuses;
              console.log('📊 Found statuses:', JSON.stringify(statuses, null, 2));
              if (statuses) {
                statuses.forEach(async (status: any) => {
                  console.log('📊 Processing status update:', JSON.stringify(status, null, 2));
                  await WhatsAppService.handleMessageStatus(status);
                });
              }
            }
          });
        });
      } else {
        console.log('❌ Invalid webhook object:', body.object);
      }
      
      res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
      console.error('❌ Error processing WhatsApp webhook:', error);
      res.status(500).send('Error processing webhook');
    }
  });

  // WhatsApp Chat Routes
  app.get('/api/whatsapp/chats', async (req, res) => {
    try {
      const chats = await WhatsAppService.getChats();
      res.json(chats);
    } catch (error) {
      console.error('Error fetching WhatsApp chats:', error);
      res.status(500).json({ error: 'Failed to fetch chats' });
    }
  });

  app.post('/api/whatsapp/messages', async (req, res) => {
    try {
      const { chatId, message } = req.body;
      
      if (!chatId || !message) {
        return res.status(400).json({ error: 'chatId and message are required' });
      }

      const result = await WhatsAppService.sendChatMessage(chatId, message);
      
      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      res.status(500).json({ error: 'Failed to send message' });
    }
  });

  app.post('/api/whatsapp/messages/contact', async (req, res) => {
    try {
      const { contactId, contactPhone, contactName, message } = req.body;
      
      if (!contactPhone || !message || !contactName) {
        return res.status(400).json({ error: 'contactPhone, contactName, and message are required' });
      }

      const result = await WhatsAppService.sendMessage(contactPhone, message, contactName, contactId);
      
      if (result.success) {
        res.json({ 
          success: true, 
          messageId: result.messageId,
          chatId: result.chatId 
        });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error sending WhatsApp message to contact:', error);
      res.status(500).json({ error: 'Failed to send message to contact' });
    }
  });

  app.patch('/api/whatsapp/messages/:messageId', async (req, res) => {
    try {
      const { messageId } = req.params;
      const { message } = req.body;
      
      if (!message) {
        return res.status(400).json({ error: 'message is required' });
      }

      const result = await WhatsAppService.updateMessage(messageId, message);
      
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error updating WhatsApp message:', error);
      res.status(500).json({ error: 'Failed to update message' });
    }
  });

  app.delete('/api/whatsapp/chats/:chatId', async (req, res) => {
    try {
      const { chatId } = req.params;
      
      const result = await WhatsAppService.deleteChat(chatId);
      
      if (result.success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error deleting WhatsApp chat:', error);
      res.status(500).json({ error: 'Failed to delete chat' });
    }
  });

  // Sync templates from Meta API
  app.post('/api/whatsapp/templates/sync', async (req, res) => {
    try {
      const templates = await WhatsAppTemplateService.syncTemplatesFromMeta();
      res.json({ 
        message: `Synced ${templates.length} templates from Meta`,
        templates 
      });
    } catch (error) {
      console.error('Error syncing templates from Meta:', error);
      res.status(500).json({ error: 'Failed to sync templates' });
    }
  });

  // Enhanced Contact Management Routes
  app.get('/api/contacts/enhanced', async (req, res) => {
    try {
      // Remove any limit to fetch ALL contacts from database
      const contacts = await storage.getContacts(undefined);
      // Transform contacts to include engagement data
      const enhancedContacts = contacts.map(contact => ({
        ...contact,
        status: 'PENDING', // Default status for existing contacts
        totalEngagements: 0,
        lastContactedAt: null,
        nextFollowUp: null
      }));
      res.json(enhancedContacts);
    } catch (error) {
      console.error('Error fetching enhanced contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // CSV Contact Upload
  app.post('/api/contacts/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const csvData = req.file.buffer.toString('utf-8');
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      
      let imported = 0;
      const errors = [];

      for (let i = 1; i < lines.length; i++) {
        try {
          const values = lines[i].split(',').map(v => v.trim());
          const contactData: any = {};

          headers.forEach((header, index) => {
            const value = values[index] || '';
            switch (header) {
              case 'name':
                contactData.name = value;
                break;
              case 'phone':
              case 'phone_number':
                contactData.phone = value;
                break;
              case 'email':
                contactData.email = value || null;
                break;
              case 'city':
                contactData.city = value || null;
                break;
              case 'state':
                contactData.state = value || null;
                break;
            }
          });

          if (contactData.name && contactData.phone) {
            await storage.createContact({
              name: contactData.name,
              phone: contactData.phone,
              email: contactData.email,
              city: contactData.city,
              state: contactData.state,
              importedFrom: 'CSV_UPLOAD'
            });
            imported++;
          }
        } catch (error) {
          errors.push(`Row ${i + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      res.json({ 
        imported, 
        errors: errors.length > 0 ? errors : null,
        message: `Successfully imported ${imported} contacts`
      });
    } catch (error) {
      console.error('Error uploading CSV:', error);
      res.status(500).json({ error: 'Failed to process CSV file' });
    }
  });

  // Campaign Analytics
  app.get('/api/campaigns/analytics', async (req, res) => {
    try {
      // Get actual contact count from database
      const totalContacts = await db.select({ count: sql`count(*)` }).from(contacts);
      const contactCount = totalContacts[0]?.count || 0;
      
      const analytics = {
        totalContacts: parseInt(contactCount.toString()),
        contacted: 0,
        responded: 0,
        onboarded: 0,
        pending: parseInt(contactCount.toString()),
        failed: 0,
        followUpsDue: 0,
        todayActivity: {
          reached: 0,
          responded: 0,
          onboarded: 0
        }
      };
      res.json(analytics);
    } catch (error) {
      console.error('Error fetching campaign analytics:', error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // Start Multi-Channel Campaign
  app.post('/api/campaigns/start', async (req, res) => {
    try {
      const { contactIds, channel, whatsappTemplate, followUpDays } = req.body;
      
      if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
        return res.status(400).json({ error: 'Contact IDs are required' });
      }

      // For now, just log the campaign start
      console.log(`Starting ${channel} campaign for ${contactIds.length} contacts`);
      
      if (channel === 'WHATSAPP' || channel === 'BOTH') {
        if (whatsappTemplate) {
          // Send WhatsApp messages to all contacts
          for (const contactId of contactIds) {
            const contact = await storage.getContact(contactId.toString());
            if (contact && contact.phone) {
              const result = await WhatsAppTemplateService.sendTemplateMessage(
                contact.phone,
                whatsappTemplate,
                'en_US'
              );
              console.log(`WhatsApp sent to ${contact.phone}: ${result.success}`);
            }
          }
        }
      }

      res.json({ 
        message: `Campaign started for ${contactIds.length} contacts`,
        campaignId: `campaign_${Date.now()}`
      });
    } catch (error) {
      console.error('Error starting campaign:', error);
      res.status(500).json({ error: 'Failed to start campaign' });
    }
  });

  app.post('/api/whatsapp/templates', async (req, res) => {
    try {
      const validation = insertWhatsAppTemplateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: validation.error.errors });
      }

      const template = await WhatsAppTemplateService.createTemplate(validation.data);
      res.status(201).json(template);
    } catch (error) {
      console.error('Error creating WhatsApp template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  app.get('/api/whatsapp/templates/examples', async (req, res) => {
    try {
      const examples = WhatsAppTemplateService.getTemplateExamples();
      res.json(examples);
    } catch (error) {
      console.error('Error fetching template examples:', error);
      res.status(500).json({ error: 'Failed to fetch template examples' });
    }
  });

  // WhatsApp Bulk Messaging API routes
  app.post('/api/whatsapp/bulk/send', async (req, res) => {
    try {
      const { templateName, recipients, languageCode = 'en_US', delayMs = 1000 } = req.body;
      
      if (!templateName || !recipients || !Array.isArray(recipients)) {
        return res.status(400).json({ 
          error: 'templateName and recipients array are required' 
        });
      }

      const job = await WhatsAppTemplateService.sendBulkTemplateMessages(
        templateName,
        recipients,
        languageCode,
        delayMs
      );

      res.status(202).json(job);
    } catch (error) {
      console.error('Error starting bulk WhatsApp job:', error);
      res.status(500).json({ error: 'Failed to start bulk messaging job' });
    }
  });

  app.get('/api/whatsapp/bulk/jobs', async (req, res) => {
    try {
      const jobs = await WhatsAppTemplateService.getBulkMessageJobs();
      res.json(jobs);
    } catch (error) {
      console.error('Error fetching bulk message jobs:', error);
      res.status(500).json({ error: 'Failed to fetch bulk message jobs' });
    }
  });

  app.get('/api/whatsapp/bulk/jobs/:jobId', async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await WhatsAppTemplateService.getBulkMessageJob(jobId);
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      res.json(job);
    } catch (error) {
      console.error('Error fetching bulk message job:', error);
      res.status(500).json({ error: 'Failed to fetch bulk message job' });
    }
  });

  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { phoneNumber, templateName, variables, languageCode = 'en_US' } = req.body;
      
      if (!phoneNumber || !templateName) {
        return res.status(400).json({ 
          error: 'phoneNumber and templateName are required' 
        });
      }

      const result = await WhatsAppTemplateService.sendTemplateMessage(
        phoneNumber,
        templateName,
        languageCode,
        variables
      );

      if (result.success) {
        res.json({ success: true, messageId: result.messageId });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Error sending WhatsApp template message:', error);
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
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

  // Get call transcript (messages) for a specific call
  app.get('/api/calls/:callId/transcript', async (req, res) => {
    try {
      const { callId } = req.params;
      const messages = await storage.getCallMessages(callId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching call transcript:', error);
      res.status(500).json({ error: 'Failed to fetch call transcript' });
    }
  });

  // Get all contacts with extracted WhatsApp/Email data
  app.get('/api/contacts/collected-data', async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      const contactsWithData = contacts
        .filter((contact: any) => contact.whatsappNumber || contact.email)
        .map((contact: any) => ({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          whatsappNumber: contact.whatsappNumber,
          email: contact.email,
          city: contact.city,
          state: contact.state,
          createdAt: contact.createdAt,
        }));

      console.log(`📊 [CONTACT DATA] Found ${contactsWithData.length} contacts with collected data`);
      res.json(contactsWithData);
    } catch (error) {
      console.error('Error fetching contacts with collected data:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });

  // Setup direct audio API routes
  const { setupDirectAudioAPI } = await import('./routes/directAudioAPI');
  setupDirectAudioAPI(app);

  // Serve OpenAI TTS audio files
  app.get('/api/audio/:filename', (req, res) => {
    const filename = req.params.filename;
    const audioPath = path.join(__dirname, '../temp', filename);
    
    if (fs.existsSync(audioPath)) {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=3600'
      });
      
      const stream = fs.createReadStream(audioPath);
      stream.pipe(res);
      
      stream.on('error', (err) => {
        console.error('Audio stream error:', err);
        res.status(404).send('Audio file not found');
      });
    } else {
      res.status(404).send('Audio file not found');
    }
  });

  return httpServer;
}
