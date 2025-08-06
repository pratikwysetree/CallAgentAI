import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone, TrendingUp, Clock, Target, Download, Filter } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function CallsAnalyticsPage() {
  // Fetch calls data
  const { data: calls = [], isLoading } = useQuery({
    queryKey: ['/api/calls'],
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
  });

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'active':
        return 'secondary';
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const calculateSuccessRate = () => {
    if (!calls.length) return 0;
    const completedCalls = calls.filter((call: any) => call.status === 'completed').length;
    return Math.round((completedCalls / calls.length) * 100);
  };

  const calculateAverageDuration = () => {
    if (!calls.length) return 0;
    const totalDuration = calls
      .filter((call: any) => call.duration)
      .reduce((sum: number, call: any) => sum + call.duration, 0);
    return Math.round(totalDuration / calls.length);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Calls Analytics
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Track and analyze AI calling performance
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
              <Phone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalCalls || calls.length}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calculateSuccessRate()}%</div>
              <p className="text-xs text-muted-foreground">
                +5% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Duration</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatDuration(calculateAverageDuration())}</div>
              <p className="text-xs text-muted-foreground">
                -30s from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contact Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">78%</div>
              <p className="text-xs text-muted-foreground">
                +8% from last month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Calls */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Calls</CardTitle>
            <CardDescription>
              Latest AI calling sessions and their outcomes
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calls.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Calls Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Start your first AI calling campaign to see analytics here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {calls.slice(0, 10).map((call: any) => (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center space-x-4">
                      <div>
                        <p className="font-medium">{call.phoneNumber}</p>
                        <p className="text-sm text-gray-500">
                          {call.contact?.name || 'Unknown Contact'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {call.campaign?.name || 'Unknown Campaign'}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(call.startTime).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {call.duration ? formatDuration(call.duration) : 'N/A'}
                        </p>
                        <p className="text-sm text-gray-500">Duration</p>
                      </div>

                      <Badge variant={getStatusColor(call.status)}>
                        {call.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Campaign Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
            <CardDescription>
              Success metrics by campaign
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Group calls by campaign and show stats */}
              {Object.entries(
                calls.reduce((acc: any, call: any) => {
                  const campaignName = call.campaign?.name || 'Unknown Campaign';
                  if (!acc[campaignName]) {
                    acc[campaignName] = {
                      total: 0,
                      completed: 0,
                      totalDuration: 0,
                    };
                  }
                  acc[campaignName].total += 1;
                  if (call.status === 'completed') {
                    acc[campaignName].completed += 1;
                  }
                  if (call.duration) {
                    acc[campaignName].totalDuration += call.duration;
                  }
                  return acc;
                }, {})
              ).map(([campaignName, stats]: [string, any]) => (
                <div
                  key={campaignName}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <h3 className="font-medium">{campaignName}</h3>
                    <p className="text-sm text-gray-500">
                      {stats.total} calls • {Math.round((stats.completed / stats.total) * 100)}% success rate
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatDuration(Math.round(stats.totalDuration / stats.total))}
                    </p>
                    <p className="text-sm text-gray-500">Avg Duration</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}