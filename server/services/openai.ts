import OpenAI from "openai";
import { storage } from '../storage';
import type { Campaign } from '@shared/schema';

const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_SECRET_KEY;

if (!apiKey) {
  throw new Error('OpenAI API key not found. Please set OPENAI_API_KEY environment variable.');
}

const openai = new OpenAI({ apiKey });

export interface ConversationContext {
  campaignPrompt: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  contactName?: string;
  phoneNumber: string;
}

export interface AIResponse {
  message: string;
  shouldEndCall: boolean;
  extractedData?: Record<string, any>;
  responseTime: number;
}

export class OpenAIService {
  async generateResponse(context: ConversationContext, userInput: string): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Create dynamic conversation state-based prompt
      const conversationHistory = context.conversationHistory;
      const isFirstMessage = conversationHistory.length === 0;
      
      let conversationState = "greeting";
      if (conversationHistory.length > 0) {
        const lastResponse = conversationHistory[conversationHistory.length - 1];
        if (lastResponse.content.includes("WhatsApp") || lastResponse.content.includes("number")) {
          conversationState = "collecting_whatsapp";
        } else if (lastResponse.content.includes("email") || lastResponse.content.includes("Email")) {
          conversationState = "collecting_email";
        } else if (lastResponse.content.includes("thank") || lastResponse.content.includes("Thank")) {
          conversationState = "closing";
        }
      }

