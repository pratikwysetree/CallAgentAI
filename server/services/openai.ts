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

      const systemPrompt = `You are Aavika from LabsCheck pathology lab. You just said: "Hi this is Aavika from LabsCheck, how are you doing today"

The customer responded: "${userInput}"

Respond naturally to what they said. Keep it SHORT and conversational. Your goal is to get their WhatsApp number and email to share lab details.

- If they say they're fine/good → Ask for WhatsApp number  
- If they ask what this is about → Say you want to share lab details
- If they give WhatsApp → Ask for email
- If they give email → Thank and end call
- If not interested → Say okay and end call

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
        { role: "user" as const, content: `Customer just said: "${userInput}". Respond naturally to these specific words in Hinglish.` }
      ];

      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        response_format: { type: "json_object" },
        max_tokens: 500,
        temperature: 0.7,
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
