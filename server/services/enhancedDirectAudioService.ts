import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import { storage } from '../storage';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class EnhancedDirectAudioService {
  
  // Process recorded audio with OpenAI Whisper + language-matched TTS
  async processRecordedAudio(audioBuffer: Buffer, callSid: string, campaignId: string): Promise<string> {
    const startTime = Date.now();
    console.log(`🎙️ [ENHANCED-AUDIO] Processing ${audioBuffer.length} bytes of recorded audio`);
    
    try {
      // 1. Save audio file for Whisper processing
      const tempAudioPath = path.join(process.cwd(), 'temp', `enhanced_${callSid}_${Date.now()}.mp3`);
      fs.writeFileSync(tempAudioPath, audioBuffer);
      
      // 2. Transcribe with OpenAI Whisper (auto-detect language)
      const transcriptionStart = Date.now();
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(tempAudioPath),
        model: "whisper-1",
        // Auto-detect language for Hindi/English/Hinglish
        prompt: "LabsCheck partnership, laboratory, pathology, WhatsApp, email, main theek hun, I am great, kya hai, namaste", 
      });
      
      const transcriptionTime = Date.now() - transcriptionStart;
      console.log(`🧠 [WHISPER] ${transcriptionTime}ms: "${transcription.text}"`);
      console.log(`📤 [SENT-TO-OPENAI] Raw audio → Whisper transcription: "${transcription.text}"`);
      
      // 3. Get AI response with language matching
      const aiStart = Date.now();
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are calling pathology labs for LabsCheck partnership. 

BUSINESS: LabsCheck is a neutral platform connecting 500+ labs to 100k+ users. Zero commission - labs keep 100% payments.

GOAL: Get lab owner/manager contact details (WhatsApp, email) for partnership.

LANGUAGE MATCHING: 
- If customer speaks Hindi/Hinglish, respond in Hindi/Hinglish
- If customer speaks English, respond in English  
- Match their tone and language style exactly

STYLE: Warm, brief, natural conversation. Max 15 words. Say key benefit upfront.

RESPONSE FORMAT: Return your response as a json object with this structure: {"message": "your response in same language as customer", "voice_language": "detected language (hindi/english/hinglish)", "collected_data": {"contact_person": "name", "whatsapp_number": "number", "email": "email", "lab_name": "name"}, "should_end": false}`
          },
          {
            role: "user", 
            content: transcription.text
          }
        ],
        max_tokens: 120,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const aiTime = Date.now() - aiStart;
      let aiData;
      try {
        aiData = JSON.parse(aiResponse.choices[0].message.content || '{}');
      } catch (parseError) {
        console.error('❌ [AI JSON PARSE ERROR]:', parseError);
        console.error('❌ [RAW AI RESPONSE]:', aiResponse.choices[0].message.content);
        
        // FORCE failure instead of fallback - this will trigger error handling
        throw new Error(`OpenAI JSON parsing failed: ${parseError.message}. Raw: ${aiResponse.choices[0].message.content}`);
      }
      
      console.log(`🧠 [AI] ${aiTime}ms: "${aiData.message}" (Language: ${aiData.voice_language || 'english'})`);
      console.log(`📤 [SENT-TO-OPENAI] Customer said: "${transcription.text}" → AI responded: "${aiData.message}"`);
      
      // 4. Generate voice response with OpenAI TTS (matching customer's language/accent)
      const ttsStart = Date.now();
      let audioUrl = null;
      
      // Detect if response should be in Hindi/Hinglish or English
      const voiceLanguage = aiData.voice_language || 'english';
      const isHindiResponse = voiceLanguage.includes('hindi') || voiceLanguage.includes('hinglish');
      
      try {
        console.log(`🎤 [TTS] Generating ${voiceLanguage} voice for: "${aiData.message}"`);
        
        // Generate speech with OpenAI TTS
        const speechResponse = await openai.audio.speech.create({
          model: "tts-1", // Fast model
          voice: isHindiResponse ? "nova" : "alloy", // Nova for Hindi/Hinglish, Alloy for English
          input: aiData.message,
          speed: 1.0,
        });
        
        // Save audio file
        const audioArrayBuffer = await speechResponse.arrayBuffer();
        const audioBuffer = Buffer.from(audioArrayBuffer);
        const audioFilename = `openai_enhanced_${callSid}_${Date.now()}.mp3`;
        const audioPath = path.join(process.cwd(), 'temp', audioFilename);
        fs.writeFileSync(audioPath, audioBuffer);
        
        // Create URL for Twilio to play
        const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
        audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
        
        const ttsTime = Date.now() - ttsStart;
        console.log(`🎤 [TTS] ${ttsTime}ms - Generated ${voiceLanguage} audio: ${audioUrl}`);
        
        // Cleanup audio file after 60 seconds
        setTimeout(() => {
          try {
            fs.unlinkSync(audioPath);
            console.log(`🗑️ [CLEANUP] Removed audio file: ${audioFilename}`);
          } catch (e) {
            console.log('Audio cleanup:', (e as Error).message);
          }
        }, 60000);
        
      } catch (ttsError) {
        console.error('❌ [TTS] Error generating voice:', ttsError);
        // Fallback to Twilio Say
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`⚡ [TOTAL] ${totalTime}ms (Whisper: ${transcriptionTime}ms, AI: ${aiTime}ms, TTS: ${Date.now() - ttsStart}ms)`);
      
      // Create TwiML response (NO "Please speak" prompts)
      let twiml;
      if (audioUrl) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" rate="normal">${aiData.message}</Say>
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
      }

      // Store conversation data if collected
      if (aiData.collected_data && Object.keys(aiData.collected_data).length > 0) {
        await this.updateContactData(callSid, aiData.collected_data);
      }
      
      // Check if call should end
      if (aiData.should_end) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="alice" rate="normal">${aiData.message}</Say>`}
  <Hangup/>