      const systemPrompt = `You are Aavika from LabsCheck platform calling to discuss lab partnership opportunities.

ABOUT LABSCHECK:
LabsCheck is a healthcare platform founded in 2025 on a mission to make diagnostic healthcare in India transparent and user-friendly.

BUSINESS MODEL & MISSION:
- LabsCheck is NOT a laboratory - we're a neutral aggregator platform
- We don't collect samples, perform tests, or charge commissions
- Our goal: Partner with ALL laboratories across India to create transparency
- Mission: Bridge the gap between people seeking tests and labs offering diagnostics
- Zero middleman cost, full transparency, total convenience

WHAT WE DO:
- Connect users to NABL-accredited/ICMR certified labs across 140+ Indian cities
- Help labs get more customers through our platform
- Provide real-time pricing comparison with no hidden charges
- Enable online booking with location-based lab discovery
- We're like a personal health-check assistant - always available, always transparent

CURRENT STATUS (2025):
- Over 500+ labs listed on platform
- 100k+ users trust us to find best lab deals
- Partnered with top-tier diagnostic providers across India
- Featured in healthcare publications for innovation
- All partner labs are verified and certified

LAB PARTNERSHIP OPPORTUNITY:
- Join 500+ labs already on our platform
- Get direct customer bookings with zero commission
- Transparent pricing helps customers choose you
- Location-based discovery brings nearby customers
- No hidden fees - what customers see is what they pay you directly

POPULAR TESTS ON PLATFORM:
- Blood Glucose (Fasting) - Starting ₹180
- Hemoglobin Test - Starting ₹200  
- ESR Test - Starting ₹250
- Thyroid (TSH) - Starting ₹350
- Complete Blood Count (CBC) - Starting ₹400
- Vitamin D - Starting ₹800

PARTNER LABS: Dr Lal PathLabs, Thyrocare, Metropolis, Apollo Diagnostics, Redcliffe Labs, Pathkind, and 500+ more

WEBSITE: labscheck.com

CUSTOMER SAID (may have speech recognition errors): "${userInput}"

SPEECH PATTERN UNDERSTANDING:
- "hay I bi ka what ise D App se ware r u call ine from" = "Hello, I want to know what is this app and where are you calling from"
- "abhi kam Lenge tab about u" = "I'm busy now, will take details later about you"
- Broken English/Hindi mix is common due to phone quality

RESPOND APPROPRIATELY:
- If confused/don't understand → "LabsCheck ek website hai jo patients ko labs connect karta hai. Aap pathology lab chalate hain? Free listing mil sakti hai."
- If asking what/why/where → "LabsCheck platform hai jo labs ko zyada customers deta hai. Aap lab owner hain? WhatsApp number denge?"
- If lab owner/interested → "Bahut accha! 500+ labs already partner hain, zero commission. Customers direct aapke paas jaate hain. WhatsApp number?"
- If asking about partnership → "Bilkul free hai - aapki lab website pe listing, customers aapko directly contact karte hain. WhatsApp number?"
- If asking about services → "Hum patients ko labs dhundne mein help karte hain, aapko customers milte hain. Aap lab chalate hain? WhatsApp?"
- If current lab partner → "Perfect! More business ke liye expansion plan share karte hain. WhatsApp number?"
- If saying fine/good/theek → "Great! Partnership details WhatsApp pe send karenge. Number de dijiye?"
- If giving number → "Excellent! Email ID bhi chahiye partnership documentation ke liye?"
- If giving email → "Thank you! Saari details send kar denge partnership ki"
- If busy/later → "Bas 2 minute, WhatsApp number de dijiye, details send kar denge"

IMPORTANT: If customer is confused, EXPLAIN clearly that LabsCheck helps labs get more patients, it's FREE, and they get customers directly.

KEEP responses SHORT but CLEAR. If customer is confused, explain briefly what LabsCheck does BEFORE asking for WhatsApp. Always ask for contact info.

Extract any useful information mentioned during the conversation and format it as JSON in your response.

Respond with a JSON object:
{
  "message": "Your natural Hinglish response (1 sentence only)",
  "shouldEndCall": false,
  "extractedData": {
    "whatsapp_number": "value if mentioned",
    "email": "value if mentioned", 
    "contact_complete": "yes/no - yes when you have both WhatsApp and email",
    "customer_interest": "interested/not_interested/neutral",
    "notes": "what customer said"
  }
}`;

      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...context.conversationHistory,
        { role: "user" as const, content: `Customer just said: "${userInput}". Acknowledge what they said and respond contextually to their exact words.` }
      ];

      // Enhanced model selection for better Hinglish understanding
      const model = "gpt-4o"; // Full model for better language understanding
      console.log(`🧠 [AI MODEL] Using ${model} for Hinglish conversation`);
      
      const response = await openai.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.3, // Lower temperature for more predictable responses
      });

      const responseTime = Date.now() - startTime;
      const aiResponse = JSON.parse(response.choices[0].message.content || '{}');

      return {
        message: aiResponse.message || "I'm sorry, could you repeat that?",
        shouldEndCall: aiResponse.shouldEndCall || false,
        extractedData: aiResponse.extractedData || {},
        responseTime,
      };
    } catch (error: any) {
      console.error('Error generating AI response:', error);
      const responseTime = Date.now() - startTime;
      
      // Handle quota errors with contextual conversation system
      if (error.status === 429 || error.code === 'insufficient_quota') {
        console.log('OpenAI quota exceeded - using contextual conversation logic');
        
        // CONTEXTUAL CONVERSATION SYSTEM - responds based on what customer actually said
        const customerSaid = userInput.toLowerCase();
        let response = "";
        let shouldEndCall = false;
        let extractedData: Record<string, any> = {};
        
        // Response logic based on customer's exact words
        if (customerSaid.includes("fine") || customerSaid.includes("good") || customerSaid.includes("theek") || customerSaid.includes("accha")) {
          response = "Great! Can you share your WhatsApp number?";
          extractedData.customer_interest = "interested";
        } 
        else if (customerSaid.includes("what") || customerSaid.includes("why") || customerSaid.includes("kya") || customerSaid.includes("kyon")) {
          response = "We want to share our lab test details with you";
          extractedData.customer_interest = "neutral";
        }
        else if (customerSaid.match(/\d{10}/)) { // Phone number detected
          const phoneMatch = customerSaid.match(/\d{10}/);
          response = "Perfect! Now can you share your email ID?";
          extractedData.whatsapp_number = phoneMatch ? phoneMatch[0] : "";
          extractedData.customer_interest = "interested";
        }
        else if (customerSaid.includes("@") || customerSaid.includes("email") || customerSaid.includes("gmail")) {
          response = "Thank you! We'll send you the details soon";
          extractedData.email = userInput.match(/\S+@\S+\.\S+/)?.[0] || "provided";
          extractedData.contact_complete = "yes";
          shouldEndCall = true;
        }
        else if (customerSaid.includes("not interested") || customerSaid.includes("no") || customerSaid.includes("nahi")) {
          response = "No problem. Have a good day!";
          extractedData.customer_interest = "not_interested";
          shouldEndCall = true;
        }
        else {
          // Default response for unclear input
          response = "Can you share your WhatsApp number for lab details?";
          extractedData.customer_interest = "neutral";
        }
        
        extractedData.notes = `Customer said: "${userInput}"`;
        
        return {
          message: response,
          shouldEndCall,
          extractedData,
          responseTime,
        };
      }
      
      return {
        message: "Sorry sir, thoda technical issue hai. Main dubara call karunga. Dhanyawad!",
        shouldEndCall: true,
        extractedData: {
          notes: "Technical error - Hindi farewell provided"
        },
        responseTime,
      };
    }
  }

  async generateConversationSummary(messages: Array<{ role: string; content: string }>): Promise<string> {
    try {
      const conversationText = messages
        .map(msg => `${msg.role === 'user' ? 'Customer' : 'Agent'}: ${msg.content}`)
        .join('\n');

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Summarize this conversation between an AI agent and a customer. Focus on key points discussed, information collected, and the overall outcome. Keep it concise but comprehensive."
          },
          {
            role: "user",
            content: conversationText
          }
        ],
        max_tokens: 200,
      });

      return response.choices[0].message.content || "No summary available";
    } catch (error: any) {
      console.error('Error generating conversation summary:', error);
      
      // Handle quota errors gracefully
      if (error.status === 429 || error.code === 'insufficient_quota') {
        return "Call completed successfully. Summary temporarily unavailable due to service limits.";
      }
      
      return "Call completed successfully. Summary generation failed.";
    }
  }

  async calculateSuccessScore(extractedData: Record<string, any>, campaignObjectives: string): Promise<number> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `Rate the success of this call on a scale of 1-100 based on how well it achieved the campaign objectives. Consider the quality and completeness of data collected. Respond with just a number between 1 and 100.`
          },
          {
            role: "user",
            content: `Campaign Objectives: ${campaignObjectives}\n\nData Collected: ${JSON.stringify(extractedData)}`
          }
        ],
        max_tokens: 10,
      });

      const score = parseInt(response.choices[0].message.content || "50");
      return Math.max(1, Math.min(100, score));
    } catch (error: any) {
      console.error('Error calculating success score:', error);
      
      // Handle quota errors gracefully
      if (error.status === 429 || error.code === 'insufficient_quota') {
        console.log('OpenAI quota exceeded - using default success score of 75');
        return 75; // Default success score when quota exceeded
      }
      
      return 50; // Default moderate score for other errors
    }
  }
}

export const openaiService = new OpenAIService();
