import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Save, Settings, MessageSquare, Volume2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface VoiceConfig {
  model?: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
  useElevenLabs?: boolean;
}

interface Campaign {
  id: string;
  name: string;
  description: string;
  aiPrompt: string;
  script: string;
  introLine: string;
  agentName: string;
  openaiModel: string;
  voiceConfig: VoiceConfig | null;
  transcriberConfig: any;
  isActive: boolean;
  createdAt: string;
}

interface ElevenLabsVoice {
  voice_id: string;
  name: string;
  category: string;
  description?: string;
}

export default function CampaignSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [formData, setFormData] = useState({
    introLine: "",
    agentName: "",
    name: "",
    description: "",
    aiPrompt: "",
    script: "",
    voiceConfig: {
      model: "eleven_turbo_v2",
      voiceId: "Z6TUNPsOxhTPtqLx81EX", // Aavika voice
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true,
      useElevenLabs: true
    }
  });

  const { data: campaigns, isLoading, error } = useQuery({
    queryKey: ['/api/campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/campaigns');
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return response.json();
    }
  });

  // Fetch ElevenLabs voices on component mount
  useEffect(() => {
    const fetchElevenLabsVoices = async () => {
      try {
        const response = await fetch('/api/elevenlabs/voices');
        if (response.ok) {
          const voices = await response.json();
          setElevenLabsVoices(voices);
        }
      } catch (error) {
        console.error('Failed to fetch ElevenLabs voices:', error);
      }
    };
    
    fetchElevenLabsVoices();
  }, []);

  const updateCampaignMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Campaign> }) => {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('Update successful:', data);
      toast({ title: "Campaign updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      // Update the selected campaign with new data
      setSelectedCampaign(data);
    },
    onError: (error: any) => {
      console.error('Update error:', error);
      toast({ title: "Failed to update campaign", variant: "destructive" });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('Failed to delete campaign');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Campaign deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      setSelectedCampaign(null);
      setFormData({
        introLine: "",
        agentName: "",
        name: "",
        description: "",
        aiPrompt: "",
        script: "",
        voiceConfig: {
          model: "eleven_turbo_v2",
          voiceId: "Z6TUNPsOxhTPtqLx81EX",
          stability: 0.5,
          similarityBoost: 0.75,
          style: 0,
          useSpeakerBoost: true,
          useElevenLabs: true
        }
      });
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      toast({ 
        title: "Failed to delete campaign", 
        description: error.message || "Unknown error occurred",
        variant: "destructive" 
      });
    }
  });

  useEffect(() => {
    if (selectedCampaign) {
      setFormData({
        introLine: selectedCampaign.introLine || "",
        agentName: selectedCampaign.agentName || "",
        name: selectedCampaign.name || "",
        description: selectedCampaign.description || "",
        aiPrompt: selectedCampaign.aiPrompt || "",
        script: selectedCampaign.script || "",
        voiceConfig: {
          model: selectedCampaign.voiceConfig?.model || "eleven_turbo_v2",
          voiceId: selectedCampaign.voiceConfig?.voiceId || "Z6TUNPsOxhTPtqLx81EX",
          stability: selectedCampaign.voiceConfig?.stability || 0.5,
          similarityBoost: selectedCampaign.voiceConfig?.similarityBoost || 0.75,
          style: selectedCampaign.voiceConfig?.style || 0,
          useSpeakerBoost: selectedCampaign.voiceConfig?.useSpeakerBoost || true,
          useElevenLabs: selectedCampaign.voiceConfig?.useElevenLabs || true
        }
      });
    }
  }, [selectedCampaign]);

  const handleSave = () => {
    if (!selectedCampaign) return;
    
    console.log('Saving campaign:', selectedCampaign.id, formData);
    updateCampaignMutation.mutate({
      id: selectedCampaign.id,
      data: formData
    });
  };

  const handleDelete = () => {
    if (!selectedCampaign) return;
    deleteCampaignMutation.mutate(selectedCampaign.id);
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Campaign Settings</h1>
        </div>
        <div>Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Campaign Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Campaign List */}
        <Card>
          <CardHeader>
            <CardTitle>Select Campaign</CardTitle>
            <CardDescription>Choose a campaign to edit its settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Array.isArray(campaigns) && campaigns.map((campaign: Campaign) => (
                <Button
                  key={campaign.id}
                  variant={selectedCampaign?.id === campaign.id ? "default" : "outline"}
                  className="w-full justify-start"
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {campaign.name}
                </Button>
              ))}
              {!Array.isArray(campaigns) && !isLoading && (
                <p className="text-sm text-muted-foreground">No campaigns found</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Campaign Settings */}
        <div className="lg:col-span-2">
          {selectedCampaign ? (
            <Card>
              <CardHeader>
                <CardTitle>Edit Campaign: {selectedCampaign.name}</CardTitle>
                <CardDescription>Configure intro line, agent name, and other settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Intro Line Configuration */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="agentName">Agent Name</Label>
                    <Input
                      id="agentName"
                      value={formData.agentName}
                      onChange={(e) => setFormData({ ...formData, agentName: e.target.value })}
                      placeholder="e.g., Anvika"
                    />
                  </div>

                  <div>
                    <Label htmlFor="introLine">Introduction Line</Label>
                    <Textarea
                      id="introLine"
                      value={formData.introLine}
                      onChange={(e) => setFormData({ ...formData, introLine: e.target.value })}
                      placeholder="Hi, this is Anvika from LabsCheck. Am I speaking with the owner or manager of the lab?"
                      rows={3}
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      This is the first message the AI will say when calling customers
                    </p>
                  </div>
                </div>

                {/* Basic Campaign Info */}
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Campaign Name</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      rows={2}
                    />
                  </div>

                  <div>
                    <Label htmlFor="aiPrompt">AI Prompt</Label>
                    <Textarea
                      id="aiPrompt"
                      value={formData.aiPrompt}
                      onChange={(e) => setFormData({ ...formData, aiPrompt: e.target.value })}
                      rows={4}
                    />
                  </div>

                  <div>
                    <Label htmlFor="script">Agent Script</Label>
                    <Textarea
                      id="script"
                      value={formData.script}
                      onChange={(e) => setFormData({ ...formData, script: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>

                {/* Voice Configuration */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Volume2 className="h-5 w-5" />
                    <h3 className="text-lg font-semibold">Voice Configuration</h3>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="voiceModel">Voice Model</Label>
                      <Select
                        value={formData.voiceConfig.model}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          voiceConfig: { ...formData.voiceConfig, model: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select voice model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="eleven_turbo_v2">ElevenLabs Turbo v2</SelectItem>
                          <SelectItem value="eleven_multilingual_v2">ElevenLabs Multilingual v2</SelectItem>
                          <SelectItem value="eleven_monolingual_v1">ElevenLabs Monolingual v1</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="voiceId">Agent Voice</Label>
                      <Select
                        value={formData.voiceConfig.voiceId}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          voiceConfig: { ...formData.voiceConfig, voiceId: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select agent voice" />
                        </SelectTrigger>
                        <SelectContent>
                          {/* Default voices */}
                          <SelectItem value="Z6TUNPsOxhTPtqLx81EX">Aavika (Female, Indian)</SelectItem>
                          <SelectItem value="pNInz6obpgDQGcFmaJgB">Adam (Male, Professional)</SelectItem>
                          <SelectItem value="EXAVITQu4vr4xnSDxMaL">Bella (Female, Friendly)</SelectItem>
                          <SelectItem value="VR6AewLTigWG4xSOukaG">Josh (Male, Confident)</SelectItem>
                          <SelectItem value="AZnzlk1XvdvUeBnXmlld">Domi (Female, Natural)</SelectItem>
                          <SelectItem value="MF3mGyEYCl7XYWbV9V6O">Elli (Female, Expressive)</SelectItem>
                          <SelectItem value="TxGEqnHWrfWFTfGW9XjX">Josh (Male, Deep)</SelectItem>
                          <SelectItem value="rQ4WfvUDcRjgGrfWnO3s">Priya (Female, Hindi/English)</SelectItem>
                          
                          {/* Custom ElevenLabs voices */}
                          {elevenLabsVoices.map((voice) => (
                            <SelectItem key={voice.voice_id} value={voice.voice_id}>
                              {voice.name} ({voice.category})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose the voice that matches your agent name
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Voice Stability: {formData.voiceConfig.stability}</Label>
                      <Slider
                        value={[formData.voiceConfig.stability]}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          voiceConfig: { ...formData.voiceConfig, stability: value[0] }
                        })}
                        min={0}
                        max={1}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground">Higher values = more stable voice</p>
                    </div>

                    <div>
                      <Label>Similarity Boost: {formData.voiceConfig.similarityBoost}</Label>
                      <Slider
                        value={[formData.voiceConfig.similarityBoost]}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          voiceConfig: { ...formData.voiceConfig, similarityBoost: value[0] }
                        })}
                        min={0}
                        max={1}
                        step={0.05}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground">Higher values = more similar to original voice</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Voice Style: {formData.voiceConfig.style}</Label>
                      <Slider
                        value={[formData.voiceConfig.style]}
                        onValueChange={(value) => setFormData({
                          ...formData,
                          voiceConfig: { ...formData.voiceConfig, style: value[0] }
                        })}
                        min={0}
                        max={1}
                        step={0.1}
                        className="mt-2"
                      />
                      <p className="text-sm text-muted-foreground">Adjusts voice expressiveness</p>
                    </div>

                    <div className="flex items-center space-x-3 pt-6">
                      <input
                        type="checkbox"
                        id="useSpeakerBoost"
                        checked={formData.voiceConfig.useSpeakerBoost}
                        onChange={(e) => setFormData({
                          ...formData,
                          voiceConfig: { ...formData.voiceConfig, useSpeakerBoost: e.target.checked }
                        })}
                        className="rounded"
                      />
                      <Label htmlFor="useSpeakerBoost">Enable Speaker Boost</Label>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-between pt-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Campaign
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{selectedCampaign.name}"? This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button
                    onClick={handleSave}
                    disabled={updateCampaignMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updateCampaignMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Select a campaign from the list to edit its settings</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}