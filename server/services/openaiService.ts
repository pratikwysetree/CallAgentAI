import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIService {
  // Generate conversation response based on user input and campaign context
  static async generateResponse(
    userMessage: string,
    campaignScript: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [],
    hasContactInfo: { whatsapp?: string; email?: string } = {},
    model: string = "gpt-4o"
  ): Promise<{ response: string; requestingContactInfo: boolean }> {
    try {
      const systemPrompt = `You are Priya, an AI calling agent for LabsCheck, India's diagnostic aggregator platform.

Campaign Context: ${campaignScript}

CONVERSATION OBJECTIVES:
1. Verify you're speaking with lab owner/manager 
2. If not owner, politely collect their contact details for follow-up
3. Explain LabsCheck's value proposition: help labs get more business through our platform
4. CRITICAL: Collect WhatsApp number and email ID for further communication
5. Position LabsCheck as a healthcare navigator that connects labs with customers

CONTACT INFO STATUS:
- WhatsApp Number: ${hasContactInfo.whatsapp ? 'COLLECTED ✓' : 'NEEDED'}
- Email Address: ${hasContactInfo.email ? 'COLLECTED ✓' : 'NEEDED'}

RESPONSE GUIDELINES:
- Keep responses natural and conversational (1-2 sentences max)
- Sound human-like, not robotic
- Handle interruptions gracefully
- If customer asks questions, answer briefly and redirect to main objective
- Be polite and professional but friendly
- Focus on business benefits for the lab partner
- WAIT for customer to provide both WhatsApp number AND email before ending call
- If they agree to share info but don't provide it immediately, ASK AGAIN specifically

CRITICAL: You MUST collect both WhatsApp number and email ID before ending the call. Don't end until both are provided.`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage }
      ];

      const completion = await openai.chat.completions.create({
        model: model, // Use campaign's OpenAI model
        messages,
        temperature: 0.7,
        max_tokens: 50, // Reduced for faster response and shorter replies
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1,
        stream: false // Ensure no streaming for fastest response
      });

      const response = completion.choices[0]?.message?.content || "I understand. Let me continue with our conversation.";
      
      // Check if we're requesting contact information
      const requestingContactInfo = !hasContactInfo.whatsapp || !hasContactInfo.email;
      
      return { response, requestingContactInfo };
    } catch (error) {
      console.error('OpenAI API error:', error);
      return { response: "I apologize, there seems to be a technical issue. Could you please repeat that?", requestingContactInfo: true };
    }
  }

  // Transcribe audio using Whisper - optimized for speed
  static async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Create a temporary file for the audio
      const tempDir = path.default.join(process.cwd(), 'temp');
      if (!fs.default.existsSync(tempDir)) {
        fs.default.mkdirSync(tempDir, { recursive: true });
      }
      
      const tempFilePath = path.default.join(tempDir, `audio_${Date.now()}.wav`);
      fs.default.writeFileSync(tempFilePath, audioBuffer);
      
      // Use OpenAI Whisper for transcription
      const response = await openai.audio.transcriptions.create({
        file: fs.default.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en", // Can be made configurable based on campaign
      });
      
      // Clean up temporary file
      fs.default.unlinkSync(tempFilePath);
      
      return response.text || "";
    } catch (error) {
      console.error('OpenAI Whisper transcription error:', error);
      return "Sorry, I couldn't understand that. Could you please repeat?";
    }
  }
}