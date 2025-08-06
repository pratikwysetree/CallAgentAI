import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useWebSocket } from '@/hooks/use-websocket';

interface TranscriptMessage {
  id: string;
  callSid: string;
  speaker: 'customer' | 'agent';
  text: string;
  confidence?: number;
  timestamp: string;
}

interface LiveTranscriptProps {
  callSid?: string; // If provided, only show transcript for this call
}

export function LiveTranscript({ callSid }: LiveTranscriptProps) {
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const { isConnected, lastMessage } = useWebSocket();

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'live_transcript') {
      // If callSid filter is provided, only show transcripts for that call
      if (callSid && lastMessage.callSid !== callSid) {
        return;
      }
      
      const newTranscript: TranscriptMessage = {
        id: `${lastMessage.callSid}-${Date.now()}`,
        callSid: lastMessage.callSid,
        speaker: lastMessage.speaker,
        text: lastMessage.text,
        confidence: lastMessage.confidence,
        timestamp: lastMessage.timestamp
      };
      
      setTranscripts(prev => [...prev, newTranscript].slice(-50)); // Keep last 50 messages
    }
  }, [lastMessage, callSid]);

  // Clear transcripts when callSid changes
  useEffect(() => {
    setTranscripts([]);
  }, [callSid]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          🎤 Live Transcript
          {isConnected ? (
            <Badge variant="outline" className="text-green-600 border-green-600">
              ● Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-red-600 border-red-600">
              ● Disconnected
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-96 overflow-y-auto px-4 pb-4">
          {transcripts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {callSid ? 
                "Waiting for conversation to start..." : 
                "No active calls with transcripts"
              }
            </div>
          ) : (
            <div className="space-y-3">
              {transcripts.map((transcript) => (
                <div
                  key={transcript.id}
                  className={`flex flex-col gap-1 p-3 rounded-lg ${
                    transcript.speaker === 'customer' 
                      ? 'bg-blue-50 dark:bg-blue-950/20 ml-0 mr-8' 
                      : 'bg-green-50 dark:bg-green-950/20 ml-8 mr-0'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {transcript.speaker === 'customer' ? '👤 Customer' : '🤖 Agent'}
                      </span>
                      {transcript.confidence && (
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${
                            transcript.confidence > 0.7 
                              ? 'text-green-600 border-green-600' 
                              : transcript.confidence > 0.4 
                              ? 'text-yellow-600 border-yellow-600'
                              : 'text-red-600 border-red-600'
                          }`}
                        >
                          {Math.round(transcript.confidence * 100)}%
                        </Badge>
                      )}
                    </div>
                    <span>{formatTime(transcript.timestamp)}</span>
                  </div>
                  <p className="text-sm">{transcript.text}</p>
                  {!callSid && (
                    <p className="text-xs text-muted-foreground">
                      Call: {transcript.callSid.slice(-8)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}