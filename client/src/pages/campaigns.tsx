import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Plus, Play, Settings, FileText, Bot, Mic, Volume2 } from "lucide-react";
import Sidebar from "@/components/sidebar";
import type { Campaign, InsertCampaign } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function Campaigns() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newCampaign, setNewCampaign] = useState<InsertCampaign>({
    name: "",
    description: "",
    aiPrompt: "",
    script: "",
    openaiModel: "gpt-4o",
    voiceConfig: null,
    transcriberConfig: null,
    isActive: true,
  });
  
  const [useIndicTTS, setUseIndicTTS] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    language: "hi",
    speaker: "female",
    speed: 1,
    pitch: 1,
    model: "fastpitch",
    outputFormat: "wav"
  });
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
  });

  // Add campaign mutation
  const addCampaignMutation = useMutation({
    mutationFn: (campaign: InsertCampaign) => apiRequest('POST', '/api/campaigns', campaign),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      setIsAddModalOpen(false);
      setNewCampaign({
        name: "",
        description: "",
        aiPrompt: "",
        script: "",
        openaiModel: "gpt-4o",
        voiceConfig: null,
        transcriberConfig: null,
        isActive: true,
      });
      setUseIndicTTS(false);
      setVoiceSettings({
        language: "hi",
        speaker: "female",
        speed: 1,
        pitch: 1,
        model: "fastpitch",
        outputFormat: "wav"
      });
      toast({
        title: "Campaign created successfully",
        description: "Your new AI calling campaign is ready to use.",
      });
    },
    onError: (error: any) => {
      console.error('Campaign creation error:', error);
      toast({
        title: "Error creating campaign",
        description: error.message || "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddCampaign = () => {
    const campaignData = {
      ...newCampaign,
      voiceConfig: useIndicTTS ? {
        ...voiceSettings,
        useIndicTTS: true
      } : null
    };
    addCampaignMutation.mutate(campaignData);
  };

  const startCampaign = async (campaign: Campaign) => {
    try {
      // In a real implementation, this would start the campaign
      toast({
        title: "Campaign started",
        description: `${campaign.name} is now active and ready for calls.`,
      });
    } catch (error) {
      toast({
        title: "Error starting campaign",
        description: "Could not start the campaign. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">AI Campaigns</h2>
              <p className="text-gray-600 mt-1">Manage your AI calling campaigns and scripts</p>
            </div>
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                  <DialogDescription>
                    Set up your AI calling campaign with custom prompts and scripts.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Campaign Name *</Label>
                      <Input
                        id="name"
                        value={newCampaign.name}
                        onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                        placeholder="Product Launch Campaign"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="openai-model">OpenAI Model</Label>
                      <Select
                        value={newCampaign.openaiModel || "gpt-4o"}
                        onValueChange={(value) => setNewCampaign({ ...newCampaign, openaiModel: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select OpenAI model" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gpt-4o">GPT-4o (Latest)</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                          <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={newCampaign.description || ""}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="Brief description of the campaign goals"
                    />
                  </div>

                  <div>
                    <Label htmlFor="ai-prompt">AI Conversation Prompt *</Label>
                    <Textarea
                      id="ai-prompt"
                      value={newCampaign.aiPrompt}
                      onChange={(e) => setNewCampaign({ ...newCampaign, aiPrompt: e.target.value })}
                      placeholder="You are a friendly sales representative calling to discuss our new product offering. Your goal is to schedule a demo and collect contact information..."
                      className="min-h-[100px]"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="script">Agent Script (Optional)</Label>
                    <Textarea
                      id="script"
                      value={newCampaign.script || ""}
                      onChange={(e) => setNewCampaign({ ...newCampaign, script: e.target.value })}
                      placeholder="Hello, this is [Agent Name] from [Company]. I'm calling to discuss our new product that can help improve your business efficiency..."
                      className="min-h-[80px]"
                    />
                    <p className="text-sm text-gray-500 mt-1">Optional script template for agents to follow</p>
                  </div>

                  <Separator />

                  {/* Voice Synthesis Configuration */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Volume2 className="h-4 w-4 text-blue-600" />
                      <Label className="text-base font-semibold">Voice Synthesis Configuration</Label>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="use-indic-tts"
                        checked={useIndicTTS}
                        onCheckedChange={(checked) => setUseIndicTTS(checked as boolean)}
                      />
                      <Label htmlFor="use-indic-tts" className="flex items-center space-x-2">
                        <Mic className="h-4 w-4" />
                        <span>Enable AI4Bharat Indic-TTS (Hindi Voice Synthesis)</span>
                      </Label>
                    </div>
                    
                    {useIndicTTS && (
                      <div className="bg-blue-50 p-4 rounded-lg space-y-4 border border-blue-200">
                        <p className="text-sm text-blue-800 mb-3">
                          Configure AI-powered Hindi voice synthesis for natural Indian language calls
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="voice-language">Language</Label>
                            <Select
                              value={voiceSettings.language}
                              onValueChange={(value) => setVoiceSettings({ ...voiceSettings, language: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select language" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hi">Hindi (हिन्दी)</SelectItem>
                                <SelectItem value="bn">Bengali (বাংলা)</SelectItem>
                                <SelectItem value="gu">Gujarati (ગુજરાતી)</SelectItem>
                                <SelectItem value="mr">Marathi (मराठी)</SelectItem>
                                <SelectItem value="ta">Tamil (தமிழ்)</SelectItem>
                                <SelectItem value="te">Telugu (తెలుగు)</SelectItem>
                                <SelectItem value="kn">Kannada (ಕನ್ನಡ)</SelectItem>
                                <SelectItem value="ml">Malayalam (മലയാളം)</SelectItem>
                                <SelectItem value="pa">Punjabi (ਪੰਜਾਬੀ)</SelectItem>
                                <SelectItem value="or">Odia (ଓଡ଼ିଆ)</SelectItem>
                                <SelectItem value="as">Assamese (অসমীয়া)</SelectItem>
                                <SelectItem value="ur">Urdu (اردو)</SelectItem>
                                <SelectItem value="ne">Nepali (नेपाली)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="voice-speaker">Speaker</Label>
                            <Select
                              value={voiceSettings.speaker}
                              onValueChange={(value) => setVoiceSettings({ ...voiceSettings, speaker: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select speaker" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="female">Female Voice</SelectItem>
                                <SelectItem value="male">Male Voice</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="voice-speed">Speech Speed: {voiceSettings.speed}x</Label>
                            <Select
                              value={voiceSettings.speed.toString()}
                              onValueChange={(value) => setVoiceSettings({ ...voiceSettings, speed: parseFloat(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select speed" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.7">0.7x (Slower)</SelectItem>
                                <SelectItem value="0.8">0.8x (Slow)</SelectItem>
                                <SelectItem value="0.9">0.9x (Slightly Slow)</SelectItem>
                                <SelectItem value="1">1.0x (Normal)</SelectItem>
                                <SelectItem value="1.1">1.1x (Slightly Fast)</SelectItem>
                                <SelectItem value="1.2">1.2x (Fast)</SelectItem>
                                <SelectItem value="1.3">1.3x (Faster)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <div>
                            <Label htmlFor="voice-pitch">Voice Pitch: {voiceSettings.pitch}x</Label>
                            <Select
                              value={voiceSettings.pitch.toString()}
                              onValueChange={(value) => setVoiceSettings({ ...voiceSettings, pitch: parseFloat(value) })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select pitch" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="0.8">0.8x (Lower Pitch)</SelectItem>
                                <SelectItem value="0.9">0.9x (Slightly Lower)</SelectItem>
                                <SelectItem value="1">1.0x (Natural)</SelectItem>
                                <SelectItem value="1.1">1.1x (Slightly Higher)</SelectItem>
                                <SelectItem value="1.2">1.2x (Higher Pitch)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        
                        <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                          <p className="text-sm text-green-800">
                            <strong>Preview:</strong> {voiceSettings.language === "hi" ? "Hindi" : voiceSettings.language.toUpperCase()} {voiceSettings.speaker} voice at {voiceSettings.speed}x speed with {voiceSettings.pitch}x pitch
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAddCampaign}
                      disabled={addCampaignMutation.isPending || !newCampaign.name || !newCampaign.aiPrompt}
                    >
                      {addCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Bot className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">{campaigns.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Play className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Active Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaigns.filter(c => c.isActive).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <FileText className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">With Scripts</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaigns.filter(c => c.script).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Settings className="h-8 w-8 text-orange-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">GPT-4o Campaigns</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {campaigns.filter(c => c.openaiModel === 'gpt-4o').length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Campaigns List */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {isLoading ? (
                <div className="col-span-2 text-center py-8">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-gray-500">
                  No campaigns found. Create your first AI calling campaign.
                </div>
              ) : (
                campaigns.map((campaign) => (
                  <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{campaign.name}</CardTitle>
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            campaign.isActive 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {campaign.isActive ? 'Active' : 'Inactive'}
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {campaign.openaiModel}
                          </span>
                        </div>
                      </div>
                      {campaign.description && (
                        <CardDescription>{campaign.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">AI Prompt</Label>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-3">
                            {campaign.aiPrompt}
                          </p>
                        </div>
                        
                        {campaign.voiceConfig && typeof campaign.voiceConfig === 'object' && (
                          <div>
                            <Label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
                              <Volume2 className="h-3 w-3" />
                              <span>Voice Configuration</span>
                            </Label>
                            <p className="text-sm text-gray-600 mt-1">
                              {(campaign.voiceConfig as any)?.useIndicTTS ? (
                                <span className="inline-flex items-center space-x-1">
                                  <Mic className="h-3 w-3 text-blue-600" />
                                  <span>AI4Bharat {(campaign.voiceConfig as any)?.language?.toUpperCase()} ({(campaign.voiceConfig as any)?.speaker}) - Speed: {(campaign.voiceConfig as any)?.speed}x</span>
                                </span>
                              ) : (
                                "Default Twilio Voice"
                              )}
                            </p>
                          </div>
                        )}
                        
                        {campaign.script && (
                          <div>
                            <Label className="text-sm font-medium text-gray-700">Agent Script</Label>
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {campaign.script}
                            </p>
                          </div>
                        )}

                        <div className="flex justify-between items-center pt-4">
                          <div className="text-xs text-gray-500">
                            Created: {new Date(campaign.createdAt).toLocaleDateString()}
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                // In a real implementation, this would open an edit dialog
                                toast({
                                  title: "Edit Campaign",
                                  description: "Campaign editing feature coming soon.",
                                });
                              }}
                            >
                              <Settings className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => startCampaign(campaign)}
                              disabled={!campaign.isActive}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Start
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}