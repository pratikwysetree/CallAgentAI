import { storage } from '../storage';

export class CampaignService {
  
  // Get today's campaign activities
  async getTodaysActivities(selectedDate: Date) {
    // Get messages from the selected date only
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get WhatsApp messages from the selected date
    const messages = await storage.getWhatsAppMessages(undefined, 100);
    const todaysMessages = messages.filter((msg: any) => {
      if (!msg.createdAt) return false;
      const msgDate = new Date(msg.createdAt);
      return msgDate >= startOfDay && msgDate <= endOfDay;
    });

    // Get contact details for each message
    const contactActivities = [];
    for (const message of todaysMessages) {
      let contact;
      try {
        contact = await storage.getContact(message.contactId);
      } catch (err) {
        continue; // Skip if contact doesn't exist
      }
      
      if (contact) {
        contactActivities.push({
          id: `activity_${message.id}`,
          contactId: message.contactId,
          contactName: contact.name,
          phone: contact.phone,
          email: contact.email || '',
          city: contact.city || '',
          company: contact.company || '',
          callStatus: 'pending' as const,
          messageStatus: message.status,
          messageTime: message.createdAt?.toISOString(),
          conversationSummary: message.message.substring(0, 100),
          nextAction: 'follow_up_call' as const,
          engagementScore: message.status === 'read' ? 80 : message.status === 'delivered' ? 60 : 40,
          status: 'active' as const
        });
      }
    }
    
    // Only create campaign if there are actual activities
    const campaigns = contactActivities.length > 0 ? [{
      id: "campaign_" + selectedDate.toISOString().split("T")[0],
      name: `Campaign - ${selectedDate.toLocaleDateString()}`,
      channel: "WHATSAPP" as const,
      startDate: selectedDate.toISOString(),
      totalContacts: contactActivities.length,
      completedContacts: contactActivities.filter(c => c.messageStatus !== "pending").length,
      successRate: contactActivities.length > 0 ? Math.round((contactActivities.filter(c => c.engagementScore > 70).length / contactActivities.length) * 100) : 0,
      status: "active" as const,
      contacts: contactActivities
    }] : [];

    return campaigns;
  }

  // Get campaign analytics
  async getAnalytics() {
    return await storage.getCampaignAnalytics();
  }

  // Get follow-ups
  async getFollowUps() {
    return await storage.getFollowUps();
  }

  // Start campaign
  async startCampaign(campaignId: string, contactIds: string[], whatsappOnly: boolean, messageDelay?: number) {
    return await storage.startCampaign(campaignId, contactIds, whatsappOnly, messageDelay);
  }

  // Get day-wise analytics
  async getDayWiseAnalytics() {
    return await storage.getDayWiseAnalytics();
  }

  // Get total analytics
  async getTotalAnalytics() {
    return await storage.getTotalAnalytics();
  }
}