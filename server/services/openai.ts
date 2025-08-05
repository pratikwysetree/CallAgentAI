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
      const systemPrompt = `You are an AI calling agent conducting outbound calls. Your role is to have natural, human-like conversations while collecting specific information based on the campaign objectives.

Campaign Instructions: ${context.campaignPrompt}

Guidelines:
1. Keep responses conversational and natural
2. Don't sound robotic or scripted
3. Listen actively and respond appropriately to what the person says
4. Collect the required information naturally throughout the conversation
5. Be polite and respectful
6. If the person asks to be removed from calls, respect that immediately
7. Keep responses concise (1-2 sentences max)
8. Use natural speech patterns and occasional filler words for authenticity

Extract any useful information mentioned during the conversation and format it as JSON in your response.

Respond with a JSON object in this exact format:
{
  "message": "Your conversational response to the user",
  "shouldEndCall": false,
  "extractedData": {
    "name": "value if mentioned",
    "email": "value if mentioned", 
    "company": "value if mentioned",
    "interest_level": "high/medium/low based on responses",
    "notes": "any additional relevant information"
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
    } catch (error) {
      console.error('Error generating AI response:', error);
      const responseTime = Date.now() - startTime;
      
      return {
        message: "I'm having some technical difficulties. Let me transfer you to a human representative.",
        shouldEndCall: true,
        extractedData: {},
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
    } catch (error) {
      console.error('Error generating conversation summary:', error);
      return "Error generating summary";
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
    } catch (error) {
      console.error('Error calculating success score:', error);
      return 50; // Default moderate score
    }
  }
}

export const openaiService = new OpenAIService();
