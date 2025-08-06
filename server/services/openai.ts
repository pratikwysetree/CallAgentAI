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

      const systemPrompt = `You are Aavika, representing LabsCheck - India's first diagnostic aggregator platform calling pathology labs for partnership opportunities.

LABSCHECK ACCURATE INFORMATION:
- India's pioneering diagnostic aggregator platform
- Connects trusted NABL accredited pathology labs with patients
- Zero commission model - labs keep 100% earnings
- Enhanced online visibility and direct patient access
- Building trusted diagnostic network across India

CUSTOMER INPUT: "${userInput}"

CONVERSATION GUIDELINES:
1. Professional Opening: Introduce LabsCheck and partnership opportunity
2. Owner Verification: Confirm speaking with lab owner
3. Non-owner: Request owner contact/WhatsApp for forwarding
4. LabsCheck Benefits: Enhanced visibility, zero commission, NABL network
5. Partnership Details: Portal access for test menu and pricing
6. Contact Collection: WhatsApp/email for official documentation

RESPONSE STYLE:
- Professional yet conversational Hinglish
- Concise responses (under 40 words)
- Address their specific query directly
- Focus on partnership value proposition

RESPOND WITH JSON:
{
  "message": "Your professional response addressing their input",
  "shouldEndCall": false,
  "extractedData": {
    "whatsapp_number": "if mentioned",
    "email": "if mentioned",
    "lab_owner_confirmed": "true/false",
    "interest_level": "interested/neutral/not_interested",
    "contact_information_provided": "complete/partial/none"
  }
}`;

      // Natural conversation flow - let AI understand customer directly
      const messages = [
        { role: "system" as const, content: systemPrompt },
        ...context.conversationHistory.map(msg => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content
        })),
        { role: "user" as const, content: userInput }
      ];

      // Use fast model for sub-2s response time
      const model = "gpt-4o-mini"; // Fastest model for under 2s response
      console.log(`🧠 [AI] Model: ${model} | Input: "${userInput}"`);
      console.log(`🔍 [AI DEBUG] Input contains Hindi:`, userInput.match(/[\u0900-\u097F]/g) ? 'YES' : 'NO');
      console.log(`🔍 [AI DEBUG] Input phonetic analysis:`, userInput.replace(/कम रेट/g, '🚨[KAM RATE]🚨').replace(/I am great/gi, '✅[I AM GREAT]✅'));
      
      const response = await openai.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
        max_tokens: 80, // Aggressive reduction for sub-1s AI response
        temperature: 0.01, // Absolute minimal randomness for fastest generation
      });

      const responseTime = Date.now() - startTime;
      let aiResponse;
      try {
        aiResponse = JSON.parse(response.choices[0].message.content || '{}');
      } catch (parseError) {
        console.error('❌ [AI JSON PARSE ERROR]:', parseError);
        console.log('❌ [AI RAW CONTENT]:', response.choices[0].message.content);
        
        // Fallback to simple response if JSON parsing fails
        const rawContent = response.choices[0].message.content || '';
        aiResponse = {
          message: rawContent.includes('"message"') ? 
            rawContent.split('"message"')[1]?.split('"')[1] || "Great to hear! Can I get your WhatsApp number for lab partnership details?" :
            "Great to hear! Can I get your WhatsApp number for lab partnership details?",
          shouldEndCall: false,
          extractedData: {}
        };
      }

      console.log(`🧠 [AI DONE] ${responseTime}ms | "${aiResponse.message}"`);
      console.log(`🔍 [AI RESPONSE DEBUG] Input was: "${userInput}" → Output: "${aiResponse.message}"`);

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
