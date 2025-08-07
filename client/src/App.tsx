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

function Navigation() {
  const [location] = useLocation();

  const navigation = [
    {
      name: "Dashboard",
      href: "/campaign-dashboard",
      icon: Home,
      current: location === "/campaign-dashboard" || location === "/",
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
      name: "Settings",
      href: "/settings",
      icon: SettingsIcon,
      current: location === "/settings",
    },
  ];



  return (
    <nav className="nav-palette shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <PhoneCall className="h-8 w-8 palette-primary-text" />
              <span className="ml-2 text-xl font-bold palette-text">
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
                    className={`nav-palette-item ${
                      item.current ? "active" : ""
                    } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </Link>
                );
              })}
              
              {/* WhatsApp Navigation - Simple Links */}
              <Link
                href="/whatsapp-bulk"
                className={`nav-palette-item ${
                  location === "/whatsapp-bulk" ? "active" : ""
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                <Send className="h-4 w-4 mr-2" />
                WhatsApp Bulk
              </Link>
              
              <Link
                href="/whatsapp-chats"
                className={`nav-palette-item ${
                  location === "/whatsapp-chats" ? "active" : ""
                } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                WhatsApp Chat
              </Link>
            </div>
          </div>
          
          <div className="flex items-center">
            <ColorPaletteSwitcher />
          </div>
        </div>
      </div>
    </nav>
  );
}

function Router() {
  return (
    <div className="min-h-screen palette-background">
      <Navigation />
      <main>
        <Switch>
          <Route path="/" component={CampaignDashboard} />
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
