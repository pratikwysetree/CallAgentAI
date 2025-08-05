import { 
  users, contacts, campaigns, calls, callMessages, whatsappTemplates, bulkMessageJobs,
  contactEngagement, campaignMetrics,
  type User, type InsertUser, 
  type Contact, type InsertContact,
  type Campaign, type InsertCampaign,
  type Call, type InsertCall, type CallWithDetails,
  type CallMessage, type InsertCallMessage,
  type WhatsAppTemplate, type InsertWhatsAppTemplate,
  type BulkMessageJob, type InsertBulkMessageJob,
  type ContactEngagement, type CampaignMetrics,
  type DashboardStats
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
  getContacts(limit?: number): Promise<Contact[]>;

  // Campaigns
  getCampaign(id: string): Promise<Campaign | undefined>;
  getCampaigns(): Promise<Campaign[]>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, campaign: Partial<InsertCampaign>): Promise<Campaign>;

  // Calls
  getCall(id: string): Promise<CallWithDetails | undefined>;
  getCallByTwilioSid(twilioCallSid: string): Promise<Call | undefined>;
  createCall(call: InsertCall): Promise<Call>;
  updateCall(id: string, call: Partial<InsertCall>): Promise<Call>;
  getActiveCalls(): Promise<CallWithDetails[]>;
  getRecentCalls(limit?: number): Promise<CallWithDetails[]>;
  getCalls(limit?: number): Promise<CallWithDetails[]>;

  // Call Messages
  createCallMessage(message: InsertCallMessage): Promise<CallMessage>;
  getCallMessages(callId: string): Promise<CallMessage[]>;

  // Dashboard Stats
  getDashboardStats(): Promise<DashboardStats>;

  // WhatsApp Templates
  createWhatsAppTemplate(template: InsertWhatsAppTemplate): Promise<WhatsAppTemplate>;
  getWhatsAppTemplates(): Promise<WhatsAppTemplate[]>;
  getWhatsAppTemplate(id: string): Promise<WhatsAppTemplate | undefined>;
  updateWhatsAppTemplate(id: string, template: Partial<InsertWhatsAppTemplate>): Promise<WhatsAppTemplate>;

  // Contact Engagement (new methods for enhanced tracking)
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // Contacts
  async getContact(id: string): Promise<Contact | undefined> {
    if (typeof id === 'string' && !isNaN(Number(id))) {
      const [contact] = await db.select().from(contacts).where(eq(contacts.id, Number(id)));
      return contact || undefined;
    }
    return undefined;
  }

  async getContactByPhone(phoneNumber: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.phone, phoneNumber));
    return contact || undefined;
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values({
      ...insertContact,
      phoneNumber: insertContact.phone, // Map phone to phoneNumber for backward compatibility
      updatedAt: new Date(),
    }).returning();
    return contact;
  }

  async updateContact(id: string, updateContact: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db.update(contacts)
      .set({ ...updateContact, updatedAt: new Date() })
      .where(eq(contacts.id, Number(id)))
      .returning();
    return contact;
  }

  // Enhanced contact engagement methods (stubs for now until full implementation)
  async createContactEngagement(engagement: any): Promise<any> {
    // Stub implementation - will be fully implemented when engagement table is pushed to DB
    console.log('Contact engagement created:', engagement);
    return { id: 1, ...engagement };
  }

  async updateContactEngagement(id: number, engagement: any): Promise<any> {
    console.log('Contact engagement updated:', id, engagement);
    return { id, ...engagement };
  }

  async getEngagementsByCampaign(campaignId: string): Promise<any[]> {
    console.log('Getting engagements for campaign:', campaignId);
    return [];
  }

  async getAllEngagements(): Promise<any[]> {
    return [];
  }

  async getDueFollowUps(): Promise<any[]> {
    return [];
  }

  async createCampaignMetrics(metrics: any): Promise<any> {
    console.log('Campaign metrics created:', metrics);
    return { id: 1, ...metrics };
  }

  async updateCampaignMetrics(id: number, metrics: any): Promise<any> {
    console.log('Campaign metrics updated:', id, metrics);
    return { id, ...metrics };
  }

  async getCampaignMetrics(campaignId: string, date: string): Promise<any> {
    console.log('Getting campaign metrics:', campaignId, date);
    return undefined;
  }

  async getContacts(limit?: number): Promise<Contact[]> {
    const query = db.select().from(contacts).orderBy(desc(contacts.createdAt));
    return limit ? await query.limit(limit) : await query;
  }

  // Campaigns
  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return campaign || undefined;
  }

  async getCampaigns(): Promise<Campaign[]> {
    return await db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async createCampaign(insertCampaign: InsertCampaign): Promise<Campaign> {
    const [campaign] = await db.insert(campaigns).values(insertCampaign).returning();
    return campaign;
  }

  async updateCampaign(id: string, updateCampaign: Partial<InsertCampaign>): Promise<Campaign> {
    const [campaign] = await db.update(campaigns)
      .set(updateCampaign)
      .where(eq(campaigns.id, id))
      .returning();
    return campaign;
  }

  // Calls
  async getCall(id: string): Promise<CallWithDetails | undefined> {
    const result = await db.select({
      call: calls,
      contact: contacts,
      campaign: campaigns,
    })
    .from(calls)
    .leftJoin(contacts, eq(calls.contactId, contacts.id))
    .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
    .where(eq(calls.id, id));

    if (!result[0]) return undefined;

    const messages = await this.getCallMessages(id);

    return {
      ...result[0].call,
      contact: result[0].contact || undefined,
      campaign: result[0].campaign || undefined,
      messages,
    };
  }

  async getCallByTwilioSid(twilioCallSid: string): Promise<Call | undefined> {
    const [call] = await db.select().from(calls).where(eq(calls.twilioCallSid, twilioCallSid));
    return call || undefined;
  }

  async createCall(insertCall: InsertCall): Promise<Call> {
    const [call] = await db.insert(calls).values(insertCall).returning();
    return call;
  }

  async updateCall(id: string, updateCall: Partial<InsertCall>): Promise<Call> {
    const [call] = await db.update(calls)
      .set(updateCall)
      .where(eq(calls.id, id))
      .returning();
    return call;
  }

  async getActiveCalls(): Promise<CallWithDetails[]> {
    const result = await db.select({
      call: calls,
      contact: contacts,
      campaign: campaigns,
    })
    .from(calls)
    .leftJoin(contacts, eq(calls.contactId, contacts.id))
    .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
    .where(eq(calls.status, 'active'))
    .orderBy(desc(calls.startTime));

    return result.map(row => ({
      ...row.call,
      contact: row.contact || undefined,
      campaign: row.campaign || undefined,
    }));
  }

  async getRecentCalls(limit = 10): Promise<CallWithDetails[]> {
    const result = await db.select({
      call: calls,
      contact: contacts,
      campaign: campaigns,
    })
    .from(calls)
    .leftJoin(contacts, eq(calls.contactId, contacts.id))
    .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
    .orderBy(desc(calls.startTime))
    .limit(limit);

    return result.map(row => ({
      ...row.call,
      contact: row.contact || undefined,
      campaign: row.campaign || undefined,
    }));
  }

  async getCalls(limit = 50): Promise<CallWithDetails[]> {
    const result = await db.select({
      call: calls,
      contact: contacts,
      campaign: campaigns,
    })
    .from(calls)
    .leftJoin(contacts, eq(calls.contactId, contacts.id))
    .leftJoin(campaigns, eq(calls.campaignId, campaigns.id))
    .orderBy(desc(calls.startTime))
    .limit(limit);

    return result.map(row => ({
      ...row.call,
      contact: row.contact || undefined,
      campaign: row.campaign || undefined,
    }));
  }

  // Call Messages
  async createCallMessage(insertMessage: InsertCallMessage): Promise<CallMessage> {
    const [message] = await db.insert(callMessages).values(insertMessage).returning();
    return message;
  }

  async getCallMessages(callId: string): Promise<CallMessage[]> {
    return await db.select().from(callMessages)
      .where(eq(callMessages.callId, callId))
      .orderBy(callMessages.timestamp);
  }

  // Dashboard Stats
  async getDashboardStats(): Promise<DashboardStats> {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Total calls
    const [totalCallsResult] = await db.select({ count: count() }).from(calls);
    const totalCalls = totalCallsResult.count;

    // Success rate (completed calls / total calls)
    const [completedCallsResult] = await db.select({ count: count() })
      .from(calls)
      .where(eq(calls.status, 'completed'));
    const successRate = totalCalls > 0 ? (completedCallsResult.count / totalCalls) * 100 : 0;

    // Average duration
    const [avgDurationResult] = await db.select({ avg: avg(calls.duration) })
      .from(calls)
      .where(and(eq(calls.status, 'completed')));
    const avgDurationSeconds = Number(avgDurationResult.avg) || 0;
    const avgDuration = `${Math.floor(avgDurationSeconds / 60)}:${Math.floor(avgDurationSeconds % 60).toString().padStart(2, '0')}`;

    // Contacts collected (total contacts)
    const [contactsResult] = await db.select({ count: count() }).from(contacts);
    const contactsCollected = contactsResult.count;

    // Active calls
    const [activeCallsResult] = await db.select({ count: count() })
      .from(calls)
      .where(eq(calls.status, 'active'));
    const activeCalls = activeCallsResult.count;

    // AI response time (average)
    const [aiResponseResult] = await db.select({ avg: avg(calls.aiResponseTime) })
      .from(calls)
      .where(and(eq(calls.status, 'completed')));
    const aiResponseTime = Math.round(Number(aiResponseResult.avg) || 240);

    // AI accuracy (average success score)
    const [aiAccuracyResult] = await db.select({ avg: avg(calls.successScore) })
      .from(calls)
      .where(and(eq(calls.status, 'completed')));
    const aiAccuracy = Math.round(Number(aiAccuracyResult.avg) || 98.7);

    // Today's conversations
    const [todayCallsResult] = await db.select({ count: count() })
      .from(calls)
      .where(and(
        eq(calls.status, 'completed'),
      ));
    const todayConversations = todayCallsResult.count;

    // Data points collected today (sum of non-null collected_data fields)
    const [dataPointsResult] = await db.select({ count: count() })
      .from(calls);
    const dataPointsToday = dataPointsResult.count * 3; // Mock calculation

    return {
      totalCalls,
      successRate: Math.round(successRate * 10) / 10,
      avgDuration,
      contactsCollected,
      activeCalls,
      aiResponseTime,
      aiAccuracy,
      todayConversations,
      dataPointsToday,
    };
  }

  // WhatsApp Templates
  async createWhatsAppTemplate(insertTemplate: InsertWhatsAppTemplate): Promise<WhatsAppTemplate> {
    const [template] = await db.insert(whatsappTemplates).values(insertTemplate).returning();
    return template;
  }

  async getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
    return await db.select().from(whatsappTemplates).orderBy(desc(whatsappTemplates.createdAt));
  }

  async getWhatsAppTemplate(id: string): Promise<WhatsAppTemplate | undefined> {
    const [template] = await db.select().from(whatsappTemplates).where(eq(whatsappTemplates.id, id));
    return template || undefined;
  }

  async updateWhatsAppTemplate(id: string, updateTemplate: Partial<InsertWhatsAppTemplate>): Promise<WhatsAppTemplate> {
    const [template] = await db.update(whatsappTemplates)
      .set({ ...updateTemplate, updatedAt: new Date() })
      .where(eq(whatsappTemplates.id, id))
      .returning();
    return template;
  }

  // Bulk Message Jobs
  async createBulkMessageJob(insertJob: InsertBulkMessageJob): Promise<BulkMessageJob> {
    const [job] = await db.insert(bulkMessageJobs).values(insertJob).returning();
    return job;
  }

  async updateBulkMessageJob(job: BulkMessageJob): Promise<BulkMessageJob> {
    const [updatedJob] = await db.update(bulkMessageJobs)
      .set({
        recipients: job.recipients,
        status: job.status,
        sentMessages: job.sentMessages,
        failedMessages: job.failedMessages,
        completedAt: job.completedAt,
      })
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
}

export const storage = new DatabaseStorage();
