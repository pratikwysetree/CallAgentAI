import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Campaign } from "@shared/schema";

export default function QuickCall() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const { toast } = useToast();

  // Fetch campaigns
  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/campaigns'],
  });

  const initiateCallMutation = useMutation({
    mutationFn: async (data: { phoneNumber: string; campaignId: string }) => {
      return await apiRequest('POST', '/api/calls/initiate', data);
    },
    onSuccess: () => {
      toast({
        title: "Call initiated successfully",
        description: "The call is now being connected.",
      });
      setPhoneNumber("");
      setSelectedCampaign("");
      queryClient.invalidateQueries({ queryKey: ['/api/calls/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
    },
    onError: () => {
      toast({
        title: "Failed to initiate call",
        description: "There was an error starting the call.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber || !selectedCampaign) {
      toast({
        title: "Missing information",
        description: "Please enter a phone number and select a campaign.",
        variant: "destructive",
      });
      return;
    }

    initiateCallMutation.mutate({
      phoneNumber,
      campaignId: selectedCampaign,
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Call</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number
          </Label>
          <Input
            id="phoneNumber"
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <Label htmlFor="campaign" className="block text-sm font-medium text-gray-700 mb-2">
            Campaign
          </Label>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a campaign" />
            </SelectTrigger>
            <SelectContent>
              {campaignsLoading ? (
                <SelectItem value="loading" disabled>Loading campaigns...</SelectItem>
              ) : campaigns.length === 0 ? (
                <SelectItem value="empty" disabled>No campaigns available</SelectItem>
              ) : (
                campaigns.map((campaign) => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <Button 
          type="submit" 
          className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          disabled={initiateCallMutation.isPending}
        >
          {initiateCallMutation.isPending ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              <span>Starting Call...</span>
            </>
          ) : (
            <>
              <i className="fas fa-phone-alt"></i>
              <span>Start Call</span>
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
