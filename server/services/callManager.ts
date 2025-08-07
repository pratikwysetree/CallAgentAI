import { OpenAIService } from './openaiService';
import { ElevenLabsService } from './elevenlabsService';
import { twilioService } from './twilioService';
import { storage } from '../storage';

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ActiveCall {
  id: string;
  contactId: string;
  campaignId: string;
  phoneNumber: string;
  twilioCallSid: string;
  conversationHistory: ConversationTurn[];
  status: 'active' | 'completed' | 'failed';
  startTime: Date;
}

export class CallManager {
  private activeCalls: Map<string, ActiveCall> = new Map();

  // Start a new call
  async startCall(
    contactId: string,
    campaignId: string,
    phoneNumber: string
  ): Promise<{ success: boolean; callId?: string; error?: string }> {
    try {
      // Get campaign details
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return { success: false, error: 'Campaign not found' };
      }

      // Create call record in database
      const newCall = await storage.createCall({
        contactId,
        campaignId,
        phoneNumber,
        status: 'active',
        startTime: new Date()
      });

      // Initiate Twilio call
      const twilioResult = await twilioService.initiateCall(
        phoneNumber,
        campaignId,
        newCall.id
      );

      if (!twilioResult.success) {
        // Update call status to failed
        await storage.updateCall(newCall.id, { status: 'failed' });
        return { success: false, error: twilioResult.error };
      }

      // Update call with Twilio SID
      await storage.updateCall(newCall.id, { 
        twilioCallSid: twilioResult.twilioCallSid 
      });

      // Track active call
      this.activeCalls.set(newCall.id, {
        id: newCall.id,
        contactId,
        campaignId,
        phoneNumber,
        twilioCallSid: twilioResult.twilioCallSid!,
        conversationHistory: [],
        status: 'active',
        startTime: new Date()
      });

      return { success: true, callId: newCall.id };
    } catch (error) {
      console.error('Error starting call:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Process speech input during call
  async processSpeechInput(
    callId: string,
    speechText: string
  ): Promise<{ twiml: string; success: boolean }> {
    try {
      const activeCall = this.activeCalls.get(callId);
      if (!activeCall) {
        return {
          twiml: twilioService.generateTwiML('hangup', { 
            text: 'Thank you for your time. Goodbye.' 
          }),
          success: false
        };
      }

      // Get campaign for script context
      const campaign = await storage.getCampaign(activeCall.campaignId);
      if (!campaign) {
        return {
          twiml: twilioService.generateTwiML('hangup', { 
            text: 'Thank you for your time. Goodbye.' 
          }),
          success: false
        };
      }

      // Add user message to conversation history
      activeCall.conversationHistory.push({
        role: 'user',
        content: speechText,
        timestamp: new Date()
      });

      // Add thinking pause with background typing sounds before generating response
      console.log('🎹 Adding thinking pause with background typing sounds for natural call flow');
      
      // Generate AI response  
      console.log(`🤖 Generating AI response for: "${speechText}"`);
      console.log(`📋 Using campaign context: "${campaign.aiPrompt?.substring(0, 50)}..."`);
      
      const aiResponse = await OpenAIService.generateResponse(
        speechText,
        campaign.script || campaign.aiPrompt,
        activeCall.conversationHistory.map(turn => ({
          role: turn.role,
          content: turn.content
        }))
      );
      
      console.log(`💬 AI response: "${aiResponse}"`);

      // Add AI response to conversation history
      activeCall.conversationHistory.push({
        role: 'assistant',
        content: aiResponse,
        timestamp: new Date()
      });

      // Save conversation to database
      try {
        await storage.createCallMessage({
          callId,
          role: 'user',
          content: speechText
        });
        await storage.createCallMessage({
          callId,
          role: 'assistant', 
          content: aiResponse
        });
        console.log('✅ Messages saved to database successfully');
      } catch (dbError) {
        console.error('❌ Database save error:', dbError);
      }

      // Check if conversation should end (after collecting contact info or max turns)
      const shouldEndCall = activeCall.conversationHistory.length >= 10 || 
                           aiResponse.toLowerCase().includes('thank you for your time') ||
                           aiResponse.toLowerCase().includes('goodbye');
      
      let twiml;
      if (shouldEndCall) {
        // End the call gracefully
        twiml = twilioService.generateTwiML('hangup', {
          text: aiResponse
        });
        // Mark call for completion
        setTimeout(() => this.completeCall(callId), 1000);
      } else {
        // Continue conversation with background typing effects
        twiml = twilioService.generateTwiML('gather', {
          text: aiResponse,
          action: `/api/calls/${callId}/process-speech`,
          voice: campaign.voiceId, // Use campaign voice
          addTypingSound: true // Enable background typing sounds
        });
      }

      // Broadcast real-time update
      this.broadcastCallUpdate(activeCall);

      return { twiml, success: true };
    } catch (error) {
      console.error('❌ Error processing speech input:', error);
      console.error('Error details:', error instanceof Error ? error.message : 'Unknown error');
      return {
        twiml: twilioService.generateTwiML('hangup', { 
          text: 'I apologize, there was a technical issue. Thank you for your time.' 
        }),
        success: false
      };
    }
  }

  // Handle call completion
  async completeCall(callId: string, duration?: number): Promise<void> {
    try {
      const activeCall = this.activeCalls.get(callId);
      if (!activeCall) return;

      // Update call status in database
      await storage.updateCall(callId, {
        status: 'completed',
        endTime: new Date(),
        duration: duration || Math.floor((Date.now() - activeCall.startTime.getTime()) / 1000)
      });

      // Remove from active calls
      this.activeCalls.delete(callId);

      // Generate call summary using AI
      const summary = await this.generateCallSummary(activeCall.conversationHistory);
      if (summary) {
        await storage.updateCall(callId, { conversationSummary: summary });
      }

      // Extract contact information and send follow-up if needed
      await this.processPostCallActions(callId, activeCall.conversationHistory);

      console.log(`Call ${callId} completed successfully`);
    } catch (error) {
      console.error('Error completing call:', error);
    }
  }

  // Generate call summary using AI
  private async generateCallSummary(conversationHistory: ConversationTurn[]): Promise<string> {
    try {
      const conversationText = conversationHistory
        .map(turn => `${turn.role}: ${turn.content}`)
        .join('\n');

      const summary = await OpenAIService.generateResponse(
        `Please provide a brief summary of this call conversation:\n${conversationText}`,
        "Generate a concise call summary focusing on key points discussed and outcomes.",
        []
      );

      return summary;
    } catch (error) {
      console.error('Error generating call summary:', error);
      return 'Call completed - summary generation failed';
    }
  }

  // Process post-call actions (WhatsApp follow-up, contact updates)
  private async processPostCallActions(callId: string, conversationHistory: ConversationTurn[]): Promise<void> {
    try {
      // Extract WhatsApp/email from conversation if mentioned
      const conversationText = conversationHistory
        .map(turn => turn.content)
        .join(' ');

      // Simple regex to extract WhatsApp numbers and emails
      const whatsappMatch = conversationText.match(/(\+?[\d\s\-\(\)]{10,})/);
      const emailMatch = conversationText.match(/[\w\.-]+@[\w\.-]+\.\w+/);

      if (whatsappMatch || emailMatch) {
        const extractedWhatsapp = whatsappMatch ? whatsappMatch[1].replace(/\D/g, '') : undefined;
        const extractedEmail = emailMatch ? emailMatch[0] : undefined;

        // Update call record with extracted data
        await storage.updateCall(callId, {
          extractedWhatsapp,
          extractedEmail
        });

        // Send follow-up WhatsApp message if number was extracted
        if (extractedWhatsapp) {
          const message = "Thank you for your time during our call. We'll follow up with the information discussed about LabsCheck partnerships.";
          const result = await twilioService.sendWhatsAppMessage(extractedWhatsapp, message);
          
          if (result.success) {
            await storage.updateCall(callId, { whatsappSent: true });
          }
        }
      }
    } catch (error) {
      console.error('Error processing post-call actions:', error);
    }
  }

  // Get active calls
  getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  // Get call by ID
  getCall(callId: string): ActiveCall | undefined {
    return this.activeCalls.get(callId);
  }

  // Broadcast call updates via WebSocket
  private broadcastCallUpdate(call: ActiveCall): void {
    try {
      const broadcastFn = (global as any).broadcastToClients;
      if (broadcastFn) {
        broadcastFn({
          type: 'call_update',
          call: {
            id: call.id,
            status: call.status,
            conversationHistory: call.conversationHistory,
            duration: Math.floor((Date.now() - call.startTime.getTime()) / 1000)
          }
        });
      }
    } catch (error) {
      console.error('Error broadcasting call update:', error);
    }
  }
}

// Export singleton instance
export const callManager = new CallManager();