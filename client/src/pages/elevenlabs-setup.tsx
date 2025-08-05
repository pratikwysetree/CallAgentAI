import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { Key, CheckCircle, AlertCircle, Volume2, ExternalLink } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface ElevenLabsStatus {
  configured: boolean;
  valid?: boolean;
  error?: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  labels?: {
    accent?: string;
    age?: string;
    gender?: string;
    use_case?: string;
  };
}

export default function ElevenLabsSetup() {
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check ElevenLabs status
  const { data: status, isLoading: statusLoading } = useQuery<ElevenLabsStatus>({
    queryKey: ['/api/elevenlabs/status'],
  });

  // Get available voices
  const { data: voicesData, isLoading: voicesLoading } = useQuery<{
    voices: ElevenLabsVoice[];
    recommended: ElevenLabsVoice[];
  }>({
    queryKey: ['/api/elevenlabs/voices'],
    enabled: status?.configured && status?.valid,
  });

  // Configure API key mutation
  const configureApiKey = useMutation({
    mutationFn: async (data: { apiKey: string }) => {
      return apiRequest('/api/secrets/elevenlabs', {
        method: 'POST',
        body: data,
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "ElevenLabs API key configured successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/elevenlabs/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/elevenlabs/voices'] });
      setApiKey("");
    },
    onError: (error: any) => {
      toast({
        title: "Configuration Failed",
        description: error.details || "Failed to configure API key. Please check your key and try again.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your ElevenLabs API key",
        variant: "destructive",
      });
      return;
    }
    configureApiKey.mutate({ apiKey: apiKey.trim() });
  };

  if (statusLoading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center gap-2">
          <Volume2 className="h-6 w-6" />
          <h1 className="text-2xl font-bold">ElevenLabs Voice Setup</h1>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-2">
        <Volume2 className="h-6 w-6" />
        <h1 className="text-2xl font-bold">ElevenLabs Voice Setup</h1>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Configuration Status
          </CardTitle>
          <CardDescription>
            Configure your ElevenLabs API key to enable high-quality voice synthesis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Status:</span>
            {status?.configured && status?.valid ? (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="h-3 w-3 mr-1" />
                Configured & Valid
              </Badge>
            ) : status?.configured && !status?.valid ? (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Invalid API Key
              </Badge>
            ) : (
              <Badge variant="secondary">
                <AlertCircle className="h-3 w-3 mr-1" />
                Not Configured
              </Badge>
            )}
          </div>

          {status?.error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{status.error}</AlertDescription>
            </Alert>
          )}

          {!status?.configured || !status?.valid ? (
            <div className="space-y-4">
              <Alert>
                <Key className="h-4 w-4" />
                <AlertDescription>
                  To use ElevenLabs voice synthesis, you need to provide your API key.{" "}
                  <a
                    href="https://elevenlabs.io/api"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline"
                  >
                    Get your API key here
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </AlertDescription>
              </Alert>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">ElevenLabs API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id="apiKey"
                      type={showApiKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="sk-..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? "Hide" : "Show"}
                    </Button>
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={configureApiKey.isPending}
                  className="w-full"
                >
                  {configureApiKey.isPending ? "Configuring..." : "Configure API Key"}
                </Button>
              </form>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Available Voices */}
      {status?.configured && status?.valid && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              Available Voices
            </CardTitle>
            <CardDescription>
              High-quality voices available for your campaigns
            </CardDescription>
          </CardHeader>
          <CardContent>
            {voicesLoading ? (
              <div className="text-center py-4">Loading voices...</div>
            ) : voicesData?.recommended && voicesData.recommended.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Recommended Voices</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {voicesData.recommended.map((voice) => (
                      <div
                        key={voice.voice_id}
                        className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="font-medium">{voice.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {voice.category}
                        </div>
                        {voice.labels && (
                          <div className="flex gap-1 mt-2">
                            {voice.labels.gender && (
                              <Badge variant="outline" className="text-xs">
                                {voice.labels.gender}
                              </Badge>
                            )}
                            {voice.labels.accent && (
                              <Badge variant="outline" className="text-xs">
                                {voice.labels.accent}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    ElevenLabs is now configured! You can enable it for your campaigns in the Campaign Settings.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No voices available. Please check your API key configuration.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use ElevenLabs Voice</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-start gap-2">
            <span className="font-medium text-sm bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
            <span className="text-sm">Configure your ElevenLabs API key above</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sm bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
            <span className="text-sm">Go to your campaign settings</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sm bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
            <span className="text-sm">Enable ElevenLabs TTS and select a voice</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-medium text-sm bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
            <span className="text-sm">Start making calls with natural-sounding AI voices!</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}