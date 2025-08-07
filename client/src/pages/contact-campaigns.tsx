import { useState, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import Sidebar from '@/components/sidebar';
import { 
  Upload, 
  Download, 
  Phone, 
  MessageCircle, 
  Mail, 
  Users, 
  TrendingUp,
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  PlayCircle,
  Plus,
  UserPlus,
  Filter,
  MapPin,
  Building,
  ChevronDown,
  X
} from 'lucide-react';

interface Contact {
  id: number;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  state?: string;
  status?: string;
  lastContactedAt?: string;
  nextFollowUp?: string;
  totalEngagements: number;
}

interface CampaignAnalytics {
  totalContacts: number;
  contacted: number;
  responded: number;
  onboarded: number;
  pending: number;
  failed: number;
  followUpsDue: number;
  todayActivity: {
    reached: number;
    responded: number;
    onboarded: number;
  };
}

export default function ContactCampaigns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedContacts, setSelectedContacts] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState('contacts');
  const [campaignConfig, setCampaignConfig] = useState({
    channel: 'BOTH',
    whatsappTemplate: '',
    followUpDays: 7
  });
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    state: '',
    company: ''
  });

  // Advanced filtering states
  const [filters, setFilters] = useState({
    selectedCities: [] as string[],
    selectedStates: [] as string[],
    selectedStatuses: [] as string[],
    searchTerm: '',
    engagementMin: 0
  });
  const [showCityFilter, setShowCityFilter] = useState(false);
  const [showStateFilter, setShowStateFilter] = useState(false);
  const [showStatusFilter, setShowStatusFilter] = useState(false);

  // Fetch contacts with engagement data
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/contacts/enhanced'],
  });

  // Extract unique cities, states, and statuses for filtering
  const { uniqueCities, uniqueStates, uniqueStatuses } = useMemo(() => {
    const cities = new Set<string>();
    const states = new Set<string>();
    const statuses = new Set<string>();
    
    (contacts as any[])?.forEach((contact: any) => {
      if (contact.city) cities.add(contact.city);
      if (contact.state) states.add(contact.state);
      if (contact.status) statuses.add(contact.status);
    });
    
    return {
      uniqueCities: Array.from(cities).sort(),
      uniqueStates: Array.from(states).sort(),
      uniqueStatuses: Array.from(statuses).sort()
    };
  }, [contacts]);

  // Filter contacts based on selected criteria
  const filteredContacts = useMemo(() => {
    return (contacts as any[])?.filter((contact: any) => {
      // Search term filter
      if (filters.searchTerm) {
        const searchLower = filters.searchTerm.toLowerCase();
        const matchesSearch = 
          contact.name.toLowerCase().includes(searchLower) ||
          contact.phone.includes(filters.searchTerm) ||
          contact.email?.toLowerCase().includes(searchLower) ||
          contact.city?.toLowerCase().includes(searchLower) ||
          contact.state?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // City filter
      if (filters.selectedCities.length > 0) {
        if (!contact.city || !filters.selectedCities.includes(contact.city)) {
          return false;
        }
      }

      // State filter
      if (filters.selectedStates.length > 0) {
        if (!contact.state || !filters.selectedStates.includes(contact.state)) {
          return false;
        }
      }

      // Status filter
      if (filters.selectedStatuses.length > 0) {
        if (!contact.status || !filters.selectedStatuses.includes(contact.status)) {
          return false;
        }
      }

      // Engagement filter
      if (filters.engagementMin > 0) {
        if (contact.totalEngagements < filters.engagementMin) {
          return false;
        }
      }

      return true;
    }) || [];
  }, [contacts, filters]);

  // Fetch approved WhatsApp templates
  const { data: templates = [] } = useQuery({
    queryKey: ['/api/whatsapp/templates'],
  });

  // Fetch campaign analytics
  const { data: analytics } = useQuery<CampaignAnalytics>({
    queryKey: ['/api/campaigns/analytics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // CSV upload mutation
  const csvUploadMutation = useMutation({
    mutationFn: (formData: FormData) => 
      fetch('/api/contacts/upload', {
        method: 'POST',
        body: formData
      }).then(res => res.json()),
    onSuccess: (data) => {
      toast({ 
        title: 'CSV uploaded successfully',
        description: `Imported ${data.imported} contacts`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/enhanced'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Upload failed', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Helper functions for filter management
  const toggleCityFilter = (city: string) => {
    setFilters(prev => ({
      ...prev,
      selectedCities: prev.selectedCities.includes(city)
        ? prev.selectedCities.filter(c => c !== city)
        : [...prev.selectedCities, city]
    }));
  };

  const toggleStateFilter = (state: string) => {
    setFilters(prev => ({
      ...prev,
      selectedStates: prev.selectedStates.includes(state)
        ? prev.selectedStates.filter(s => s !== state)
        : [...prev.selectedStates, state]
    }));
  };

  const toggleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      selectedStatuses: prev.selectedStatuses.includes(status)
        ? prev.selectedStatuses.filter(s => s !== status)
        : [...prev.selectedStatuses, status]
    }));
  };

  const clearAllFilters = () => {
    setFilters({
      selectedCities: [],
      selectedStates: [],
      selectedStatuses: [],
      searchTerm: '',
      engagementMin: 0
    });
    setSelectedContacts([]);
  };

  const selectFilteredContacts = () => {
    setSelectedContacts(filteredContacts.map((contact: any) => contact.id));
  };

  // Start campaign mutation
  const startCampaignMutation = useMutation({
    mutationFn: (campaignData: any) => 
      apiRequest('POST', '/api/campaigns/start', campaignData),
    onSuccess: () => {
      toast({ title: 'Campaign started successfully' });
      setSelectedContacts([]);
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns/analytics'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to start campaign', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Sync templates mutation
  const syncTemplatesMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/whatsapp/templates/sync'),
    onSuccess: (data: any) => {
      toast({ 
        title: 'Templates synced',
        description: data.message
      });
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/templates'] });
    },
    onError: (error: any) => {
      toast({ 
        title: 'Sync failed', 
        description: error.message,
        variant: 'destructive' 
      });
    }
  });

  // Create single contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (contactData: typeof newContact) => {
      console.log('Making API request with data:', contactData);
      try {
        const result = await apiRequest('POST', '/api/contacts', contactData);
        console.log('API request successful:', result);
        return result;
      } catch (error) {
        console.error('API request failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      toast({ 
        title: 'Contact added',
        description: 'New contact has been successfully added to your database.'
      });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts/enhanced'] });
      setNewContact({
        name: '',
        phone: '',
        email: '',
        city: '',
        state: '',
        company: ''
      });
      setShowAddContact(false);
    },
    onError: (error: any) => {
      toast({ 
        title: 'Failed to add contact', 
        description: error.message || 'Failed to create contact',
        variant: 'destructive' 
      });
    }
  });

  // Handle CSV file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const formData = new FormData();
      formData.append('file', file);
      csvUploadMutation.mutate(formData);
    }
  };

  // Handle campaign start
  const handleStartCampaign = () => {
    if (selectedContacts.length === 0) {
      toast({ title: 'Please select contacts', variant: 'destructive' });
      return;
    }

    if (campaignConfig.channel === 'WHATSAPP' && !campaignConfig.whatsappTemplate) {
      toast({ title: 'Please select WhatsApp template', variant: 'destructive' });
      return;
    }

    startCampaignMutation.mutate({
      contactIds: selectedContacts,
      channel: campaignConfig.channel,
      whatsappTemplate: campaignConfig.whatsappTemplate,
      followUpDays: campaignConfig.followUpDays
    });
  };

  // Handle contact selection
  const handleContactSelect = (contactId: number, selected: boolean) => {
    if (selected) {
      setSelectedContacts([...selectedContacts, contactId]);
    } else {
      setSelectedContacts(selectedContacts.filter(id => id !== contactId));
    }
  };

  // Handle adding single contact
  const handleAddContact = () => {
    console.log('handleAddContact called with:', newContact);
    
    if (!newContact.name || !newContact.phone) {
      console.log('Missing required fields:', { name: newContact.name, phone: newContact.phone });
      toast({ 
        title: 'Missing required fields',
        description: 'Please provide at least name and phone number',
        variant: 'destructive' 
      });
      return;
    }
    
    console.log('Creating contact with mutation...');
    createContactMutation.mutate(newContact);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ONBOARDED': return 'bg-green-500';
      case 'RESPONDED': return 'bg-blue-500';
      case 'REACHED': return 'bg-yellow-500';
      case 'PENDING': return 'bg-gray-500';
      case 'FAILED': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const approvedTemplates = (templates as any[])?.filter((t: any) => t.status === 'APPROVED') || [];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contact Campaigns</h1>
          <p className="text-muted-foreground">
            Manage contacts and run multi-channel outreach campaigns
          </p>
        </div>
        <Button
          onClick={() => syncTemplatesMutation.mutate()}
          disabled={syncTemplatesMutation.isPending}
          variant="outline"
        >
          {syncTemplatesMutation.isPending ? (
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Sync Templates
        </Button>
      </div>

      {/* Dashboard Analytics */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Contacts</p>
                  <p className="text-2xl font-bold">{analytics.totalContacts}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today Reached</p>
                  <p className="text-2xl font-bold">{analytics.todayActivity.reached}</p>
                </div>
                <Phone className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today Responded</p>
                  <p className="text-2xl font-bold">{analytics.todayActivity.responded}</p>
                </div>
                <MessageCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Today Onboarded</p>
                  <p className="text-2xl font-bold">{analytics.todayActivity.onboarded}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts">Contact Management</TabsTrigger>
          <TabsTrigger value="campaigns">Start Campaign</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-6">
          {/* Advanced Filters Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Advanced Filters & City-wise Selection
              </CardTitle>
              <CardDescription>
                Filter contacts by location, status, and engagement for targeted campaigns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search and Basic Filters */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="search">Search Contacts</Label>
                  <Input
                    id="search"
                    placeholder="Search by name, phone, email..."
                    value={filters.searchTerm}
                    onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="engagement">Min Engagements</Label>
                  <Input
                    id="engagement"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={filters.engagementMin || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, engagementMin: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button 
                    onClick={selectFilteredContacts}
                    variant="outline"
                    disabled={filteredContacts.length === 0}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Select All Filtered ({filteredContacts.length})
                  </Button>
                </div>

                <div className="flex items-end gap-2">
                  <Button 
                    onClick={clearAllFilters}
                    variant="outline"
                    disabled={filters.selectedCities.length === 0 && filters.selectedStates.length === 0 && filters.selectedStatuses.length === 0 && !filters.searchTerm && filters.engagementMin === 0}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Multi-Select Filters */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* City Filter */}
                <div>
                  <Label>Cities ({filters.selectedCities.length} selected)</Label>
                  <Popover open={showCityFilter} onOpenChange={setShowCityFilter}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          {filters.selectedCities.length === 0 ? 'Select Cities' : `${filters.selectedCities.length} cities selected`}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command>
                        <CommandInput placeholder="Search cities..." />
                        <CommandList>
                          <CommandEmpty>No cities found.</CommandEmpty>
                          <CommandGroup>
                            {uniqueCities.map(city => (
                              <CommandItem key={city} onSelect={() => toggleCityFilter(city)}>
                                <Checkbox
                                  checked={filters.selectedCities.includes(city)}
                                  className="mr-2"
                                />
                                {city}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* State Filter */}
                <div>
                  <Label>States ({filters.selectedStates.length} selected)</Label>
                  <Popover open={showStateFilter} onOpenChange={setShowStateFilter}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {filters.selectedStates.length === 0 ? 'Select States' : `${filters.selectedStates.length} states selected`}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command>
                        <CommandInput placeholder="Search states..." />
                        <CommandList>
                          <CommandEmpty>No states found.</CommandEmpty>
                          <CommandGroup>
                            {uniqueStates.map(state => (
                              <CommandItem key={state} onSelect={() => toggleStateFilter(state)}>
                                <Checkbox
                                  checked={filters.selectedStates.includes(state)}
                                  className="mr-2"
                                />
                                {state}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Status Filter */}
                <div>
                  <Label>Status ({filters.selectedStatuses.length} selected)</Label>
                  <Popover open={showStatusFilter} onOpenChange={setShowStatusFilter}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        <span className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4" />
                          {filters.selectedStatuses.length === 0 ? 'Select Status' : `${filters.selectedStatuses.length} statuses selected`}
                        </span>
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0">
                      <Command>
                        <CommandInput placeholder="Search status..." />
                        <CommandList>
                          <CommandEmpty>No statuses found.</CommandEmpty>
                          <CommandGroup>
                            {uniqueStatuses.map(status => (
                              <CommandItem key={status} onSelect={() => toggleStatusFilter(status)}>
                                <Checkbox
                                  checked={filters.selectedStatuses.includes(status)}
                                  className="mr-2"
                                />
                                <Badge className={getStatusColor(status)}>{status}</Badge>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Filter Summary */}
              {(filters.selectedCities.length > 0 || filters.selectedStates.length > 0 || filters.selectedStatuses.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  <span className="text-sm font-medium">Active Filters:</span>
                  {filters.selectedCities.map(city => (
                    <Badge key={city} variant="secondary" className="cursor-pointer" onClick={() => toggleCityFilter(city)}>
                      <MapPin className="h-3 w-3 mr-1" />
                      {city}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  {filters.selectedStates.map(state => (
                    <Badge key={state} variant="secondary" className="cursor-pointer" onClick={() => toggleStateFilter(state)}>
                      <Building className="h-3 w-3 mr-1" />
                      {state}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                  {filters.selectedStatuses.map(status => (
                    <Badge key={status} variant="secondary" className="cursor-pointer" onClick={() => toggleStatusFilter(status)}>
                      {status}
                      <X className="h-3 w-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Results Summary */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">
                      Showing {filteredContacts.length} of {(contacts as any[])?.length || 0} contacts
                    </p>
                    {selectedContacts.length > 0 && (
                      <p className="text-sm text-blue-600">
                        {selectedContacts.length} contacts selected for campaign
                      </p>
                    )}
                  </div>
                  {filteredContacts.length > 0 && (
                    <Button 
                      onClick={() => {
                        const contactIds = filteredContacts.map((contact: any) => contact.id);
                        setSelectedContacts(contactIds);
                        setActiveTab('campaigns');
                        toast({
                          title: "Contacts Selected",
                          description: `${contactIds.length} contacts selected for campaign. Switched to Campaign tab.`
                        });
                      }}
                      size="sm"
                    >
                      Start Campaign with Filtered Contacts
                    </Button>
                  )}
                </div>
              </div>

              {/* Quick WhatsApp Template Selection */}
              {(selectedContacts.length > 0 || filteredContacts.length > 0) && (
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <MessageCircle className="h-4 w-4 text-green-600" />
                        <Label className="text-sm font-medium text-green-800">WhatsApp Campaign Setup</Label>
                        <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                          {approvedTemplates.length} Preapproved Templates
                        </Badge>
                      </div>
                      <p className="text-xs text-green-600 mb-3">
                        Select from your preapproved WhatsApp templates. These templates have been verified by Meta Business API and are ready for campaigns.
                      </p>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-sm font-medium">Select WhatsApp Template</Label>
                          <Select 
                            value={campaignConfig.whatsappTemplate} 
                            onValueChange={(value) => setCampaignConfig(prev => ({ ...prev, whatsappTemplate: value }))}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Choose approved template..." />
                            </SelectTrigger>
                            <SelectContent>
                              {approvedTemplates.length === 0 ? (
                                <SelectItem value="no-templates" disabled>
                                  No approved templates - Sync templates first
                                </SelectItem>
                              ) : (
                                approvedTemplates.map((template: any) => (
                                  <SelectItem key={template.id} value={template.name}>
                                    {template.name} ({template.category})
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {campaignConfig.whatsappTemplate && (
                          <div>
                            <Label className="text-sm font-medium">Campaign Channel</Label>
                            <Select 
                              value={campaignConfig.channel} 
                              onValueChange={(value) => setCampaignConfig(prev => ({ ...prev, channel: value }))}
                            >
                              <SelectTrigger className="bg-white">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="WHATSAPP">WhatsApp Only</SelectItem>
                                <SelectItem value="CALL">AI Call Only</SelectItem>
                                <SelectItem value="BOTH">Call + WhatsApp Follow-up</SelectItem>
                                <SelectItem value="EMAIL">Email Only</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      {campaignConfig.whatsappTemplate && (
                        <div className="mt-3 p-2 bg-white rounded border">
                          <p className="text-xs text-gray-600">
                            <strong>Selected Template:</strong> {campaignConfig.whatsappTemplate} 
                            <span className="ml-2 text-green-600">
                              ({campaignConfig.channel === 'WHATSAPP' ? 'WhatsApp Only' : 
                                campaignConfig.channel === 'BOTH' ? 'Call + WhatsApp Follow-up' : 
                                campaignConfig.channel === 'EMAIL' ? 'Email Only' : 'AI Call Only'})
                            </span>
                          </p>
                        </div>
                      )}
                    </div>
                    {selectedContacts.length > 0 && campaignConfig.whatsappTemplate && (
                      <Button 
                        onClick={() => {
                          setActiveTab('campaigns');
                          toast({
                            title: "Ready for Campaign",
                            description: `${selectedContacts.length} contacts selected with ${campaignConfig.whatsappTemplate} template. Switched to Campaign tab.`
                          });
                        }}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <PlayCircle className="h-4 w-4 mr-2" />
                        Start Campaign Now
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Add Contacts
              </CardTitle>
              <CardDescription>
                Upload CSV file or add individual contacts manually
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bulk Upload Section */}
              <div>
                <h4 className="text-sm font-medium mb-2">Bulk Upload</h4>
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={csvUploadMutation.isPending}
                  >
                    {csvUploadMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Choose CSV File
                      </>
                    )}
                  </Button>
                  <Button variant="outline">
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </Button>
                </div>
              </div>

              {/* Single Contact Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium">Add Single Contact</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      console.log('Add Contact button clicked, current state:', showAddContact);
                      setShowAddContact(!showAddContact);
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {showAddContact ? 'Cancel' : 'Add Contact'}
                  </Button>
                </div>

                {showAddContact && (
                  <div className="border rounded-lg p-4 space-y-4 bg-gray-50">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="contact-name">Name *</Label>
                        <Input
                          id="contact-name"
                          value={newContact.name}
                          onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                          placeholder="Lab name or contact person"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-phone">Phone *</Label>
                        <Input
                          id="contact-phone"
                          value={newContact.phone}
                          onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                          placeholder="+919876543210"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-email">Email</Label>
                        <Input
                          id="contact-email"
                          type="email"
                          value={newContact.email}
                          onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                          placeholder="contact@lab.com"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-company">Company</Label>
                        <Input
                          id="contact-company"
                          value={newContact.company}
                          onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                          placeholder="Lab or company name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-city">City</Label>
                        <Input
                          id="contact-city"
                          value={newContact.city}
                          onChange={(e) => setNewContact({ ...newContact, city: e.target.value })}
                          placeholder="Mumbai"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-state">State</Label>
                        <Input
                          id="contact-state"
                          value={newContact.state}
                          onChange={(e) => setNewContact({ ...newContact, state: e.target.value })}
                          placeholder="Maharashtra"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowAddContact(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddContact}
                        disabled={createContactMutation.isPending}
                      >
                        {createContactMutation.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Contact
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Contact Database ({filteredContacts.length} of {(contacts as any[])?.length || 0} contacts)</CardTitle>
                  <CardDescription>
                    Select contacts for campaigns. Use filters above to target specific locations or criteria.
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedContacts([])}
                    disabled={selectedContacts.length === 0}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Clear Selection ({selectedContacts.length})
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedContacts(filteredContacts.map((contact: any) => contact.id))}
                    disabled={filteredContacts.length === 0}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Select All Filtered
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts found</h3>
                  <p className="text-gray-500 mb-4">
                    {(contacts as any[])?.length === 0 
                      ? "No contacts in database. Upload a CSV file or add contacts manually."
                      : "No contacts match your current filters. Try adjusting the filter criteria above."
                    }
                  </p>
                  {(contacts as any[])?.length > 0 && (
                    <Button onClick={clearAllFilters} variant="outline">
                      Clear All Filters
                    </Button>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Engagements</TableHead>
                      <TableHead>Last Contacted</TableHead>
                      <TableHead>Next Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredContacts.map((contact: any) => (
                      <TableRow key={contact.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedContacts.includes(contact.id)}
                            onChange={(e) => handleContactSelect(contact.id, e.target.checked)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="font-medium">{contact.name}</TableCell>
                        <TableCell>{contact.phone}</TableCell>
                        <TableCell>{contact.email || 'N/A'}</TableCell>
                        <TableCell>
                          {contact.city && contact.state 
                            ? `${contact.city}, ${contact.state}` 
                            : 'N/A'
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(contact.status || 'PENDING')}>
                            {contact.status || 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {contact.totalEngagements || 0}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {contact.lastContactedAt 
                            ? new Date(contact.lastContactedAt).toLocaleDateString()
                            : 'Never'
                          }
                        </TableCell>
                        <TableCell>
                          {contact.nextFollowUp 
                            ? new Date(contact.nextFollowUp).toLocaleDateString()
                            : 'Not scheduled'
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PlayCircle className="h-5 w-5" />
                Start Multi-Channel Campaign
              </CardTitle>
              <CardDescription>
                Configure and launch campaigns for selected contacts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Campaign Channel</Label>
                  <Select 
                    value={campaignConfig.channel} 
                    onValueChange={(value) => setCampaignConfig(prev => ({ ...prev, channel: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">AI Call Only</SelectItem>
                      <SelectItem value="WHATSAPP">WhatsApp Only</SelectItem>
                      <SelectItem value="EMAIL">Email Only</SelectItem>
                      <SelectItem value="BOTH">Call + WhatsApp Follow-up</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(campaignConfig.channel === 'WHATSAPP' || campaignConfig.channel === 'BOTH') && (
                  <div className="space-y-2">
                    <Label>WhatsApp Template</Label>
                    <Select 
                      value={campaignConfig.whatsappTemplate} 
                      onValueChange={(value) => setCampaignConfig(prev => ({ ...prev, whatsappTemplate: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select approved template" />
                      </SelectTrigger>
                      <SelectContent>
                        {approvedTemplates.map((template: any) => (
                          <SelectItem key={template.id} value={template.name}>
                            {template.name} ({template.category})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Follow-up Cycle (days)</Label>
                <Input
                  type="number"
                  value={campaignConfig.followUpDays}
                  onChange={(e) => setCampaignConfig(prev => ({ ...prev, followUpDays: parseInt(e.target.value) || 7 }))}
                  min={1}
                  max={30}
                />
                <p className="text-sm text-muted-foreground">
                  Contacts will be followed up every {campaignConfig.followUpDays} days until onboarded
                </p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Campaign Summary</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Selected contacts: {selectedContacts.length}</li>
                  <li>• Channel: {campaignConfig.channel}</li>
                  {campaignConfig.whatsappTemplate && (
                    <li>• WhatsApp template: {campaignConfig.whatsappTemplate}</li>
                  )}
                  <li>• Follow-up cycle: Every {campaignConfig.followUpDays} days</li>
                </ul>
              </div>

              <Button 
                onClick={handleStartCampaign}
                disabled={startCampaignMutation.isPending || selectedContacts.length === 0}
                className="w-full"
              >
                {startCampaignMutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Starting Campaign...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Start Campaign ({selectedContacts.length} contacts)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {analytics && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Campaign Progress</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Contacted</span>
                        <span>{analytics.contacted}/{analytics.totalContacts}</span>
                      </div>
                      <Progress value={(analytics.contacted / analytics.totalContacts) * 100} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Responded</span>
                        <span>{analytics.responded}/{analytics.contacted}</span>
                      </div>
                      <Progress value={analytics.contacted > 0 ? (analytics.responded / analytics.contacted) * 100 : 0} />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Onboarded</span>
                        <span>{analytics.onboarded}/{analytics.responded}</span>
                      </div>
                      <Progress value={analytics.responded > 0 ? (analytics.onboarded / analytics.responded) * 100 : 0} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Today's Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-green-500" />
                        <span className="text-sm">Reached</span>
                      </div>
                      <span className="font-medium">{analytics.todayActivity.reached}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-blue-500" />
                        <span className="text-sm">Responded</span>
                      </div>
                      <span className="font-medium">{analytics.todayActivity.responded}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Onboarded</span>
                      </div>
                      <span className="font-medium">{analytics.todayActivity.onboarded}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Follow-ups</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-orange-500" />
                        <span className="text-sm">Due Today</span>
                      </div>
                      <span className="font-medium">{analytics.followUpsDue}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">Pending</span>
                      </div>
                      <span className="font-medium">{analytics.pending}</span>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span className="text-sm">Failed</span>
                      </div>
                      <span className="font-medium">{analytics.failed}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}