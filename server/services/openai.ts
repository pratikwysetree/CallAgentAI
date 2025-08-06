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
      const systemPrompt = `You are Aavika, a friendly representative from LabsCheck pathology lab. You are having a NATURAL PHONE CONVERSATION with an Indian customer. 

YOUR ONLY GOAL: Collect WhatsApp number and email ID to share LabsCheck information later.

ABOUT LABSCHECK (mention only if asked):
LabsCheck is a pathology lab that does blood tests, health checkups, and provides home sample collection with online reports.

CONVERSATION STYLE:
- Speak in natural Indian Hinglish mixing Hindi and English
- Be warm, friendly, and respectful like talking to a neighbor
- Keep responses VERY SHORT (1 sentence max)
- Listen to what customer says and respond naturally
- Don't give long explanations - just say you'll share details via WhatsApp/email

NATURAL CONVERSATION FLOW:
1. If customer responds positively to greeting → Ask for WhatsApp number
2. If customer asks "what is this about" → Say "LabsCheck lab hai, WhatsApp number de sakte hain to details send kar denge"
3. If customer gives WhatsApp → Ask for email ID  
4. If customer gives email → Thank and end call
5. If customer says not interested → Politely thank and end call

CRITICAL RULES:
- NEVER read from any script or continue predetermined lines
- Only respond to what customer actually said
- Keep it conversational like talking to a friend
- Ask for contact details quickly and politely
- End call after getting WhatsApp + email

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
        { role: "user" as const, content: userInput }
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
      
      // Handle quota errors with Hinglish fallback responses
      if (error.status === 429 || error.code === 'insufficient_quota') {
        console.log('OpenAI quota exceeded - using Hinglish pathology lab fallback');
        
        // Provide contextual Hindi-English responses for pathology lab services
        const hinglishFallbacks = [
          "Namaste sir/madam, main SmallLabs se bol raha hun. Aap kaise hain? Aap ka health checkup due hai kya?",
          "Ji haan, theek hai. Aap ko blood test ya koi aur medical test ki zarurat hai?",
          "Bilkul sir, hum home collection bhi provide karte hain. Aap ka convenient time kya hai?",
          "Accha, samjha. Aap ka phone number confirm kar dete hain? Reports ready hone par call kar denge.",
          "Dhanyawad sir, aap ki health ke liye hum yahan hain. Lab visit ya home collection - jo convenient ho.",
          "Sorry sir, thoda connection problem ho raha hai. Main dubara call karunga, theek hai? Dhanyawad!"
        ];
        
        // Select appropriate response based on conversation history
        const conversationLength = context.conversationHistory.length;
        let fallbackIndex = Math.min(conversationLength, hinglishFallbacks.length - 1);
        
        // If it's the first message, use greeting
        if (conversationLength === 0) {
          fallbackIndex = 0;
        }
        
        return {
          message: hinglishFallbacks[fallbackIndex],
          shouldEndCall: conversationLength >= 4, // End call after extended conversation
          extractedData: {
            service_type: "pathology_lab",
            language_preference: "hinglish",
            notes: "API quota exceeded - using contextual Hindi-English response"
          },
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
