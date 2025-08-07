import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  UserPlus
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

  // Fetch contacts with engagement data
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['/api/contacts/enhanced'],
  });

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

      <Tabs defaultValue="contacts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contacts">Contact Management</TabsTrigger>
          <TabsTrigger value="campaigns">Start Campaign</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="contacts" className="space-y-6">
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
              <CardTitle>Contact Database ({(contacts as any[])?.length || 0} contacts)</CardTitle>
              <CardDescription>
                Select contacts for campaigns. Click checkboxes to select multiple contacts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {contactsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin" />
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
                      <TableHead>Last Contacted</TableHead>
                      <TableHead>Next Follow-up</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(contacts as any[])?.map((contact: any) => (
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