import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Campaign, InsertCampaign } from "@shared/schema";
import Sidebar from "@/components/sidebar";

export default function Campaigns() {
  const [newCampaign, setNewCampaign] = useState<InsertCampaign>({
    name: "",
    description: "",
    aiPrompt: "",
    isActive: true,
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch campaigns
  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
    refetchInterval: 30000,
  });

  // Create campaign mutation
  const createCampaignMutation = useMutation({
    mutationFn: async (data: InsertCampaign) => {
      return await apiRequest('POST', '/api/campaigns', data);
    },
    onSuccess: () => {
      toast({
        title: "Campaign created successfully",
        description: "The new campaign has been added.",
      });
      setNewCampaign({ name: "", description: "", aiPrompt: "", isActive: true });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
    onError: () => {
      toast({
        title: "Failed to create campaign",
        description: "There was an error creating the campaign.",
        variant: "destructive",
      });
    },
  });

  // Toggle campaign status
  const toggleCampaignMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      return await apiRequest('PATCH', `/api/campaigns/${id}`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaign.name || !newCampaign.description || !newCampaign.aiPrompt) {
      toast({
        title: "Missing required fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    createCampaignMutation.mutate(newCampaign);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">AI Configuration</h2>
              <p className="text-gray-600 mt-1">Manage your AI calling campaigns</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-blue-700">
                  <i className="fas fa-plus mr-2"></i>
                  Create Campaign
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Create New Campaign</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Campaign Name *</Label>
                    <Input
                      id="name"
                      value={newCampaign.name}
                      onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                      placeholder="Customer Survey"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description *</Label>
                    <Input
                      id="description"
                      value={newCampaign.description || ""}
                      onChange={(e) => setNewCampaign({ ...newCampaign, description: e.target.value })}
                      placeholder="Brief description of the campaign goals"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="aiPrompt">AI Prompt *</Label>
                    <Textarea
                      id="aiPrompt"
                      value={newCampaign.aiPrompt}
                      onChange={(e) => setNewCampaign({ ...newCampaign, aiPrompt: e.target.value })}
                      placeholder="Enter the AI instructions for how to conduct the call..."
                      rows={6}
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      This prompt will guide the AI on how to conduct conversations for this campaign.
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isActive"
                      checked={newCampaign.isActive}
                      onCheckedChange={(checked) => setNewCampaign({ ...newCampaign, isActive: checked })}
                    />
                    <Label htmlFor="isActive">Active Campaign</Label>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createCampaignMutation.isPending}
                      className="bg-primary text-white hover:bg-blue-700"
                    >
                      {createCampaignMutation.isPending ? "Creating..." : "Create Campaign"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="h-6 bg-gray-300 rounded mb-4"></div>
                  <div className="h-4 bg-gray-300 rounded mb-3"></div>
                  <div className="space-y-2 mb-4">
                    <div className="h-3 bg-gray-300 rounded"></div>
                    <div className="h-3 bg-gray-300 rounded"></div>
                    <div className="h-3 bg-gray-300 rounded w-3/4"></div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="h-6 bg-gray-300 rounded w-16"></div>
                    <div className="h-8 bg-gray-300 rounded w-20"></div>
                  </div>
                </div>
              ))
            ) : campaigns.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <i className="fas fa-brain text-gray-400 text-4xl mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No campaigns yet</h3>
                <p className="text-gray-600">Create your first AI campaign to get started.</p>
              </div>
            ) : (
              campaigns.map((campaign) => (
                <div key={campaign.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{campaign.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{campaign.description}</p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        checked={campaign.isActive}
                        onCheckedChange={(checked) => 
                          toggleCampaignMutation.mutate({ id: campaign.id, isActive: checked })
                        }
                      />
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        campaign.isActive 
                          ? 'bg-success/10 text-success' 
                          : 'bg-gray/10 text-gray-600'
                      }`}>
                        {campaign.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">AI Prompt:</h4>
                    <div className="bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">
                        {campaign.aiPrompt.length > 200 
                          ? `${campaign.aiPrompt.substring(0, 200)}...` 
                          : campaign.aiPrompt
                        }
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      <i className="fas fa-clock mr-1"></i>
                      Created {new Date(campaign.createdAt).toLocaleDateString()}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <i className="fas fa-edit mr-1"></i>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" className="text-primary hover:text-blue-700">
                        <i className="fas fa-play mr-1"></i>
                        Start
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}