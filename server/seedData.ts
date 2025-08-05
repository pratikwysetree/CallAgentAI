import { storage } from './storage';

export async function seedDatabase() {
  try {
    // Check if campaigns already exist
    const existingCampaigns = await storage.getCampaigns();
    if (existingCampaigns.length > 0) {
      console.log('Database already seeded');
      return;
    }

    // Create sample campaigns
    const campaign1 = await storage.createCampaign({
      name: "Customer Survey",
      description: "Collect customer feedback on our recent product launch",
      aiPrompt: `You are conducting a customer satisfaction survey. Your goal is to collect feedback about our recent product launch. Be friendly and conversational. Ask about:

1. Their experience with our product
2. What they liked most
3. Any issues they encountered
4. Their overall satisfaction rating (1-10)
5. Whether they would recommend us to others

Keep the conversation natural and don't make it feel like a formal survey. Listen to their responses and ask follow-up questions when appropriate. If they seem busy, offer to call back at a better time.`,
      isActive: true,
    });

    const campaign2 = await storage.createCampaign({
      name: "Lead Generation",
      description: "Identify potential customers for our services",
      aiPrompt: `You are a friendly sales representative calling to introduce our services. Your goal is to identify potential customers and collect contact information. Be conversational and helpful. Try to understand:

1. Their current business needs
2. Whether our services could help them
3. Their decision-making process
4. Best contact method for follow-up
5. Their budget range if appropriate

Don't be pushy or aggressive. Focus on understanding their needs and providing value. If they're not interested, thank them politely and end the call. If they show interest, offer to send more information or schedule a follow-up call.`,
      isActive: true,
    });

    const campaign3 = await storage.createCampaign({
      name: "Appointment Scheduling",
      description: "Schedule appointments for service consultations",
      aiPrompt: `You are calling to schedule service appointments. Be professional and efficient while remaining friendly. Your goal is to:

1. Confirm their interest in our services
2. Find a convenient appointment time
3. Collect necessary contact information
4. Explain what to expect during the appointment
5. Send confirmation details

Be flexible with scheduling and offer multiple time options. If they need to check their calendar, offer to call back or have them call us back. Make sure to get their preferred contact method for appointment reminders.`,
      isActive: true,
    });

    // Create sample contacts
    const contact1 = await storage.createContact({
      name: "John Smith",
      phoneNumber: "+1234567890",
      email: "john.smith@example.com",
      company: "Tech Solutions Inc",
      notes: "Interested in our services, prefers email contact"
    });

    const contact2 = await storage.createContact({
      name: "Sarah Johnson",
      phoneNumber: "+1987654321",
      email: "sarah.johnson@business.com",
      company: "Business Corp",
      notes: "Decision maker, available afternoons"
    });

    const contact3 = await storage.createContact({
      name: "Mike Davis",
      phoneNumber: "+1555666777",
      email: "mike.davis@startup.io",
      company: "Startup Innovations",
      notes: "Looking for cost-effective solutions"
    });

    console.log('Database seeded successfully with sample campaigns and contacts');
    console.log(`Created campaigns: ${campaign1.name}, ${campaign2.name}, ${campaign3.name}`);
    console.log(`Created contacts: ${contact1.name}, ${contact2.name}, ${contact3.name}`);

  } catch (error) {
    console.error('Error seeding database:', error);
  }
}