import { twilioService } from './twilio';
import { openaiService, type ConversationContext } from './openai';
import { storage } from '../storage';
import type { CallWithDetails } from '@shared/schema';

export interface ActiveCall {
  id: string;
  twilioCallSid: string;
  conversationContext: ConversationContext;
  startTime: Date;
}

export class CallManager {
  private activeCalls = new Map<string, ActiveCall>();

  async initiateCall(phoneNumber: string, campaignId: string, contactId?: string): Promise<string> {
    try {
      // Get campaign details
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Get or create contact
      let contact = contactId ? await storage.getContact(contactId) : undefined;
      if (!contact) {
        contact = await storage.getContactByPhone(phoneNumber);
      }

      // Initiate Twilio call
      const twilioCallSid = await twilioService.initiateCall({
        to: phoneNumber,
        campaignId,
        contactId: contact?.id?.toString(),
      });

      // Set up simple conversation context
      const conversationContext: ConversationContext = {
        campaignPrompt: "Hi this is Aavika from LabsCheck, how are you doing today",
        conversationHistory: [],
        contactName: contact?.name,
        phoneNumber,
      };

      // Store active call
      const activeCall: ActiveCall = {
        id: twilioCallSid,
        twilioCallSid,
        conversationContext,
        startTime: new Date(),
      };

      this.activeCalls.set(twilioCallSid, activeCall);

      return twilioCallSid;
    } catch (error) {
      console.error('Error initiating call:', error);
      throw error;
    }
  }

  async handleUserInput(twilioCallSid: string, userInput: string): Promise<string> {
    try {
      console.log(`🔍 [CALLMANAGER] Starting handleUserInput for call: ${twilioCallSid}`);
      const activeCall = this.activeCalls.get(twilioCallSid);
      if (!activeCall) {
        console.log(`❌ [CALLMANAGER] Active call not found for: ${twilioCallSid}`);
        throw new Error('Active call not found');
      }
      console.log(`✅ [CALLMANAGER] Active call found, proceeding...`);

      // Log customer input for debugging
      console.log(`\n🎯 ===========================================`);
      console.log(`👤 [CUSTOMER SAID] "${userInput}"`);
      console.log(`📞 [CALL STATE] Total messages: ${activeCall.conversationContext.conversationHistory.length}`);
      console.log(`🔄 [CONVERSATION HISTORY]`);
      activeCall.conversationContext.conversationHistory.forEach((msg, i) => {
        console.log(`   ${i+1}. ${msg.role}: "${msg.content}"`);
      });
      console.log(`🎯 ===========================================\n`);
      
      // Get AI response
      console.log(`🧠 [AI REQUEST] Calling OpenAI with input: "${userInput}"`);
      const aiResponse = await openaiService.generateResponse(
        activeCall.conversationContext,
        userInput
      );
      console.log(`🧠 [AI SUCCESS] OpenAI returned response`);
      
      console.log(`🤖 [AI RESPONSE] "${aiResponse.message}"`);
      console.log(`📊 [EXTRACTED DATA]`, JSON.stringify(aiResponse.extractedData, null, 2));
      console.log(`🎯 [END CALL FLAG] ${aiResponse.shouldEndCall}`);

      // Update conversation history
      activeCall.conversationContext.conversationHistory.push(
        { role: 'user', content: userInput },
        { role: 'assistant', content: aiResponse.message }
      );

      // Store message in database
      const call = await storage.getCallByTwilioSid(twilioCallSid);
      if (call) {
        await storage.createCallMessage({
          callId: call.id,
          role: 'user',
          content: userInput,
        });

        await storage.createCallMessage({
          callId: call.id,
          role: 'assistant',
          content: aiResponse.message,
        });

        // Update call with AI metrics and extracted data
        await storage.updateCall(call.id, {
          aiResponseTime: aiResponse.responseTime,
          collectedData: aiResponse.extractedData,
        });
      }

      // Check if AI wants to end call OR if we have collected both contact details
      const extractedData = aiResponse.extractedData || {};
      const hasCompleteContact = extractedData.contact_complete === 'yes' || 
                                (extractedData.whatsapp_number && extractedData.email);
      
      // End call if AI determines it should end OR contact details are complete
      if (aiResponse.shouldEndCall || hasCompleteContact || extractedData.customer_interest === 'not_interested') {
        console.log(`🏁 [CALL END] Ending call - AI decision: ${aiResponse.shouldEndCall}, Contact complete: ${hasCompleteContact}, Interest: ${extractedData.customer_interest}`);
        await this.endCall(twilioCallSid);
        const hangupTwiml = await twilioService.generateHangupTwiML();
        console.log(`📞 [HANGUP TWIML] Generated: ${hangupTwiml.substring(0, 100)}...`);
        return hangupTwiml;
      }

      // Get campaign ID for voice synthesis
      const callRecord = await storage.getCallByTwilioSid(twilioCallSid);
      const campaignId = callRecord?.campaignId;

      console.log(`🗣️ [GENERATING RESPONSE] Creating TwiML for: "${aiResponse.message}"`);
      const continueTwiml = await twilioService.generateTwiML(aiResponse.message, campaignId || undefined);
      console.log(`🗣️ [CONTINUE TWIML] Generated length: ${continueTwiml.length}`);
      return continueTwiml;
    } catch (error) {
      console.error('Error handling user input:', error);
      return await twilioService.generateTwiML("I'm sorry, I'm having technical difficulties. Let me end this call.");
    }
  }

