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
      const systemPrompt = `You are an AI calling agent for LabsCheck, India's diagnostic aggregator platform. 
      
Campaign Script: ${campaignScript}

Follow this conversation flow:
1. Verify you're speaking with lab owner/manager
2. If not owner, collect contact details for follow-up
3. Explain LabsCheck's mission: trusted diagnostics at affordable prices through NABL accredited lab partnerships
4. Offer trusted partner listing with login portal access
5. Request WhatsApp/email for official information sharing

Keep responses natural, brief (1-2 sentences), and professional. Handle interruptions gracefully.`;

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        ...conversationHistory,
        { role: "user", content: userMessage }
      ];

      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // Latest OpenAI model
        messages,
        temperature: 0.3, // Lower temperature for consistent responses
        max_tokens: 150, // Keep responses concise for voice calls
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