</Response>`;
      }
      
      // Cleanup temp file
      setTimeout(() => {
        try {
          fs.unlinkSync(tempAudioPath);
        } catch (e) {
          console.log('Temp file cleanup:', (e as Error).message);
        }
      }, 10000);
      
      return twiml;
      
    } catch (error) {
      console.error('❌ [ENHANCED-AUDIO] Error:', error);
      
      // Fallback TwiML
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, there was a technical issue. Thank you for your time.</Say>
  <Hangup/>
</Response>`;
    }
  }
  
  // Process direct speech text (from Twilio Gather) with language detection
  async processDirectSpeech(speechText: string, callSid: string, campaignId: string): Promise<string> {
    const startTime = Date.now();
    console.log(`🎤 [DIRECT-SPEECH] Processing: "${speechText}"`);
    
    try {
      // Get AI response with enhanced language detection
      const aiStart = Date.now();
      const aiResponse = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are calling pathology labs for LabsCheck partnership. 

BUSINESS: LabsCheck is a neutral platform connecting 500+ labs to 100k+ users. Zero commission - labs keep 100% payments.

GOAL: Get lab owner/manager contact details (WhatsApp, email) for partnership.

CRITICAL LANGUAGE DETECTION:
- Analyze the input language carefully
- If input contains Hindi words (hai, abhi, kya, acha, etc.) OR mixed Hindi-English, respond in Hindi/Hinglish
- If input is purely English, respond in English
- Match the customer's exact language style and tone

EXAMPLES:
- Input: "Hai abhi i m doing great" → Respond: "Acha! Aap lab owner hain?" (Hindi/Hinglish)
- Input: "Hello I am fine" → Respond: "Great! Are you a lab owner?" (English)
- Input: "Main theek hun" → Respond: "Bahut acha! Aap laboratory chalate hain?" (Hindi)

STYLE: Warm, brief, natural conversation. Max 15 words. Say key benefit upfront.

RESPONSE FORMAT: Return your response as a json object with this structure: {"message": "your response matching customer's language exactly", "voice_language": "hindi/english/hinglish based on input", "collected_data": {"contact_person": "name", "whatsapp_number": "number", "email": "email", "lab_name": "name"}, "should_end": false}`
          },
          {
            role: "user", 
            content: speechText
          }
        ],
        max_tokens: 120,
        temperature: 0.1,
        response_format: { type: "json_object" }
      });
      
      const aiTime = Date.now() - aiStart;
      let aiData;
      try {
        aiData = JSON.parse(aiResponse.choices[0].message.content || '{}');
      } catch (parseError) {
        console.error('❌ [AI JSON PARSE ERROR]:', parseError);
        console.error('❌ [RAW AI RESPONSE]:', aiResponse.choices[0].message.content);
        
        // FORCE failure instead of fallback - this will trigger proper error handling
        throw new Error(`OpenAI JSON parsing failed: ${parseError.message}. Raw: ${aiResponse.choices[0].message.content}`);
      }
      
      console.log(`🧠 [AI-DIRECT] ${aiTime}ms: "${aiData.message}" (Language: ${aiData.voice_language})`);
      console.log(`📤 [LANGUAGE-MATCH] Input: "${speechText}" → Response: "${aiData.message}" (${aiData.voice_language})`);
      
      // Generate voice response with matching language
      const ttsStart = Date.now();
      let audioUrl = null;
      
      const voiceLanguage = aiData.voice_language || 'english';
      const isHindiResponse = voiceLanguage.includes('hindi') || voiceLanguage.includes('hinglish');
      
      try {
        console.log(`🎤 [TTS-DIRECT] Generating ${voiceLanguage} voice for: "${aiData.message}"`);
        
        const speechResponse = await openai.audio.speech.create({
          model: "tts-1",
          voice: isHindiResponse ? "nova" : "alloy",
          input: aiData.message,
          speed: 1.0,
        });
        
        const audioArrayBuffer = await speechResponse.arrayBuffer();
        const audioBuffer = Buffer.from(audioArrayBuffer);
        const audioFilename = `direct_speech_${callSid}_${Date.now()}.mp3`;
        const audioPath = path.join(process.cwd(), 'temp', audioFilename);
        fs.writeFileSync(audioPath, audioBuffer);
        
        const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost:5000';
        const protocol = baseUrl.includes('localhost') ? 'http' : 'https';
        audioUrl = `${protocol}://${baseUrl}/api/audio/${audioFilename}`;
        
        const ttsTime = Date.now() - ttsStart;
        console.log(`🎤 [TTS-DIRECT] ${ttsTime}ms - Generated ${voiceLanguage} audio: ${audioUrl}`);
        
        setTimeout(() => {
          try {
            fs.unlinkSync(audioPath);
            console.log(`🗑️ [CLEANUP] Removed audio file: ${audioFilename}`);
          } catch (e) {
            console.log('Audio cleanup:', (e as Error).message);
          }
        }, 60000);
        
      } catch (ttsError) {
        console.error('❌ [TTS-DIRECT] Error generating voice:', ttsError);
      }
      
      const totalTime = Date.now() - startTime;
      console.log(`⚡ [TOTAL-DIRECT] ${totalTime}ms (AI: ${aiTime}ms, TTS: ${Date.now() - ttsStart}ms)`);
      
      // Create TwiML response WITHOUT "Please speak" prompts
      let twiml;
      if (audioUrl) {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>${audioUrl}</Play>
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
      } else {
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" rate="normal">${aiData.message}</Say>
  <Record action="/api/twilio/recording/${callSid}" maxLength="10" playBeep="false" timeout="8" />
</Response>`;
      }

      // Store conversation data if collected
      if (aiData.collected_data && Object.keys(aiData.collected_data).length > 0) {
        await this.updateContactData(callSid, aiData.collected_data);
      }
      
      // Check if call should end
      if (aiData.should_end) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  ${audioUrl ? `<Play>${audioUrl}</Play>` : `<Say voice="alice" rate="normal">${aiData.message}</Say>`}
  <Hangup/>
</Response>`;
      }
      
      return twiml;
      
    } catch (error) {
      console.error('❌ [DIRECT-SPEECH] Error:', error);
      
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Sorry, technical issue. Thank you for your time.</Say>
  <Hangup/>
</Response>`;
    }
  }

  // Store contact data from conversation
  private async updateContactData(callSid: string, collectedData: any) {
    try {
      console.log(`💾 [CONTACT-DATA] Updating for call ${callSid}:`, collectedData);
      // Implementation for storing contact data
      // This would update the contact record with collected information
    } catch (error) {
      console.error('❌ [CONTACT-DATA] Error updating:', error);
    }
  }
}

export const enhancedDirectAudioService = new EnhancedDirectAudioService();