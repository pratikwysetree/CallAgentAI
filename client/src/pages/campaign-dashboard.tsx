import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isTomorrow, addDays } from 'date-fns';
import Sidebar from '@/components/sidebar';
import { 
  Calendar,
  Phone,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  Users,
  Target,
  Activity,
  Eye,
  Edit,
  MoreHorizontal
} from 'lucide-react';

interface CampaignContact {
  id: string;
  contactId: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  company: string;
  callStatus: 'pending' | 'completed' | 'failed' | 'scheduled';
  callTime?: string;
  callDuration?: number;
  messageStatus: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  messageTime?: string;
  conversationSummary?: string;
  nextAction: 'follow_up_call' | 'send_brochure' | 'schedule_demo' | 'close_deal' | 'nurture' | 'no_interest';
  nextFollowUp?: string;
  engagementScore: number;
  status: 'active' | 'converted' | 'closed' | 'paused';
}

interface Campaign {
  id: string;
  name: string;
  channel: 'CALL' | 'WHATSAPP' | 'BOTH' | 'EMAIL';
  startDate: string;
  endDate?: string;
  totalContacts: number;
  completedContacts: number;
  successRate: number;
  status: 'active' | 'paused' | 'completed';
  template?: string;
  contacts: CampaignContact[];
}

