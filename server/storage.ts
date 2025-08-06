import { 
  users, contacts, campaigns, calls, callMessages, whatsappTemplates, bulkMessageJobs,
  contactEngagement, campaignMetrics,
  type User, type InsertUser, 
  type Contact, type InsertContact,
  type Campaign, type InsertCampaign,
  type Call, type InsertCall,
  type CallMessage, type InsertCallMessage,
  type WhatsAppTemplate, type InsertWhatsAppTemplate,
  type BulkMessageJob, type InsertBulkMessageJob,
  type ContactEngagement, type CampaignMetrics,
  type DashboardStats, type CallWithDetails
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, avg, sum } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Contacts
  getContact(id: string): Promise<Contact | undefined>;
  getContactByPhone(phoneNumber: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact>;
  deleteContact(id: string): Promise<boolean>;
  getContacts(limit?: number): Promise<Contact[]>;

  // Campaigns
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign>;
  deleteCampaign(id: string): Promise<boolean>;

  // Calls
  createCall(call: InsertCall): Promise<Call>;
  getCall(id: string): Promise<Call | undefined>;
  getCalls(limit?: number): Promise<CallWithDetails[]>;
  updateCall(id: string, call: Partial<InsertCall>): Promise<Call>;
  deleteCall(id: string): Promise<boolean>;
  getCallsByCampaign(campaignId: string): Promise<Call[]>;
  getCallsByContact(contactId: string): Promise<Call[]>;
  getActiveCalls(): Promise<Call[]>;

  // Call Messages
  createCallMessage(message: InsertCallMessage): Promise<CallMessage>;
  getCallMessages(callId: string): Promise<CallMessage[]>;
  deleteCallMessage(id: string): Promise<boolean>;

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;

  // WhatsApp Templates
  createWhatsAppTemplate(template: InsertWhatsAppTemplate): Promise<WhatsAppTemplate>;
  getWhatsAppTemplates(): Promise<WhatsAppTemplate[]>;
  getWhatsAppTemplate(id: string): Promise<WhatsAppTemplate | undefined>;
  updateWhatsAppTemplate(id: string, template: Partial<InsertWhatsAppTemplate>): Promise<WhatsAppTemplate>;
  deleteWhatsAppTemplate(id: string): Promise<boolean>;

  // Contact Engagement (enhanced tracking)
  createContactEngagement(engagement: any): Promise<ContactEngagement>;
  updateContactEngagement(id: number, engagement: any): Promise<ContactEngagement>;
  getEngagementsByCampaign(campaignId: string): Promise<ContactEngagement[]>;
  getAllEngagements(): Promise<ContactEngagement[]>;
  getDueFollowUps(): Promise<ContactEngagement[]>;

  // Campaign Metrics
  createCampaignMetrics(metrics: any): Promise<CampaignMetrics>;
  updateCampaignMetrics(id: number, metrics: any): Promise<CampaignMetrics>;
  getCampaignMetrics(campaignId: string, date: string): Promise<CampaignMetrics | undefined>;

  // Bulk Message Jobs
  createBulkMessageJob(job: InsertBulkMessageJob): Promise<BulkMessageJob>;
  updateBulkMessageJob(job: BulkMessageJob): Promise<BulkMessageJob>;
  getBulkMessageJob(id: string): Promise<BulkMessageJob | undefined>;
  getBulkMessageJobs(): Promise<BulkMessageJob[]>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  // Contacts
  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact || undefined;
  }

  async getContactByPhone(phoneNumber: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.phone, phoneNumber));
    return contact || undefined;
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const [newContact] = await db.insert(contacts).values(contact).returning();
    return newContact;
  }

  async updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact> {
    const [updatedContact] = await db
      .update(contacts)
      .set({ ...contact, updatedAt: new Date() })
      .where(eq(contacts.id, id))
      .returning();
    return updatedContact;
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return result.rowCount > 0;
  }

  async getContacts(limit = 1000): Promise<Contact[]> {
    return await db.select().from(contacts).orderBy(desc(contacts.createdAt)).limit(limit);
  }

  // Campaigns
  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const [newCampaign] = await db.insert(campaigns).values(campaign).returning();
    return newCampaign;
  }

  async updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign> {
    const [updatedCampaign] = await db
      .update(campaigns)
      .set(campaign)
      .where(eq(campaigns.id, id))
      .returning();
    return updatedCampaign;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    // Delete associated engagement and metrics first
    await db.delete(contactEngagement).where(eq(contactEngagement.campaignId, id));
    await db.delete(campaignMetrics).where(eq(campaignMetrics.campaignId, id));
    
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return result.rowCount > 0;
  }

  // WhatsApp Templates
  async createWhatsAppTemplate(template: InsertWhatsAppTemplate): Promise<WhatsAppTemplate> {
    const [newTemplate] = await db.insert(whatsappTemplates).values(template).returning();
    return newTemplate;
  }

  async getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
    return await db.select().from(whatsappTemplates).orderBy(desc(whatsappTemplates.createdAt));
  }

  async getWhatsAppTemplate(id: string): Promise<WhatsAppTemplate | undefined> {
    const [template] = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.id, id));
    return template || undefined;
  }

  async updateWhatsAppTemplate(id: string, template: Partial<InsertWhatsAppTemplate>): Promise<WhatsAppTemplate> {
    const [updatedTemplate] = await db
      .update(whatsappTemplates)
      .set(template)
      .where(eq(whatsappTemplates.id, id))
      .returning();
    return updatedTemplate;
  }

  async deleteWhatsAppTemplate(id: string): Promise<boolean> {
    const result = await db.delete(whatsappTemplates).where(eq(whatsappTemplates.id, id));
    return result.rowCount > 0;
  }

  // Contact Engagement
  async createContactEngagement(engagement: any): Promise<ContactEngagement> {
    const [newEngagement] = await db.insert(contactEngagement).values(engagement).returning();
    return newEngagement;
  }

  async updateContactEngagement(id: number, engagement: any): Promise<ContactEngagement> {
    const [updatedEngagement] = await db
      .update(contactEngagement)
      .set({ ...engagement, updatedAt: new Date() })
      .where(eq(contactEngagement.id, id))
      .returning();
    return updatedEngagement;
  }

  async getEngagementsByCampaign(campaignId: string): Promise<ContactEngagement[]> {
    return await db.select().from(contactEngagement).where(eq(contactEngagement.campaignId, campaignId));
  }

  async getAllEngagements(): Promise<ContactEngagement[]> {
    return await db.select().from(contactEngagement).orderBy(desc(contactEngagement.createdAt));
  }

  async getDueFollowUps(): Promise<ContactEngagement[]> {
    const now = new Date();
    return await db.select().from(contactEngagement)
      .where(and(
        eq(contactEngagement.status, 'active')
      ))
      .orderBy(contactEngagement.nextFollowUp);
  }

  // Campaign Metrics
  async createCampaignMetrics(metrics: any): Promise<CampaignMetrics> {
    const [newMetrics] = await db.insert(campaignMetrics).values(metrics).returning();
    return newMetrics;
  }

  async updateCampaignMetrics(id: number, metrics: any): Promise<CampaignMetrics> {
    const [updatedMetrics] = await db
      .update(campaignMetrics)
      .set(metrics)
      .where(eq(campaignMetrics.id, id))
      .returning();
    return updatedMetrics;
  }

  async getCampaignMetrics(campaignId: string, date: string): Promise<CampaignMetrics | undefined> {
    const [metrics] = await db.select().from(campaignMetrics)
      .where(and(
        eq(campaignMetrics.campaignId, campaignId),
        eq(campaignMetrics.date, date)
      ));
    return metrics || undefined;
  }

  // Bulk Message Jobs
  async createBulkMessageJob(job: InsertBulkMessageJob): Promise<BulkMessageJob> {
    const [newJob] = await db.insert(bulkMessageJobs).values(job).returning();
    return newJob;
  }

  async updateBulkMessageJob(job: BulkMessageJob): Promise<BulkMessageJob> {
    const [updatedJob] = await db
      .update(bulkMessageJobs)
      .set(job)
      .where(eq(bulkMessageJobs.id, job.id))
      .returning();
    return updatedJob;
  }

  async getBulkMessageJob(id: string): Promise<BulkMessageJob | undefined> {
    const [job] = await db.select().from(bulkMessageJobs).where(eq(bulkMessageJobs.id, id));
    return job || undefined;
  }

  async getBulkMessageJobs(): Promise<BulkMessageJob[]> {
    return await db.select().from(bulkMessageJobs).orderBy(desc(bulkMessageJobs.createdAt));
  }

  // Calls
  async createCall(call: InsertCall): Promise<Call> {
    const [newCall] = await db.insert(calls).values(call).returning();
    return newCall;
  }

  async getCall(id: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.id, id));
    return call || undefined;
  }

  async getCalls(limit?: number): Promise<CallWithDetails[]> {
    const query = db
      .select({
        call: calls,
        contact: contacts,
        campaign: campaigns,
      })
      .from(calls)
      .leftJoin(contacts, eq(calls.contactId, contacts.id))
      .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
      .orderBy(desc(calls.startTime));

    if (limit) {
      query.limit(limit);
    }

    const results = await query;
    return results.map(result => ({
      ...result.call,
      contact: result.contact || undefined,
      campaign: result.campaign || undefined,
    }));
  }

  async updateCall(id: string, call: Partial<InsertCall>): Promise<Call> {
    const [updatedCall] = await db
      .update(calls)
      .set(call)
      .where(eq(calls.id, id))
      .returning();
    return updatedCall;
  }

  async deleteCall(id: string): Promise<boolean> {
    const result = await db.delete(calls).where(eq(calls.id, id));
    return result.rowCount > 0;
  }

  async getCallsByCampaign(campaignId: string): Promise<Call[]> {
    return await db.select().from(calls).where(eq(calls.campaignId, campaignId));
  }

  async getCallsByContact(contactId: string): Promise<Call[]> {
    return await db.select().from(calls).where(eq(calls.contactId, contactId));
  }

  async getActiveCalls(): Promise<Call[]> {
    return await db.select().from(calls).where(eq(calls.status, 'active'));
  }

  // Call Messages
  async createCallMessage(message: InsertCallMessage): Promise<CallMessage> {
    const [newMessage] = await db.insert(callMessages).values(message).returning();
    return newMessage;
  }

  async getCallMessages(callId: string): Promise<CallMessage[]> {
    return await db
      .select()
      .from(callMessages)
      .where(eq(callMessages.callId, callId))
      .orderBy(desc(callMessages.timestamp));
  }

  async deleteCallMessage(id: string): Promise<boolean> {
    const result = await db.delete(callMessages).where(eq(callMessages.id, id));
    return result.rowCount > 0;
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const [contactCount] = await db.select({ count: count() }).from(contacts);
    const [campaignCount] = await db.select({ count: count() }).from(campaigns);
    const [callCount] = await db.select({ count: count() }).from(calls);
    const [activeCallCount] = await db.select({ count: count() }).from(calls).where(eq(calls.status, 'active'));
    const [jobCount] = await db.select({ totalSent: sum(bulkMessageJobs.sentMessages) }).from(bulkMessageJobs);
    const [completedCalls] = await db.select({ count: count() }).from(calls).where(eq(calls.status, 'completed'));
    
    return {
      totalContacts: contactCount.count || 0,
      totalCampaigns: campaignCount.count || 0,
      totalCalls: callCount.count || 0,
      activeCalls: activeCallCount.count || 0,
      totalMessages: jobCount.totalSent || 0,
      deliveryRate: 95, // Calculate from actual delivery data
      engagementRate: 12, // Calculate from engagement data
      averageResponseTime: 24, // Calculate from response times
      successRate: completedCalls.count && callCount.count 
        ? Math.round((completedCalls.count / callCount.count) * 100)
        : 0,
    };
  }
}

export const storage = new DatabaseStorage();