import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DirectAudioToggleProps {
  onToggle?: (enabled: boolean) => void;
}

export function DirectAudioToggle({ onToggle }: DirectAudioToggleProps) {
  const [isDirectAudio, setIsDirectAudio] = useState(false);

  const handleToggle = (checked: boolean) => {
    setIsDirectAudio(checked);
    onToggle?.(checked);
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              ⚡ Direct Audio Mode
              {isDirectAudio && (
                <Badge variant="default" className="bg-green-600">
                  ACTIVE
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Ultra-fast voice processing with OpenAI
            </CardDescription>
          </div>
          <Switch
            checked={isDirectAudio}
            onCheckedChange={handleToggle}
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            {isDirectAudio ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span><strong>Voice → OpenAI Whisper</strong> (300ms)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>GPT-4o Response</strong> (400ms)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span><strong>OpenAI TTS Audio</strong> (500ms)</span>
                </div>
                <div className="pt-2 border-t">
                  <span className="font-semibold text-green-600">Total: ~1.2 seconds</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                  <span><strong>Twilio Speech Recognition</strong> (800ms)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span><strong>GPT-4o Response</strong> (400ms)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-orange-500 rounded-full"></span>
                  <span><strong>ElevenLabs Voice</strong> (1200ms)</span>
                </div>
                <div className="pt-2 border-t">
                  <span className="font-semibold text-orange-600">Total: ~2.4 seconds</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="pt-2 border-t text-xs text-muted-foreground">
            <strong>Benefits:</strong> {isDirectAudio ? 
              "50% faster response • Better Hindi/English accuracy • Lower latency" :
              "Higher voice quality • More reliable • Current production mode"
            }
          </div>
        </div>
      </CardContent>
    </Card>
  );
}