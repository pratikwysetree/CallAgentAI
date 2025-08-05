import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/dashboard";
import Contacts from "@/pages/contacts";
import Campaigns from "@/pages/campaigns";
import Analytics from "@/pages/analytics";
import Settings from "@/pages/settings";
import EnhancedSettings from "@/pages/enhanced-settings";
import WhatsAppBulk from "@/pages/whatsapp-bulk";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/contacts" component={Contacts} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/settings" component={Settings} />
      <Route path="/enhanced-settings" component={EnhancedSettings} />
      <Route path="/whatsapp-bulk" component={WhatsAppBulk} />
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
