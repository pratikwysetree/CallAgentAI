import { openaiRealtimeService } from './openaiRealtime';
import { twilioService } from './twilio';
import { storage } from '../storage';
import WebSocket from 'ws';

interface RealtimeCall {
  id: string;
  contactId: string;
  campaignId: string;
  twilioCallSid: string;
  openaiSession: WebSocket | null;
  startTime: Date;
  status: 'connecting' | 'active' | 'ending' | 'completed';
}

export class RealtimeCallManager {
  private activeCalls = new Map<string, RealtimeCall>();

  async initiateRealtimeCall(contactId: string, campaignId: string): Promise<string> {
    try {
      console.log('🚀 [REALTIME-CALL] Starting realtime call...');
      
      // Get contact and campaign details
      const contact = await storage.getContact(contactId);
      const campaign = await storage.getCampaign(campaignId);
      
      if (!contact || !campaign) {
        throw new Error('Contact or campaign not found');
      }

      // Create call record
      const call = await storage.createCall({
        contactId,
        campaignId,
        phoneNumber: contact.phoneNumber,
        status: 'initiated',
        callType: 'realtime'
      });

      // Create OpenAI Realtime session
      const ephemeralKey = await openaiRealtimeService.createRealtimeSession();
      const openaiSession = await openaiRealtimeService.connectRealtimeSession(ephemeralKey);

      // Initiate Twilio call with realtime webhook
      const twilioCallSid = await twilioService.initiateRealtimeCall(
        contact.phoneNumber,
        call.id
      );

      // Store active call
      const realtimeCall: RealtimeCall = {
        id: call.id,
        contactId,
        campaignId,
        twilioCallSid,
        openaiSession,
        startTime: new Date(),
        status: 'connecting'
      };

      this.activeCalls.set(twilioCallSid, realtimeCall);
      
      console.log(`✅ [REALTIME-CALL] Call initiated: ${twilioCallSid}`);
      return twilioCallSid;

    } catch (error) {
      console.error('❌ [REALTIME-CALL] Failed to initiate call:', error);
      throw error;
    }
  }

  async handleCallConnected(twilioCallSid: string) {
    const call = this.activeCalls.get(twilioCallSid);
    if (!call) {
      console.error('❌ [REALTIME-CALL] Call not found:', twilioCallSid);
      return;
    }

    console.log('📞 [REALTIME-CALL] Call connected, starting AI conversation');
    
    // Update call status
    call.status = 'active';
    await storage.updateCall(call.id, { 
      status: 'in_progress',
      startedAt: new Date()
    });

    // Start the conversation with OpenAI
    const welcomeMessage = "session.create"; // OpenAI will handle the initial greeting
  }

  async handleAudioStream(twilioCallSid: string, audioData: Buffer) {
    const call = this.activeCalls.get(twilioCallSid);
    if (!call || !call.openaiSession) {
      console.error('❌ [REALTIME-CALL] No active session for audio:', twilioCallSid);
      return;
    }

    // Forward audio directly to OpenAI Realtime API
    openaiRealtimeService.sendAudioChunk(audioData);
  }

  async handleSpeechComplete(twilioCallSid: string) {
    const call = this.activeCalls.get(twilioCallSid);
    if (!call) return;

    console.log('🎤 [REALTIME-CALL] Speech complete, committing to OpenAI');
    
    // Commit the audio input to OpenAI for processing
    openaiRealtimeService.commitAudioInput();
  }

  async handleOpenAIAudioResponse(twilioCallSid: string, audioData: Buffer): Promise<string> {
    console.log('🔊 [REALTIME-CALL] Received audio response from OpenAI');
    
    // Convert OpenAI audio to TwiML for playback
    // Note: This would need proper audio format conversion
    const twimlResponse = `
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>${audioData.toString('base64')}</Play>
        <Record action="/api/twilio/realtime/recording/${twilioCallSid}" maxLength="10" playBeep="false" timeout="8" />
      </Response>
    `;

    return twimlResponse;
  }

  async endRealtimeCall(twilioCallSid: string) {
    const call = this.activeCalls.get(twilioCallSid);
    if (!call) return;

    console.log('🏁 [REALTIME-CALL] Ending realtime call');

    // Close OpenAI session
    if (call.openaiSession) {
      openaiRealtimeService.closeSession();
    }

    // Update call status
    call.status = 'completed';
    await storage.updateCall(call.id, {
      status: 'completed',
      endedAt: new Date(),
      duration: Math.round((Date.now() - call.startTime.getTime()) / 1000)
    });

    // Remove from active calls
    this.activeCalls.delete(twilioCallSid);

    console.log('✅ [REALTIME-CALL] Call ended successfully');
  }

  getActiveRealtimeCalls(): RealtimeCall[] {
    return Array.from(this.activeCalls.values());
  }
}

export const realtimeCallManager = new RealtimeCallManager();