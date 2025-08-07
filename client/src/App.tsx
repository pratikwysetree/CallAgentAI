import React from "react";
import { Switch, Route, Link, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { ColorPaletteSwitcher } from "@/components/ColorPaletteSwitcher";
import { MessageSquare, Settings as SettingsIcon, Users, BarChart3, Phone, PhoneCall, Megaphone, Send, MessageCircle, Home } from "lucide-react";
import "@/styles/palette-vars.css";
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

function Navigation({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navigation = [
    {
      name: "Contact Campaigns",
      href: "/contact-campaigns",
      icon: Users,
      current: location === "/contact-campaigns" || location === "/",
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
      name: "Dashboard",
      href: "/campaign-dashboard",
      icon: Home,
      current: location === "/campaign-dashboard",
    },
    {
      name: "Settings",
      href: "/settings",
      icon: SettingsIcon,
      current: location === "/settings",
    },
  ];



  return (
    <div className="flex h-screen palette-background">
      {/* Left Sidebar */}
      <div className="flex flex-col w-64 nav-palette border-r">
        {/* Logo/Header */}
        <div className="flex items-center h-16 px-4 border-b">
          <PhoneCall className="h-8 w-8 palette-primary-text" />
          <span className="ml-2 text-xl font-bold palette-text">
            LabsCheck AI
          </span>
        </div>
        
        {/* Navigation Menu */}
        <nav className="flex-1 px-4 py-4 space-y-2">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <span
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    item.current
                      ? "palette-primary text-white"
                      : "palette-text-secondary hover:palette-text hover:palette-surface"
                  }`}
                >
                  <Icon className="mr-3 h-5 w-5" />
                  {item.name}
                </span>
              </Link>
            );
          })}
          
          {/* WhatsApp Navigation */}
          <Link href="/whatsapp-bulk">
            <span
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                location === "/whatsapp-bulk"
                  ? "palette-primary text-white"
                  : "palette-text-secondary hover:palette-text hover:palette-surface"
              }`}
            >
              <Send className="mr-3 h-5 w-5" />
              WhatsApp Bulk
            </span>
          </Link>
          
          <Link href="/whatsapp-chats">
            <span
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                location === "/whatsapp-chats"
                  ? "palette-primary text-white"
                  : "palette-text-secondary hover:palette-text hover:palette-surface"
              }`}
            >
              <MessageCircle className="mr-3 h-5 w-5" />
              WhatsApp Chat
            </span>
          </Link>
        </nav>
        
        {/* Color Palette Switcher at bottom */}
        <div className="px-4 py-4 border-t">
          <div className="flex items-center justify-between">
            <span className="text-sm palette-text-secondary">Theme</span>
            <ColorPaletteSwitcher />
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Navigation>
      <Switch>
        <Route path="/" component={ContactCampaigns} />
        <Route path="/campaign-dashboard" component={CampaignDashboard} />
        <Route path="/whatsapp-bulk" component={WhatsAppBulk} />
        <Route path="/live-calls" component={LiveCallsPage} />
        <Route path="/calls-analytics" component={CallsAnalytics} />
        <Route path="/campaign-manager" component={CampaignManager} />
        <Route path="/contact-campaigns" component={ContactCampaigns} />
        <Route path="/whatsapp-chats" component={WhatsAppChats} />
        <Route path="/whatsapp-messaging" component={WhatsAppMessaging} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/enhanced-settings" component={EnhancedSettings} />
        <Route component={NotFound} />
      </Switch>
    </Navigation>
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
