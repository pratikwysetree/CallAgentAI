# Ultra-Fast Speech-to-Text Flow Test

## Complete Conversation Pipeline (Target: <2 seconds)

### STEP 1: Customer Speaks → Audio Recording (0.1s)
- Twilio records customer speech
- Audio buffer sent to webhook
- Duration logged for performance tracking

### STEP 2: Whisper Speech-to-Text (0.8s target)
- Download audio with Twilio authentication
- OpenAI Whisper transcription with optimized settings:
  - Model: whisper-1
  - Language: Hindi (hi) with auto-detection
  - Response format: json (faster than verbose_json)
  - Temperature: 0 for deterministic results
  - Ultra-short prompt for speed

### STEP 3: AI Model Processing (0.6s target)
- Send transcribed text to GPT-4o
- Optimized settings:
  - max_tokens: 120 (reduced for speed)
  - temperature: 0.1 (consistent, fast responses)
  - response_format: json_object
- Return structured response with message and extracted data

### STEP 4: Text-to-Speech Generation (0.4s target)
- ElevenLabs voice synthesis
- Voice: 7w5JDCUNbeKrn4ySFgfu (Aavika)
- Model: eleven_multilingual_v2
- Optimized stability settings for speed

### STEP 5: Audio Playback to Customer (0.1s)
- TwiML <Play> tag with audio URL
- Customer hears AI response
- New recording cycle begins

## Performance Monitoring
- Each step logs execution time
- Total pipeline time tracked end-to-end
- Warning if >2000ms total
- Success confirmation if <2000ms

## Fallback Mechanisms
- Whisper fails → "Samjha nahi. Dobara boliye."
- AI model fails → Contextual conversation system
- Audio generation fails → Twilio voice synthesis
- Any error → Graceful conversation continuation

## Test Commands
```bash
# Test Whisper service
curl -X POST "http://localhost:5000/api/test/whisper" -H "Content-Type: application/json" -d '{"text":"testing whisper"}'

# Test AI model
curl -X POST "http://localhost:5000/api/test/openai?message=haan%20lab%20chalata%20hun"

# Initiate test call
curl -X POST "http://localhost:5000/api/campaigns/de33ddfd-f4b0-446f-9f32-012594cf937b/call" -H "Content-Type: application/json" -d '{"contactId":"test"}'
```

## Expected Conversation Flow
1. AI: "Hi this is Aavika from LabsCheck, how are you doing today"
2. Customer: [Speaks in Hindi/English/Mixed] → Recorded
3. Whisper: Transcribes accurately in <800ms
4. AI: Responds contextually in same language in <600ms
5. ElevenLabs: Generates speech in <400ms
6. Customer: Hears response and conversation continues

Total target: <2000ms per conversation turn