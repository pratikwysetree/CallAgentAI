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
  campaignScript?: string; // Full script for AI to reference conversation flow
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
      // Build conversational system prompt with proper flow guidance
      let conversationGuidance = '';
      if (context.campaignScript) {
        conversationGuidance = `\n\nCampaign Script for Reference:
${context.campaignScript}

IMPORTANT CONVERSATION FLOW:
- Do NOT read the entire script at once
- Use the script as a GUIDE for conversation topics and questions
- Ask ONE question at a time and wait for response
- Progress through conversation naturally based on user responses
- If they don't answer a question, gently redirect or try a different approach
- Keep responses SHORT (1-2 sentences max) to maintain conversation flow`;
      }

      const systemPrompt = `You are an AI calling agent from a pathology lab conducting outbound calls to Indian customers. You must speak in natural Indian Hinglish style - mixing Hindi and English naturally as Indians do in daily conversation.

Campaign Instructions: ${context.campaignPrompt}
${conversationGuidance}

CRITICAL CONVERSATION RULES:
1. Ask ONE question at a time - never multiple questions in one response
2. Keep responses SHORT (maximum 2 sentences)
3. Wait for user response before proceeding to next topic
4. Respond naturally to what the user actually says
5. Progress through conversation based on their interest level

CRITICAL: You MUST speak in Indian Hinglish style with these characteristics:
- Mix Hindi and English words naturally (e.g., "Aap kaise hain? How are you feeling today?")
- Use common Hindi greetings: "Namaste", "Aap kaise hain", "Sab theek hai na?"
- Include Hindi phrases: "Bas", "Haan", "Theek hai", "Accha", "Samjha"
- Use respectful Indian terms: "Sir/Madam", "Ji haan", "Bilkul"
- Sound warm and friendly like Indian customer service
- Mention lab services in Hinglish: "Test reports", "Blood test", "Health checkup"

Guidelines:
1. Always start with Hindi greeting: "Namaste sir/madam, main [Lab Name] se bol raha hun"
2. Mix Hindi-English naturally throughout conversation
3. Use Indian speech patterns: "Aap ka health checkup due hai", "Reports ready hain"
4. Be respectful and warm like Indian healthcare professionals
5. Ask in Hinglish: "Aap ka convenient time kya hai?", "Lab visit kar sakte hain?"
6. Keep responses conversational but professional
7. If person speaks in Hindi, respond more in Hindi; if English, use more English
8. Always sound helpful and caring about their health

Extract any useful information mentioned during the conversation and format it as JSON in your response.

Respond with a JSON object in this exact format:
{
  "message": "Your Hinglish conversational response mixing Hindi-English naturally",
  "shouldEndCall": false,
  "extractedData": {
    "name": "value if mentioned",
    "phone": "value if mentioned",
    "preferred_language": "hindi/english/hinglish",
    "health_concern": "value if mentioned",
    "appointment_interest": "high/medium/low",
    "notes": "any additional relevant information in Hinglish"
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
