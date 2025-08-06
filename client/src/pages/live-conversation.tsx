import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useWebSocket } from '@/hooks/use-websocket';
import { format } from 'date-fns';

interface ConversationEvent {
  id: string;
  timestamp: string;
  callSid: string;
  type: 'customer_speech' | 'openai_request' | 'openai_response' | 'voice_synthesis' | 'error';
  content: string;
  metadata?: {
    duration?: number;
    confidence?: number;
    model?: string;
    voiceId?: string;
    processingTime?: number;
  };
}

export default function LiveConversation() {
  const [conversations, setConversations] = useState<ConversationEvent[]>([]);
  const [activeCallSid, setActiveCallSid] = useState<string | null>(null);
  const { lastMessage, isConnected } = useWebSocket();

  useEffect(() => {
    if (lastMessage) {
      try {
        // Validate message structure
        if (!lastMessage) return;
        
        const messageContent = typeof lastMessage === 'string' ? lastMessage : lastMessage.data;
        if (!messageContent || typeof messageContent !== 'string') return;
        
        const data = JSON.parse(messageContent);
        
        // Validate parsed data structure
        if (!data || typeof data !== 'object' || !data.type) return;
        
        // Handle live conversation events
        if (data.type === 'live_conversation') {
          const event: ConversationEvent = {
            id: `${data.callSid}-${Date.now()}`,
            timestamp: new Date().toISOString(),
            callSid: data.callSid,
            type: data.eventType,
            content: data.content,
            metadata: data.metadata || {}
          };
          
          setConversations(prev => [event, ...prev].slice(0, 100)); // Keep latest 100 events
          setActiveCallSid(data.callSid);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    }
  }, [lastMessage]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'customer_speech': return '🎤';
      case 'openai_request': return '📤';
      case 'openai_response': return '🤖';
      case 'voice_synthesis': return '🎵';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'customer_speech': return 'bg-blue-500';
      case 'openai_request': return 'bg-yellow-500';
      case 'openai_response': return 'bg-green-500';
      case 'voice_synthesis': return 'bg-purple-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm:ss.SSS');
  };

  const renderContent = (event: ConversationEvent) => {
    if (event.type === 'openai_request' || event.type === 'openai_response') {
      try {
        const parsed = JSON.parse(event.content);
        return (
          <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        );
      } catch {
        return <p className="text-sm">{event.content}</p>;
      }
    }
    return <p className="text-sm">{event.content}</p>;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Live Conversation Monitor</h1>
        <div className="flex items-center space-x-4">
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          {activeCallSid && (
            <Badge variant="secondary">
              Active Call: {activeCallSid.slice(-8)}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Conversation Feed */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <span>Real-time Conversation Flow</span>
              <Badge variant="outline">{conversations.length} events</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px] w-full">
              {conversations.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>No conversation events yet.</p>
                  <p className="text-sm">Start a call to see live conversation data.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map((event) => (
                    <div key={event.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-lg">{getEventIcon(event.type)}</span>
                          <Badge className={getEventColor(event.type)} variant="secondary">
                            {event.type.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            Call: {event.callSid.slice(-8)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">
                            {formatTimestamp(event.timestamp)}
                          </div>
                          {event.metadata?.processingTime && (
                            <div className="text-xs text-green-600">
                              {event.metadata.processingTime}ms
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        {renderContent(event)}
                      </div>

                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="border-t pt-2 mt-2">
                          <div className="flex flex-wrap gap-2">
                            {event.metadata.confidence && (
                              <Badge variant="outline" className="text-xs">
                                Confidence: {Math.round(event.metadata.confidence * 100)}%
                              </Badge>
                            )}
                            {event.metadata.model && (
                              <Badge variant="outline" className="text-xs">
                                Model: {event.metadata.model}
                              </Badge>
                            )}
                            {event.metadata.voiceId && (
                              <Badge variant="outline" className="text-xs">
                                Voice: {event.metadata.voiceId.slice(0, 8)}...
                              </Badge>
                            )}
                            {event.metadata.duration && (
                              <Badge variant="outline" className="text-xs">
                                Duration: {event.metadata.duration}ms
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Processing Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Customer Speech Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations.filter(e => e.type === 'customer_speech').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">OpenAI Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations.filter(e => e.type === 'openai_request').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">AI Responses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations.filter(e => e.type === 'openai_response').length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Voice Synthesis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {conversations.filter(e => e.type === 'voice_synthesis').length}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}