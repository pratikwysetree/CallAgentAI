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

      // Speed-optimized flow tracking
      const flowStart = Date.now();
      console.log(`⚡ [FLOW START] "${userInput}"`);
      
      const aiResponse = await openaiService.generateResponse(
        activeCall.conversationContext,
        userInput
      );
      const aiTime = Date.now() - flowStart;
      console.log(`🧠 [AI DONE] ${aiTime}ms | "${aiResponse.message}"`);
      
      // Broadcast AI response transcript
      const { broadcast } = require('../routes');
      broadcast({ 
        type: 'live_transcript', 
        callSid: twilioCallSid, 
        speaker: 'agent',
        text: aiResponse.message,
        timestamp: new Date().toISOString()
      });
      
      // Generate TwiML response with speed tracking

      // Update conversation history
      activeCall.conversationContext.conversationHistory.push(
        { role: 'user', content: userInput },
        { role: 'assistant', content: aiResponse.message }
      );

      // Async database operations to not block response
      setImmediate(async () => {
        try {
          const call = await storage.getCallByTwilioSid(twilioCallSid);
          if (call) {
            await Promise.all([
              storage.createCallMessage({ callId: call.id, role: 'user', content: userInput }),
              storage.createCallMessage({ callId: call.id, role: 'assistant', content: aiResponse.message }),
              storage.updateCall(call.id, { aiResponseTime: aiResponse.responseTime, collectedData: aiResponse.extractedData })
            ]);
            
            // Handle contact updates and WhatsApp async
            const extractedData = aiResponse.extractedData || {};
            if (call.contactId && (extractedData.whatsapp_number || extractedData.email)) {
              const updateData: any = {};
              if (extractedData.whatsapp_number) updateData.whatsappNumber = extractedData.whatsapp_number;
              if (extractedData.email) updateData.email = extractedData.email;
              
              await storage.updateContact(call.contactId, updateData);
              
              if (extractedData.whatsapp_number && !call.whatsappSent) {
                await this.sendRealTimeWhatsAppMessage(extractedData.whatsapp_number, call.campaignId!);
                await storage.updateCall(call.id, { whatsappSent: true });
              }
            }
          }
        } catch (error) {
          console.error('Background DB operations error:', error);
        }
      });

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

      // Get campaign ID from active call context
      const campaignId = activeCall.conversationContext.campaignPrompt.split(' ')[0] || undefined;

      const audioStart = Date.now();
      console.log(`🗣️ [AUDIO START] Generating: "${aiResponse.message}"`);
      const continueTwiml = await twilioService.generateTwiML(aiResponse.message, campaignId || undefined);
      const audioTime = Date.now() - audioStart;
      const totalTime = Date.now() - flowStart;
      console.log(`🎤 [AUDIO DONE] ${audioTime}ms | Total: ${totalTime}ms`);
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

  // Real-time WhatsApp messaging during call
  async sendRealTimeWhatsAppMessage(whatsappNumber: string, campaignId: string): Promise<void> {
    try {
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) return;
      
      // Format WhatsApp number
      const formattedNumber = whatsappNumber.startsWith('+') ? whatsappNumber : `+91${whatsappNumber}`;
      const whatsappTo = `whatsapp:${formattedNumber}`;
      
      // Send LabsCheck lab partnership details
      const message = `🔬 *LabsCheck - Lab Partnership Platform*\n\nधन्यवाद for your interest! LabsCheck is India's leading lab aggregator platform connecting customers to verified labs.\n\n🏥 *Partnership Benefits:*\n• Join 500+ partner labs already listed\n• Zero commission - you keep 100% payment\n• Get direct customer bookings\n• Free platform listing\n• 100k+ users trust our platform\n\n💰 *Business Growth:*\n• Transparent pricing attracts customers\n• Location-based discovery brings nearby patients\n• No hidden fees - customers pay you directly\n• Featured in healthcare publications\n\n🏆 *Current Partners:*\nDr Lal PathLabs, Thyrocare, Metropolis, Apollo Diagnostics, Redcliffe Labs, Pathkind & 500+ more\n\n✅ *Why Partner with LabsCheck:*\n• NABL-accredited/ICMR certified labs only\n• Across 140+ Indian cities\n• Zero middleman cost\n• Full transparency for customers\n• Easy online booking system\n\n🌐 Partner with us: labscheck.com\n📞 Growing network across India\n\nJoin the platform helping labs grow their business! 🌟`;
      
      const { TwilioService } = await import('./twilio.js');
      const twilioService = new TwilioService();
      const result = await twilioService.sendWhatsAppMessage(whatsappTo, message);
      
      if (result.success) {
        console.log(`✅ [REAL-TIME WHATSAPP] Message sent successfully to ${formattedNumber}`);
      } else {
        console.log(`❌ [REAL-TIME WHATSAPP] Failed to send message to ${formattedNumber}`);
      }
    } catch (error) {
      console.error('Error sending real-time WhatsApp message:', error);
    }
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