  async endCall(twilioCallSid: string): Promise<void> {
    try {
      const activeCall = this.activeCalls.get(twilioCallSid);
      if (activeCall) {
        // Generate conversation summary
        const summary = await openaiService.generateConversationSummary(
          activeCall.conversationContext.conversationHistory
        );

        // Update call record
        const call = await storage.getCallByTwilioSid(twilioCallSid);
        if (call) {
          const duration = Math.floor((Date.now() - activeCall.startTime.getTime()) / 1000);
          
          // Calculate success score
          const campaign = await storage.getCampaign(call.campaignId!);
          const successScore = campaign ? await openaiService.calculateSuccessScore(
            call.collectedData as Record<string, any> || {},
            campaign.aiPrompt
          ) : 50;

          await storage.updateCall(call.id, {
            status: 'completed',
            endTime: new Date(),
            duration,
            conversationSummary: summary,
            successScore,
          });

          // Update or create contact with collected data
          if (call.collectedData && call.contactId) {
            const extractedData = call.collectedData as Record<string, any>;
            await storage.updateContact(call.contactId, {
              name: extractedData.name || undefined,
              email: extractedData.email || undefined,
              company: extractedData.company || undefined,
              notes: extractedData.notes || undefined,
              whatsappNumber: extractedData.whatsapp_number || undefined,
            });
          } else if (call.collectedData) {
            // Create new contact if we collected a name
            const extractedData = call.collectedData as Record<string, any>;
            if (extractedData.name) {
            const newContact = await storage.createContact({
              name: extractedData.name,
              phone: call.phoneNumber,
              email: extractedData.email || undefined,
              company: extractedData.company || undefined,
              notes: extractedData.notes || undefined,
              whatsappNumber: extractedData.whatsapp_number || undefined,
            });

            await storage.updateCall(call.id, {
              contactId: newContact.id.toString(),
            });
            }
          }
        }

        // Remove from active calls
        this.activeCalls.delete(twilioCallSid);
      }

      // End Twilio call
      await twilioService.endCall(twilioCallSid);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  getActiveCalls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  async handleCallStatusUpdate(twilioCallSid: string, status: string): Promise<void> {
    const call = await storage.getCallByTwilioSid(twilioCallSid);
    if (!call) return;

    switch (status) {
      case 'completed':
      case 'failed':
      case 'busy':
      case 'no-answer':
        await this.endCall(twilioCallSid);
        await storage.updateCall(call.id, {
          status: status === 'completed' ? 'completed' : 'failed',
          endTime: new Date(),
        });
        break;
      case 'answered':
        await storage.updateCall(call.id, { status: 'active' });
        break;
    }
  }
}

export const callManager = new CallManager();
