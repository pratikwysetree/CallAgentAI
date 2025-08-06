import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import Sidebar from "@/components/sidebar";
import ActiveCalls from "@/components/active-calls";
import QuickCall from "@/components/quick-call";
import CallHistory from "@/components/call-history";
import CallDetailModal from "@/components/call-detail-modal";

import { useState } from "react";
import type { CallWithDetails, DashboardStats } from "@shared/schema";

export default function Dashboard() {
  const [selectedCall, setSelectedCall] = useState<CallWithDetails | null>(null);
  const { lastMessage } = useWebSocket();

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Fetch active calls
  const { data: activeCalls = [], isLoading: activeCallsLoading } = useQuery<CallWithDetails[]>({
    queryKey: ['/api/calls/active'],
    refetchInterval: 5000, // Refetch every 5 seconds
  });

  // Fetch recent calls
  const { data: recentCalls = [], isLoading: recentCallsLoading } = useQuery<CallWithDetails[]>({
    queryKey: ['/api/calls/recent'],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Handle WebSocket updates
  useEffect(() => {
    if (lastMessage) {
      switch (lastMessage.type) {
        case 'call_initiated':
        case 'call_ended':
        case 'call_status_update':
          // Invalidate active calls and stats
          queryClient.invalidateQueries({ queryKey: ['/api/calls/active'] });
          queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
          break;
        case 'conversation_update':
          // Invalidate specific call data if needed
          break;
      }
    }
  }, [lastMessage]);

  const handleNewCall = () => {
    // This will be handled by the QuickCall component
    console.log('New call initiated');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Dashboard</h2>
              <p className="text-gray-600 mt-1">Manage your AI calling operations</p>
            </div>
            <div className="flex items-center space-x-4">
              <button 
                onClick={handleNewCall}
                className="bg-primary text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <i className="fas fa-plus"></i>
                <span>New Call</span>
              </button>
              <div className="flex items-center space-x-2 text-gray-600">
                <i className="fas fa-user-circle text-2xl"></i>
                <span>Admin User</span>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-phone text-primary text-xl"></i>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {statsLoading ? '...' : stats?.totalCalls?.toLocaleString() || '0'}
                  </h3>
                  <p className="text-gray-600">Total Calls</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-success/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-check-circle text-success text-xl"></i>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {statsLoading ? '...' : `${stats?.successRate || 0}%`}
                  </h3>
                  <p className="text-gray-600">Success Rate</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-warning/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-clock text-warning text-xl"></i>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {statsLoading ? '...' : stats?.avgDuration || '0:00'}
                  </h3>
                  <p className="text-gray-600">Avg Duration</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-database text-secondary text-xl"></i>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {statsLoading ? '...' : stats?.contactsCollected?.toLocaleString() || '0'}
                  </h3>
                  <p className="text-gray-600">Contacts Collected</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Active Calls Panel */}
            <div className="lg:col-span-2">
              <ActiveCalls 
                calls={activeCalls} 
                isLoading={activeCallsLoading}
                onCallSelect={setSelectedCall}
              />
            </div>

            {/* Reserved Space */}
            <div className="space-y-4">
              {/* Direct Audio and Live Script removed per user request */}
            </div>

            {/* Quick Actions & AI Status */}
            <div className="space-y-6">
              <QuickCall />
              
              {/* AI Performance */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Performance</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Response Time</span>
                    <span className="font-medium text-gray-900">
                      {statsLoading ? '...' : `${stats?.aiResponseTime || 240}ms`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Accuracy Score</span>
                    <span className="font-medium text-success">
                      {statsLoading ? '...' : `${stats?.aiAccuracy || 98.7}%`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Conversations Today</span>
                    <span className="font-medium text-gray-900">
                      {statsLoading ? '...' : stats?.todayConversations || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Data Points Collected</span>
                    <span className="font-medium text-gray-900">
                      {statsLoading ? '...' : stats?.dataPointsToday || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Call History */}
          <div className="mt-8">
            <CallHistory 
              calls={recentCalls} 
              isLoading={recentCallsLoading}
              onCallSelect={setSelectedCall}
            />
          </div>
        </main>
      </div>

      {/* Call Detail Modal */}
      {selectedCall && (
        <CallDetailModal 
          call={selectedCall} 
          onClose={() => setSelectedCall(null)}
        />
      )}
    </div>
  );
}
