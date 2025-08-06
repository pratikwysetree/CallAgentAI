import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Phone, Settings, Mic, Volume2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Campaign form schema
const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  introLine: z.string().min(1, "Introduction script is required"),
  aiPrompt: z.string().min(1, "AI prompt is required"),
  language: z.string().min(1, "Language is required"),
  elevenlabsModel: z.string().min(1, "ElevenLabs model is required"),
  voiceId: z.string().min(1, "Voice selection is required"),
});

type CampaignFormData = z.infer<typeof campaignSchema>;

const ELEVENLABS_MODELS = [
  { value: "eleven_multilingual_v2", label: "Multilingual V2 (Recommended)" },
  { value: "eleven_english_v1", label: "English V1" },
  { value: "eleven_turbo_v2", label: "Turbo V2 (Fast)" },
  { value: "eleven_monolingual_v1", label: "Monolingual V1" },
];

const VOICE_OPTIONS = [
  { value: "21m00Tcm4TlvDq8ikWAM", label: "Rachel (Female)" },
  { value: "AZnzlk1XvdvUeBnXmlld", label: "Domi (Female)" },
  { value: "EXAVITQu4vr4xnSDxMaL", label: "Bella (Female)" },
  { value: "ErXwobaYiN019PkySvjV", label: "Antoni (Male)" },
  { value: "MF3mGyEYCl7XYWbV9V6O", label: "Elli (Female)" },
  { value: "TxGEqnHWrfWFTfGW9XjX", label: "Josh (Male)" },
  { value: "VR6AewLTigWG4xSOukaG", label: "Arnold (Male)" },
  { value: "pNInz6obpgDQGcFmaJgB", label: "Adam (Male)" },
  { value: "yoZ06aMxZJJ28mfd3POQ", label: "Sam (Male)" },
];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
];

