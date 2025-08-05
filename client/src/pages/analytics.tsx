import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { DashboardStats, CallWithDetails } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState("7d");

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000,
  });

  // Fetch all calls for analytics
  const { data: calls = [], isLoading: callsLoading } = useQuery<CallWithDetails[]>({
    queryKey: ['/api/calls'],
    refetchInterval: 60000,
  });

  const getCallsByStatus = () => {
    const statusCounts = calls.reduce((acc, call) => {
      acc[call.status] = (acc[call.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return statusCounts;
  };

  const getAverageCallDuration = () => {
    const completedCalls = calls.filter(call => call.status === 'completed' && call.duration);
    if (completedCalls.length === 0) return 0;
    const totalDuration = completedCalls.reduce((sum, call) => sum + (call.duration || 0), 0);
    return Math.round(totalDuration / completedCalls.length);
  };

  const getSuccessRate = () => {
    if (calls.length === 0) return 0;
    const completedCalls = calls.filter(call => call.status === 'completed').length;
    return Math.round((completedCalls / calls.length) * 100);
  };

  const getCallsOverTime = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const callsOnDate = calls.filter(call => 
        new Date(call.startTime || call.endTime || new Date()).toISOString().split('T')[0] === date
      ).length;
      return { date, calls: callsOnDate };
    });
  };

  const statusCounts = getCallsByStatus();
  const avgDuration = getAverageCallDuration();
  const successRate = getSuccessRate();
  const callsOverTime = getCallsOverTime();

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar stats={stats} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Analytics</h2>
              <p className="text-gray-600 mt-1">Track your calling performance and AI metrics</p>
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">Last Day</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {/* Key Metrics */}
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
                  <h3 className="text-2xl font-semibold text-gray-900">{successRate}%</h3>
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
                  <h3 className="text-2xl font-semibold text-gray-900">{avgDuration}s</h3>
                  <p className="text-gray-600">Avg Duration</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-info/10 rounded-lg flex items-center justify-center">
                    <i className="fas fa-robot text-info text-xl"></i>
                  </div>
                </div>
                <div className="ml-4">
                  <h3 className="text-2xl font-semibold text-gray-900">
                    {statsLoading ? '...' : Math.round(stats?.aiResponseTime || 0)}ms
                  </h3>
                  <p className="text-gray-600">AI Response Time</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Call Status Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Status Distribution</h3>
              {callsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex justify-between items-center">
                      <div className="h-4 bg-gray-300 rounded w-24"></div>
                      <div className="h-4 bg-gray-300 rounded w-16"></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          status === 'completed' ? 'bg-success' :
                          status === 'failed' ? 'bg-error' :
                          status === 'active' ? 'bg-primary' : 'bg-gray-400'
                        }`}></div>
                        <span className="text-gray-700 capitalize">{status}</span>
                      </div>
                      <span className="font-semibold text-gray-900">{count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
              {callsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                      <div className="flex-1">
                        <div className="h-4 bg-gray-300 rounded mb-1"></div>
                        <div className="h-3 bg-gray-300 rounded w-3/4"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <div className="text-center py-8">
                  <i className="fas fa-chart-line text-gray-400 text-3xl mb-3"></i>
                  <p className="text-gray-600">No call activity yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {calls.slice(0, 5).map((call) => (
                    <div key={call.id} className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        call.status === 'completed' ? 'bg-success/10' :
                        call.status === 'failed' ? 'bg-error/10' :
                        call.status === 'active' ? 'bg-primary/10' : 'bg-gray-100'
                      }`}>
                        <i className={`fas ${
                          call.status === 'completed' ? 'fa-check text-success' :
                          call.status === 'failed' ? 'fa-times text-error' :
                          call.status === 'active' ? 'fa-phone text-primary' : 'fa-question text-gray-400'
                        } text-sm`}></i>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          Call to {call.phoneNumber}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(call.startTime || call.endTime || new Date()).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Calls Over Time Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Calls Over Time (Last 7 Days)</h3>
            {callsLoading ? (
              <div className="animate-pulse h-64 bg-gray-200 rounded"></div>
            ) : (
              <div className="h-64 flex items-end justify-between space-x-2 border-b border-gray-200">
                {callsOverTime.map((day, index) => (
                  <div key={day.date} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-primary rounded-t min-h-[4px]"
                      style={{
                        height: `${Math.max(4, (day.calls / Math.max(...callsOverTime.map(d => d.calls), 1)) * 200)}px`
                      }}
                    ></div>
                    <div className="mt-2 text-xs text-gray-600 text-center">
                      <div className="font-medium">{day.calls}</div>
                      <div>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}