export default function CampaignDashboard() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [contactFilter, setContactFilter] = useState('all');

  // Fetch campaigns data
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['/api/campaigns/dashboard', selectedDate],
    queryFn: async () => {
      // Mock data for now - replace with actual API call
      const mockCampaigns: Campaign[] = [
        {
          id: 'campaign_1754568606271',
          name: 'LabsCheck Onboarding - December',
          channel: 'BOTH',
          startDate: '2025-08-07',
          totalContacts: 150,
          completedContacts: 45,
          successRate: 68,
          status: 'active',
          template: 'account_created',
          contacts: [
            {
              id: '1',
              contactId: 'de105f74-24e6-49cf-bb90-bc5248b5e2a0',
              contactName: 'Pratik',
              phone: '+919325025730',
              email: 'pratik@example.com',
              city: 'Mumbai',
              company: 'City Diagnostics',
              callStatus: 'completed',
              callTime: '2025-08-07T10:30:00Z',
              callDuration: 480,
              messageStatus: 'read',
              messageTime: '2025-08-07T10:10:00Z',
              conversationSummary: 'Interested in platform. Lab owner confirmed. Wants demo next week.',
              nextAction: 'schedule_demo',
              nextFollowUp: '2025-08-14T10:00:00Z',
              engagementScore: 85,
              status: 'active'
            },
            {
              id: '2',
              contactId: 'contact-2',
              contactName: 'Dr. Sharma',
              phone: '+919876543210',
              email: 'sharma@labcenter.com',
              city: 'Delhi',
              company: 'Advanced Lab Center',
              callStatus: 'completed',
              callTime: '2025-08-07T11:15:00Z',
              callDuration: 720,
              messageStatus: 'delivered',
              messageTime: '2025-08-07T11:00:00Z',
              conversationSummary: 'Very interested. Already using competitor. Needs pricing comparison.',
              nextAction: 'send_brochure',
              nextFollowUp: '2025-08-09T14:00:00Z',
              engagementScore: 92,
              status: 'active'
            },
            {
              id: '3',
              contactId: 'contact-3',
              contactName: 'Rajesh Kumar',
              phone: '+919123456789',
              email: 'rajesh@healthlab.in',
              city: 'Bangalore',
              company: 'Health First Lab',
              callStatus: 'failed',
              callTime: '2025-08-07T09:45:00Z',
              messageStatus: 'sent',
              messageTime: '2025-08-07T09:30:00Z',
              conversationSummary: 'Call disconnected. Left voicemail. WhatsApp message sent.',
              nextAction: 'follow_up_call',
              nextFollowUp: '2025-08-08T15:00:00Z',
              engagementScore: 30,
              status: 'active'
            }
          ]
        }
      ];
      return mockCampaigns;
    }
  });

  const todaysCampaigns = campaigns?.filter(campaign => 
    campaign.contacts.some(contact => 
      contact.callTime && isToday(new Date(contact.callTime)) ||
      contact.messageTime && isToday(new Date(contact.messageTime))
    )
  ) || [];

  const todaysContacts = campaigns?.flatMap(campaign => 
    campaign.contacts.filter(contact => 
      contact.callTime && isToday(new Date(contact.callTime)) ||
      contact.messageTime && isToday(new Date(contact.messageTime)) ||
      contact.nextFollowUp && isToday(new Date(contact.nextFollowUp))
    )
  ) || [];

  const upcomingFollowUps = campaigns?.flatMap(campaign => 
    campaign.contacts.filter(contact => 
      contact.nextFollowUp && (
        isToday(new Date(contact.nextFollowUp)) ||
        isTomorrow(new Date(contact.nextFollowUp))
      )
    )
  ) || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'sent': 
      case 'delivered': 
      case 'read': return 'bg-blue-500';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getNextActionLabel = (action: string) => {
    switch (action) {
      case 'follow_up_call': return 'Follow-up Call';
      case 'send_brochure': return 'Send Brochure';
      case 'schedule_demo': return 'Schedule Demo';
      case 'close_deal': return 'Close Deal';
      case 'nurture': return 'Nurture Lead';
      case 'no_interest': return 'No Interest';
      default: return action;
    }
  };

  const getNextActionColor = (action: string) => {
    switch (action) {
      case 'schedule_demo': 
      case 'close_deal': return 'bg-green-100 text-green-800';
      case 'follow_up_call': 
      case 'send_brochure': return 'bg-blue-100 text-blue-800';
      case 'nurture': return 'bg-yellow-100 text-yellow-800';
      case 'no_interest': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar />
        <main className="flex-1 p-6">
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p>Loading campaign dashboard...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Campaign Dashboard</h1>
              <p className="text-gray-600 mt-1">Monitor and manage your active campaigns</p>
            </div>
            <div className="flex items-center gap-4">
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-auto"
              />
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Today's Campaigns</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todaysCampaigns.length}</div>
                <p className="text-xs text-muted-foreground">Active campaigns today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contacts Processed</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todaysContacts.length}</div>
                <p className="text-xs text-muted-foreground">Calls and messages today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {campaigns?.[0]?.successRate || 0}%
                </div>
                <p className="text-xs text-muted-foreground">Average engagement</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Follow-ups Due</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{upcomingFollowUps.length}</div>
                <p className="text-xs text-muted-foreground">Today and tomorrow</p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="today" className="space-y-4">
            <TabsList>
              <TabsTrigger value="today">Today's Activity</TabsTrigger>
              <TabsTrigger value="campaigns">Active Campaigns</TabsTrigger>
              <TabsTrigger value="followups">Follow-ups</TabsTrigger>
            </TabsList>

            <TabsContent value="today" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Today's Campaign Contacts</CardTitle>
                  <CardDescription>
                    Detailed view of all contacts processed today
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Select value={contactFilter} onValueChange={setContactFilter}>
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Contacts</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Contact</TableHead>
                            <TableHead>Call Status</TableHead>
                            <TableHead>Message Status</TableHead>
                            <TableHead>Conversation Summary</TableHead>
                            <TableHead>Next Action</TableHead>
                            <TableHead>Follow-up</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {todaysContacts.map((contact) => (
                            <TableRow key={contact.id}>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{contact.contactName}</div>
                                  <div className="text-sm text-gray-500">{contact.company}</div>
                                  <div className="text-xs text-gray-400">{contact.phone}</div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Badge className={getStatusColor(contact.callStatus)}>
                                    {contact.callStatus}
                                  </Badge>
                                  {contact.callTime && (
                                    <div className="text-xs text-gray-500">
                                      {format(new Date(contact.callTime), 'HH:mm')}
                                      {contact.callDuration && (
                                        <span> ({Math.floor(contact.callDuration / 60)}min)</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <Badge className={getStatusColor(contact.messageStatus)}>
                                    {contact.messageStatus}
                                  </Badge>
                                  {contact.messageTime && (
                                    <div className="text-xs text-gray-500">
                                      {format(new Date(contact.messageTime), 'HH:mm')}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="max-w-xs text-sm">
                                  {contact.conversationSummary || 'No summary available'}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={getNextActionColor(contact.nextAction)}>
                                  {getNextActionLabel(contact.nextAction)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                {contact.nextFollowUp && (
                                  <div className="text-sm">
                                    <div>{format(new Date(contact.nextFollowUp), 'MMM dd')}</div>
                                    <div className="text-xs text-gray-500">
                                      {format(new Date(contact.nextFollowUp), 'HH:mm')}
                                    </div>
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">{contact.engagementScore}</div>
                                  <Progress 
                                    value={contact.engagementScore} 
                                    className="w-16"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="campaigns" className="space-y-4">
              <div className="grid gap-4">
                {campaigns?.map((campaign) => (
                  <Card key={campaign.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{campaign.name}</CardTitle>
                          <CardDescription>
                            {campaign.channel} Campaign • {campaign.totalContacts} contacts
                          </CardDescription>
                        </div>
                        <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                          {campaign.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-2xl font-bold">{campaign.completedContacts}</div>
                          <p className="text-xs text-muted-foreground">Completed</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{campaign.totalContacts - campaign.completedContacts}</div>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{campaign.successRate}%</div>
                          <p className="text-xs text-muted-foreground">Success Rate</p>
                        </div>
                        <div>
                          <Progress 
                            value={(campaign.completedContacts / campaign.totalContacts) * 100} 
                            className="mt-2"
                          />
                          <p className="text-xs text-muted-foreground mt-1">Progress</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="followups" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Follow-ups</CardTitle>
                  <CardDescription>
                    Scheduled follow-up activities for today and tomorrow
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contact</TableHead>
                          <TableHead>Action Required</TableHead>
                          <TableHead>Scheduled</TableHead>
                          <TableHead>Last Interaction</TableHead>
                          <TableHead>Priority</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {upcomingFollowUps.map((contact) => (
                          <TableRow key={contact.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{contact.contactName}</div>
                                <div className="text-sm text-gray-500">{contact.company}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge className={getNextActionColor(contact.nextAction)}>
                                {getNextActionLabel(contact.nextAction)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {contact.nextFollowUp && (
                                <div>
                                  <div className="font-medium">
                                    {isToday(new Date(contact.nextFollowUp)) ? 'Today' : 
                                     isTomorrow(new Date(contact.nextFollowUp)) ? 'Tomorrow' :
                                     format(new Date(contact.nextFollowUp), 'MMM dd')}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {format(new Date(contact.nextFollowUp), 'HH:mm')}
                                  </div>
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                Call: {contact.callStatus}
                                <br />
                                Message: {contact.messageStatus}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={contact.engagementScore > 70 ? 'default' : 'secondary'}>
                                {contact.engagementScore > 70 ? 'High' : 'Medium'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm">
                                  <Phone className="h-4 w-4 mr-1" />
                                  Call
                                </Button>
                                <Button variant="outline" size="sm">
                                  <MessageSquare className="h-4 w-4 mr-1" />
                                  Message
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}