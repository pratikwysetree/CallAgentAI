import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import type { DashboardStats } from "@shared/schema";

interface SidebarProps {
  stats?: DashboardStats;
}

export default function Sidebar({ stats }: SidebarProps) {
  const [location] = useLocation();
  
  // Fetch system status
  const { data: systemStatus } = useQuery<{
    database: string;
    twilio: string;
    openai: string;
    timestamp: string;
  }>({
    queryKey: ['/api/system/status'],
    refetchInterval: 30000,
  });

  const isActive = (path: string) => {
    if (path === '/' && location === '/') return true;
    if (path !== '/' && location.startsWith(path)) return true;
    return false;
  };

  return (
    <div className="w-64 bg-white shadow-lg border-r border-gray-200 flex flex-col">
      {/* Logo/Brand */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <i className="fas fa-phone text-white text-lg"></i>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">AI Agent</h1>
            <p className="text-sm text-gray-500">Calling Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        <Link href="/">
          <a className={`flex items-center space-x-3 px-4 py-3 rounded-lg font-medium transition-colors ${
            isActive('/') 
              ? 'bg-primary text-white' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}>
            <i className="fas fa-tachometer-alt w-5"></i>
            <span>Dashboard</span>
          </a>
        </Link>
        
        <div className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700">
          <i className="fas fa-phone-alt w-5"></i>
          <span>Active Calls ({stats?.activeCalls || 0})</span>
        </div>
        
        <div className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-700">
          <i className="fas fa-history w-5"></i>
          <span>Call History</span>
        </div>
        
        <Link href="/contacts">
          <a className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/contacts') 
              ? 'bg-primary text-white font-medium' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}>
            <i className="fas fa-database w-5"></i>
            <span>Contact Database</span>
          </a>
        </Link>
        
        <Link href="/campaigns">
          <a className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/campaigns') 
              ? 'bg-primary text-white font-medium' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}>
            <i className="fas fa-brain w-5"></i>
            <span>AI Configuration</span>
          </a>
        </Link>
        
        <Link href="/analytics">
          <a className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/analytics') 
              ? 'bg-primary text-white font-medium' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}>
            <i className="fas fa-chart-line w-5"></i>
            <span>Analytics</span>
          </a>
        </Link>
        
        <Link href="/settings">
          <a className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/settings') 
              ? 'bg-primary text-white font-medium' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}>
            <i className="fas fa-cog w-5"></i>
            <span>Settings</span>
          </a>
        </Link>
        
        <Link href="/enhanced-settings">
          <a className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
            isActive('/enhanced-settings') 
              ? 'bg-primary text-white font-medium' 
              : 'text-gray-700 hover:bg-gray-100'
          }`}>
            <i className="fas fa-sliders-h w-5"></i>
            <span>Advanced Settings</span>
          </a>
        </Link>
      </nav>

      {/* System Status */}
      <div className="p-4 border-t border-gray-200">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Twilio Status</span>
            <span className={`flex items-center ${systemStatus?.twilio === 'connected' ? 'text-success' : 'text-error'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${systemStatus?.twilio === 'connected' ? 'bg-success' : 'bg-error'}`}></div>
              {systemStatus?.twilio === 'connected' ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">OpenAI Status</span>
            <span className={`flex items-center ${systemStatus?.openai === 'active' ? 'text-success' : 'text-error'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${systemStatus?.openai === 'active' ? 'bg-success' : 'bg-error'}`}></div>
              {systemStatus?.openai === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Database</span>
            <span className={`flex items-center ${systemStatus?.database === 'online' ? 'text-success' : 'text-error'}`}>
              <div className={`w-2 h-2 rounded-full mr-2 ${systemStatus?.database === 'online' ? 'bg-success' : 'bg-error'}`}></div>
              {systemStatus?.database === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
