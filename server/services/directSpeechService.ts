// Direct Speech Processing Service
// This service handles speech input directly from Twilio webhooks
// without any recording download or external transcription

export class DirectSpeechService {
  
  // Process speech input directly from Twilio gather webhook
  static processTwilioSpeechInput(
    speechResult: string | undefined,
    unstableSpeechResult: string | undefined,
    digits: string | undefined
  ): string {
    
    // Priority order: SpeechResult -> UnstableSpeechResult -> Digits -> Default
    if (speechResult && speechResult.trim()) {
      console.log(`🎤 Using SpeechResult: "${speechResult}"`);
      return speechResult.trim();
    }
    
    if (unstableSpeechResult && unstableSpeechResult.trim()) {
      console.log(`🎤 Using UnstableSpeechResult: "${unstableSpeechResult}"`);
      return unstableSpeechResult.trim();
    }
    
    if (digits && digits.trim()) {
      console.log(`📞 Using DTMF input: "${digits}"`);
      return `User pressed ${digits}`;
    }
    
    console.log('🎤 No clear speech detected');
    return "I didn't catch that clearly";
  }
  
  // Validate and clean speech input
  static validateSpeechInput(speechText: string): string {
    if (!speechText || speechText.trim().length === 0) {
      return "I didn't hear anything";
    }
    
    // Clean up common speech recognition artifacts
    let cleaned = speechText.trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single space
      .replace(/[^\w\s.,!?-]/g, '') // Remove special characters except punctuation
      .toLowerCase();
    
    // Handle common misheard phrases for Indian context
    const corrections = {
      'lab check': 'LabsCheck',
      'labs check': 'LabsCheck',
      'lab owner': 'lab owner',
      'laboratory': 'lab'
    };
    
    for (const [incorrect, correct] of Object.entries(corrections)) {
      cleaned = cleaned.replace(new RegExp(incorrect, 'gi'), correct);
    }
    
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  
  // Check if speech indicates call should end
  static shouldEndCall(speechText: string): boolean {
    const endPhrases = [
      'not interested',
      'hang up',
      'end call',
      'goodbye',
      'bye',
      'no thank you',
      'stop calling',
      'remove my number',
      'not now',
      'busy'
    ];
    
    const lowerText = speechText.toLowerCase();
    return endPhrases.some(phrase => lowerText.includes(phrase));
  }
  
  // Extract useful information from speech
  static extractContactInfo(speechText: string): {
    whatsapp?: string;
    email?: string;
    name?: string;
  } {
    const info: any = {};
    
    // Extract WhatsApp number (Indian format)
    const whatsappMatch = speechText.match(/(?:\+91|91)?\s*[6-9]\d{9}/);
    if (whatsappMatch) {
      info.whatsapp = whatsappMatch[0].replace(/\s+/g, '');
    }
    
    // Extract email
    const emailMatch = speechText.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      info.email = emailMatch[0];
    }
    
    // Extract name (basic pattern)
    const namePatterns = [
      /my name is ([a-zA-Z\s]+)/i,
      /i am ([a-zA-Z\s]+)/i,
      /this is ([a-zA-Z\s]+)/i
    ];
    
    for (const pattern of namePatterns) {
      const match = speechText.match(pattern);
      if (match && match[1]) {
        info.name = match[1].trim();
        break;
      }
    }
    
    return info;
  }
}

export const directSpeechService = DirectSpeechService;