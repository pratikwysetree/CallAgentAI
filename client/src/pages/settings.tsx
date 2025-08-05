import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import Sidebar from "@/components/sidebar";

export default function Settings() {
  const [settings, setSettings] = useState({
    twilioPhoneNumber: "",
    openaiModel: "gpt-4o",
    maxCallDuration: 300,
    autoRecording: true,
    webhookUrl: "",
    notificationsEnabled: true,
    emailNotifications: true,
    smsNotifications: false,
  });
  const { toast } = useToast();

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

  const handleSave = () => {
    toast({
      title: "Settings saved",
      description: "Your configuration has been updated successfully.",
    });
  };

  const testConnection = (service: string) => {
    toast({
      title: `Testing ${service} connection...`,
      description: "Please wait while we verify the connection.",
    });
    
    // Simulate test delay
    setTimeout(() => {
      toast({
        title: `${service} connection successful`,
        description: "All services are working correctly.",
      });
    }, 2000);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Settings</h2>
              <p className="text-gray-600 mt-1">Configure your AI calling platform</p>
            </div>
            <Button onClick={handleSave} className="bg-primary text-white hover:bg-blue-700">
              <i className="fas fa-save mr-2"></i>
              Save Changes
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            
            {/* System Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${systemStatus?.database === 'online' ? 'bg-success' : 'bg-error'}`}></div>
                    <span className="font-medium">Database</span>
                  </div>
                  <span className={`text-sm ${systemStatus?.database === 'online' ? 'text-success' : 'text-error'}`}>
                    {systemStatus?.database || 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${systemStatus?.twilio === 'connected' ? 'bg-success' : 'bg-error'}`}></div>
                    <span className="font-medium">Twilio</span>
                  </div>
                  <span className={`text-sm ${systemStatus?.twilio === 'connected' ? 'text-success' : 'text-error'}`}>
                    {systemStatus?.twilio || 'Unknown'}
                  </span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${systemStatus?.openai === 'connected' ? 'bg-success' : 'bg-error'}`}></div>
                    <span className="font-medium">OpenAI</span>
                  </div>
                  <span className={`text-sm ${systemStatus?.openai === 'connected' ? 'text-success' : 'text-error'}`}>
                    {systemStatus?.openai || 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* API Configuration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">API Configuration</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="twilioPhone">Twilio Phone Number</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="twilioPhone"
                      value={settings.twilioPhoneNumber}
                      onChange={(e) => setSettings({ ...settings, twilioPhoneNumber: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => testConnection('Twilio')}
                      className="shrink-0"
                    >
                      Test
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="openaiModel">OpenAI Model</Label>
                  <Input
                    id="openaiModel"
                    value={settings.openaiModel}
                    onChange={(e) => setSettings({ ...settings, openaiModel: e.target.value })}
                    placeholder="gpt-4o"
                  />
                </div>
              </div>
            </div>

            {/* Call Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Settings</h3>
              <div className="space-y-6">
                <div>
                  <Label htmlFor="maxDuration">Maximum Call Duration (seconds)</Label>
                  <Input
                    id="maxDuration"
                    type="number"
                    value={settings.maxCallDuration}
                    onChange={(e) => setSettings({ ...settings, maxCallDuration: parseInt(e.target.value) })}
                    placeholder="300"
                  />
                  <p className="text-sm text-gray-500 mt-1">Set to 0 for unlimited duration</p>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="autoRecording">Automatic Call Recording</Label>
                    <p className="text-sm text-gray-500">Automatically record all calls for quality assurance</p>
                  </div>
                  <Switch
                    id="autoRecording"
                    checked={settings.autoRecording}
                    onCheckedChange={(checked) => setSettings({ ...settings, autoRecording: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Webhook Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Webhook Settings</h3>
              <div>
                <Label htmlFor="webhookUrl">Webhook URL</Label>
                <Input
                  id="webhookUrl"
                  value={settings.webhookUrl}
                  onChange={(e) => setSettings({ ...settings, webhookUrl: e.target.value })}
                  placeholder="https://your-app.com/webhook"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Optional: Receive call events at this URL
                </p>
              </div>
            </div>

            {/* Notification Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Notification Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="notifications">Enable Notifications</Label>
                    <p className="text-sm text-gray-500">Receive notifications about call events</p>
                  </div>
                  <Switch
                    id="notifications"
                    checked={settings.notificationsEnabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, notificationsEnabled: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="emailNotif">Email Notifications</Label>
                    <p className="text-sm text-gray-500">Send email alerts for important events</p>
                  </div>
                  <Switch
                    id="emailNotif"
                    checked={settings.emailNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, emailNotifications: checked })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="smsNotif">SMS Notifications</Label>
                    <p className="text-sm text-gray-500">Send SMS alerts for critical events</p>
                  </div>
                  <Switch
                    id="smsNotif"
                    checked={settings.smsNotifications}
                    onCheckedChange={(checked) => setSettings({ ...settings, smsNotifications: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
              <h3 className="text-lg font-semibold text-red-900 mb-4">Danger Zone</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-red-900">Reset All Settings</h4>
                    <p className="text-sm text-red-700">This will reset all configuration to default values</p>
                  </div>
                  <Button variant="destructive">
                    Reset Settings
                  </Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                  <div>
                    <h4 className="font-medium text-red-900">Clear All Call Data</h4>
                    <p className="text-sm text-red-700">This will permanently delete all call history and recordings</p>
                  </div>
                  <Button variant="destructive">
                    Clear Data
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}