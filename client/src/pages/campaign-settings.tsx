import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Save, Settings, MessageSquare } from "lucide-react";
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

interface Campaign {
  id: string;
  name: string;
  description: string;
  aiPrompt: string;
  script: string;
  introLine: string;
  agentName: string;
  openaiModel: string;
  voiceConfig: any;
  transcriberConfig: any;
  isActive: boolean;
  createdAt: string;
}

export default function CampaignSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [formData, setFormData] = useState({
    introLine: "",
    agentName: "",
    name: "",
    description: "",
    aiPrompt: "",
    script: ""
  });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['/api/campaigns'],
    queryFn: () => apiRequest('/api/campaigns')
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Campaign> }) =>
      apiRequest(`/api/campaigns/${id}`, 'PATCH', data),
    onSuccess: () => {
      toast({ title: "Campaign updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
    onError: () => {
      toast({ title: "Failed to update campaign", variant: "destructive" });
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/campaigns/${id}`, 'DELETE'),
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
        script: ""
      });
    },
    onError: () => {
      toast({ title: "Failed to delete campaign", variant: "destructive" });
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
        script: selectedCampaign.script || ""
      });
    }
  }, [selectedCampaign]);

  const handleSave = () => {
    if (!selectedCampaign) return;
    
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
              {campaigns?.map((campaign: Campaign) => (
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