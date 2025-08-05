import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import ContactCampaigns from "@/pages/contact-campaigns";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import EnhancedSettings from "@/pages/enhanced-settings";
import ElevenLabsSetup from "@/pages/elevenlabs-setup";
import WhatsAppBulk from "@/pages/whatsapp-bulk";
import WhatsAppChats from "@/pages/whatsapp-chats";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/contact-campaigns" component={ContactCampaigns} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/enhanced-settings" component={EnhancedSettings} />
      <Route path="/elevenlabs-setup" component={ElevenLabsSetup} />
      <Route path="/whatsapp-bulk" component={WhatsAppBulk} />
      <Route path="/whatsapp-chats" component={WhatsAppChats} />
      <Route component={NotFound} />
    </Switch>
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
