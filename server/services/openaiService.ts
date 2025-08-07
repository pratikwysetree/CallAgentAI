import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIService {
  // Generate conversation response based on user input and campaign context
  static async generateResponse(
    userMessage: string,
    campaignScript: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
  ): Promise<string> {
    try {
      const systemPrompt = `You are Priya, an AI calling agent for LabsCheck, India's diagnostic aggregator platform.

Campaign Context: ${campaignScript}

CONVERSATION OBJECTIVES:
1. Verify you're speaking with lab owner/manager 
2. If not owner, politely collect their contact details for follow-up
3. Explain LabsCheck's value proposition: help labs get more business through our platform
4. Collect WhatsApp number and email ID for further communication
5. Position LabsCheck as a healthcare navigator that connects labs with customers

RESPONSE GUIDELINES:
- Keep responses natural and conversational (1-2 sentences max)
- Sound human-like, not robotic
- Handle interruptions gracefully
- If customer asks questions, answer briefly and redirect to main objective
- Be polite and professional but friendly
- Focus on business benefits for the lab partner

Remember: You need their WhatsApp number and email ID to proceed with partnership details.`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage }
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Latest OpenAI model  
        messages,
        temperature: 0.7, // Higher temperature for more natural conversation
        max_tokens: 100, // Keep responses very concise for voice calls
        top_p: 0.9,
        frequency_penalty: 0.1, // Reduce repetition
        presence_penalty: 0.1   // Encourage topic variation
      });

      return completion.choices[0]?.message?.content || "I understand. Let me continue with our conversation.";
    } catch (error) {
      console.error('OpenAI API error:', error);
      return "I apologize, there seems to be a technical issue. Could you please repeat that?";
    }
  }

  // Transcribe audio using Whisper
  static async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    try {
      // Create a temporary file for the audio
      const fs = await import('fs');
      const path = await import('path');
      const tempFilePath = path.join(process.cwd(), 'temp', `audio_${Date.now()}.wav`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempFilePath);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      fs.writeFileSync(tempFilePath, audioBuffer);
      
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempFilePath),
        model: "whisper-1",
        language: "en", // Can be adjusted for Hindi/Hinglish if needed
      });

      // Clean up temp file
      fs.unlinkSync(tempFilePath);
      
      return transcription.text;
    } catch (error) {
      console.error('Whisper transcription error:', error);
      return "Sorry, I couldn't understand that. Could you please repeat?";
    }
  }
}