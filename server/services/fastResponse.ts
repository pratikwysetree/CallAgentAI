/**
 * Ultra-Fast Response Service
 * Bypasses complex AI processing for <500ms responses
 */

export class FastResponseService {
  private responsePatterns: { [key: string]: string } = {
    // Natural English responses matching the greeting tone
    'lab': 'Do you have a pathology lab?',
    'business': 'Are you interested in our lab partnership program?',
    'pathology': 'What tests does your lab offer?',
    'test': 'What kind of tests do you perform?',
    'number': 'Could you share your WhatsApp number?',
    'email': 'What is your email address?',
    'interest': 'Would you like to know more about our partnership?',
    
    // Default responses based on input patterns
    'default_question': 'Do you run a pathology lab?',
    'default_positive': 'Great! Could you share your WhatsApp number?',
    'default_negative': 'No problem. Thank you for your time!',
    'default_confused': 'This is about LabsCheck lab partnership opportunities.',
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
    <Say voice="alice" language="en-US" rate="medium">${response}</Say>
    <Pause length="0.3"/>
    <Record action="/api/twilio/record" maxLength="8" timeout="2" playBeep="false" />
</Response>`;
  }
}

export const fastResponseService = new FastResponseService();