export default function CampaignManagerPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['/api/campaigns'],
  });

  // Form setup
  const form = useForm<CampaignFormData>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      introLine: "",
      aiPrompt: "",
      language: "en",
      elevenlabsModel: "eleven_multilingual_v2",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
    },
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: (data: CampaignFormData) => fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({
        title: "Campaign created",
        description: "Your AI calling campaign has been created successfully.",
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create campaign",
        variant: "destructive",
      });
    },
  });

  // Update campaign mutation
  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CampaignFormData }) => 
      fetch(`/api/campaigns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({
        title: "Campaign updated",
        description: "Your campaign has been updated successfully.",
      });
      setIsDialogOpen(false);
      setEditingCampaign(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update campaign",
        variant: "destructive",
      });
    },
  });

  // Delete campaign mutation
  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/campaigns/${id}`, {
      method: 'DELETE',
    }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
      toast({
        title: "Campaign deleted",
        description: "Campaign has been removed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete campaign",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (data: CampaignFormData) => {
    if (editingCampaign) {
      updateCampaignMutation.mutate({ id: editingCampaign.id, data });
    } else {
      createCampaignMutation.mutate(data);
    }
  };

  const handleEdit = (campaign: any) => {
    setEditingCampaign(campaign);
    form.reset({
      name: campaign.name,
      introLine: campaign.introLine || "",
      aiPrompt: campaign.aiPrompt || "",
      language: campaign.language || "en",
      elevenlabsModel: campaign.elevenlabsModel || "eleven_multilingual_v2",
      voiceId: campaign.voiceId || "21m00Tcm4TlvDq8ikWAM",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (campaignId: string) => {
    if (confirm("Are you sure you want to delete this campaign? This action cannot be undone.")) {
      deleteCampaignMutation.mutate(campaignId);
    }
  };

  const openCreateDialog = () => {
    setEditingCampaign(null);
    form.reset();
    setIsDialogOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Campaign Manager
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Create and manage AI calling campaigns with custom scripts and voice settings
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                New Campaign
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingCampaign ? "Edit Campaign" : "Create New Campaign"}
                </DialogTitle>
                <DialogDescription>
                  Configure your AI calling campaign with custom scripts and voice settings.
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
                {/* Campaign Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">Campaign Name</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="e.g., Lab Partnership Outreach"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-red-500">{form.formState.errors.name.message}</p>
                  )}
                </div>

                {/* Introduction Script */}
                <div className="space-y-2">
                  <Label htmlFor="introLine">Introduction Script</Label>
                  <Textarea
                    id="introLine"
                    {...form.register("introLine")}
                    placeholder="Hello, this is an AI calling agent from LabsCheck. We help connect patients with quality pathology labs..."
                    rows={3}
                  />
                  {form.formState.errors.introLine && (
                    <p className="text-sm text-red-500">{form.formState.errors.introLine.message}</p>
                  )}
                </div>

                {/* AI Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="aiPrompt">AI Prompt (Call Flow Instructions)</Label>
                  <Textarea
                    id="aiPrompt"
                    {...form.register("aiPrompt")}
                    placeholder="You are a professional representative from LabsCheck. Your goal is to establish partnerships with pathology labs. Be polite, informative, and focus on our zero-commission model. Ask about their current patient volume, testing capabilities, and interest in expanding their reach..."
                    rows={5}
                  />
                  {form.formState.errors.aiPrompt && (
                    <p className="text-sm text-red-500">{form.formState.errors.aiPrompt.message}</p>
                  )}
                </div>

                {/* Language Selection */}
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={form.watch("language")} onValueChange={(value) => form.setValue("language", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select language" />
                    </SelectTrigger>
                    <SelectContent>
                      {LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.language && (
                    <p className="text-sm text-red-500">{form.formState.errors.language.message}</p>
                  )}
                </div>

                {/* ElevenLabs Model Selection */}
                <div className="space-y-2">
                  <Label>ElevenLabs Model</Label>
                  <Select value={form.watch("elevenlabsModel")} onValueChange={(value) => form.setValue("elevenlabsModel", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select AI voice model" />
                    </SelectTrigger>
                    <SelectContent>
                      {ELEVENLABS_MODELS.map((model) => (
                        <SelectItem key={model.value} value={model.value}>
                          {model.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.elevenlabsModel && (
                    <p className="text-sm text-red-500">{form.formState.errors.elevenlabsModel.message}</p>
                  )}
                </div>

                {/* Voice Selection */}
                <div className="space-y-2">
                  <Label>Voice Agent</Label>
                  <Select value={form.watch("voiceId")} onValueChange={(value) => form.setValue("voiceId", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select voice agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((voice) => (
                        <SelectItem key={voice.value} value={voice.value}>
                          <div className="flex items-center">
                            <Mic className="h-4 w-4 mr-2" />
                            {voice.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.voiceId && (
                    <p className="text-sm text-red-500">{form.formState.errors.voiceId.message}</p>
                  )}
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                  >
                    {(createCampaignMutation.isPending || updateCampaignMutation.isPending) ? "Saving..." : "Save Campaign"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div className="grid gap-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader>
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (campaigns as any[]).length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Campaigns Yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create your first AI calling campaign to start reaching out to potential lab partners.
              </p>
              <Button onClick={openCreateDialog}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Campaign
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(campaigns as any[]).map((campaign: any) => (
              <Card key={campaign.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Created {new Date(campaign.createdAt).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(campaign)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(campaign.id)}
                        disabled={deleteCampaignMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Language & Voice Badges */}
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary">
                        {LANGUAGES.find(l => l.value === campaign.language)?.label || campaign.language}
                      </Badge>
                      <Badge variant="outline">
                        <Volume2 className="h-3 w-3 mr-1" />
                        {VOICE_OPTIONS.find(v => v.value === campaign.voiceId)?.label || "Custom Voice"}
                      </Badge>
                    </div>

                    {/* Introduction Preview */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Introduction:
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {campaign.introLine || "No introduction script set"}
                      </p>
                    </div>

                    {/* AI Prompt Preview */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        AI Instructions:
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                        {campaign.aiPrompt || "No AI prompt configured"}
                      </p>
                    </div>

                    {/* Model Info */}
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>
                          <Settings className="h-3 w-3 inline mr-1" />
                          {ELEVENLABS_MODELS.find(m => m.value === campaign.elevenlabsModel)?.label || "Default Model"}
                        </span>
                        <span>{campaign.totalCalls || 0} calls made</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}