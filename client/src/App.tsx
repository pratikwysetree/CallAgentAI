import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { MessageSquare, Settings as SettingsIcon, Users, BarChart3, Phone, PhoneCall, Megaphone } from "lucide-react";
import ContactCampaigns from "@/pages/contact-campaigns";
import CampaignDashboard from "@/pages/campaign-dashboard";
import CampaignManager from "@/pages/campaign-manager";
import SettingsPage from "@/pages/settings";
import EnhancedSettings from "@/pages/enhanced-settings";
import WhatsAppBulk from "@/pages/whatsapp-bulk";
import WhatsAppChats from "@/pages/whatsapp-chats";
import WhatsAppMessaging from "@/pages/whatsapp-messaging";
import LiveCallsPage from "@/pages/live-calls";
import CallsAnalytics from "@/pages/calls-analytics";
import NotFound from "@/pages/not-found";

function Navigation() {
  const [location] = useLocation();

  const navigation = [
    {
      name: "WhatsApp Bulk",
      href: "/whatsapp-bulk",
      icon: MessageSquare,
      current: location === "/whatsapp-bulk" || location === "/",
    },
    {
      name: "Live Calls",
      href: "/live-calls",
      icon: Phone,
      current: location === "/live-calls",
    },
    {
      name: "Call Analytics",
      href: "/calls-analytics",
      icon: BarChart3,
      current: location === "/calls-analytics",
    },
    {
      name: "Campaign Manager",
      href: "/campaign-manager",
      icon: Megaphone,
      current: location === "/campaign-manager",
    },
    {
      name: "Contact Campaigns",
      href: "/contact-campaigns",
      icon: Users,
      current: location === "/contact-campaigns",
    },
    {
      name: "Campaign Dashboard",
      href: "/campaign-dashboard",
      icon: BarChart3,
      current: location === "/campaign-dashboard",
    },
    {
      name: "WhatsApp Chats",
      href: "/whatsapp-chats",
      icon: MessageSquare,
      current: location === "/whatsapp-chats",
    },
    {
      name: "WhatsApp Messaging",
      href: "/whatsapp-messaging",
      icon: MessageSquare,
      current: location === "/whatsapp-messaging",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: SettingsIcon,
      current: location === "/settings",
    },
  ];

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <PhoneCall className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                LabsCheck AI
              </span>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`${
                      item.current
                        ? "border-blue-500 text-gray-900 dark:text-white"
                        : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white hover:border-gray-300"
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      <main>
        <Switch>
          <Route path="/" component={WhatsAppBulk} />
          <Route path="/whatsapp-bulk" component={WhatsAppBulk} />
          <Route path="/live-calls" component={LiveCallsPage} />
          <Route path="/calls-analytics" component={CallsAnalytics} />
          <Route path="/campaign-manager" component={CampaignManager} />
          <Route path="/contact-campaigns" component={ContactCampaigns} />
          <Route path="/campaign-dashboard" component={CampaignDashboard} />
          <Route path="/whatsapp-chats" component={WhatsAppChats} />
          <Route path="/whatsapp-messaging" component={WhatsAppMessaging} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/enhanced-settings" component={EnhancedSettings} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
