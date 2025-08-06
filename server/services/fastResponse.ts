/**
 * Ultra-Fast Response Service
 * Bypasses complex AI processing for <500ms responses
 */

export class FastResponseService {
  private responsePatterns: { [key: string]: string } = {
    // Common Hindi responses
    'lab': 'Aapka lab hai kya?',
    'business': 'LabsCheck partnership interest hai?',
    'pathology': 'Pathology lab details chahiye?',
    'test': 'Kya test karte hain aap?',
    'number': 'WhatsApp number share kar sakte hain?',
    'email': 'Email ID de sakte hain?',
    'interest': 'Partnership mein interest hai?',
    
    // Default responses based on input patterns
    'default_question': 'Aapka lab hai kya?',
    'default_positive': 'WhatsApp number?',
    'default_negative': 'Koi baat nahi. Dhanyawad!',
    'default_confused': 'LabsCheck se partnership ka call hai.',
  };

  detectIntent(input: string): string {
    const lowerInput = input.toLowerCase();
    
    // Quick pattern matching for ultra-fast response
    if (lowerInput.includes('lab') || lowerInput.includes('pathology')) {
      return 'lab';
    }
    if (lowerInput.includes('number') || lowerInput.includes('whatsapp')) {
      return 'number';
    }
    if (lowerInput.includes('email') || lowerInput.includes('gmail')) {
      return 'email';
    }
    if (lowerInput.includes('yes') || lowerInput.includes('haan') || lowerInput.includes('accha')) {
      return 'default_positive';
    }
    if (lowerInput.includes('no') || lowerInput.includes('nahi') || lowerInput.includes('busy')) {
      return 'default_negative';
    }
    
    return 'default_question';
  }

  getFastResponse(input: string): string {
    const intent = this.detectIntent(input);
    return this.responsePatterns[intent] || this.responsePatterns['default_question'];
  }

  generateTwiML(response: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Say voice="alice" language="en-IN" rate="fast">${response}</Say>
    <Pause length="0.1"/>
    <Record action="/api/twilio/record" maxLength="5" timeout="1" playBeep="false" />
</Response>`;
  }
}

export const fastResponseService = new FastResponseService();