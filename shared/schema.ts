import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb, serial, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(), // Changed from phoneNumber to phone for consistency
  email: text("email"),
  city: text("city"),
  state: text("state"),
  whatsappNumber: text("whatsapp_number"),
  company: text("company"),
  notes: text("notes"),
  importedFrom: text("imported_from"), // Track if imported from Excel
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  aiPrompt: text("ai_prompt").notNull(),
  script: text("script"), // Agent script
  openaiModel: text("openai_model").default("gpt-4o").notNull(),
  voiceConfig: jsonb("voice_config"), // Open source voice configuration
  transcriberConfig: jsonb("transcriber_config"), // Open source transcriber configuration
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const calls = pgTable("calls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactId: varchar("contact_id").references(() => contacts.id),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  phoneNumber: text("phone_number").notNull(),
  status: text("status").notNull(), // 'active', 'completed', 'failed', 'abandoned'
  duration: integer("duration"), // in seconds
  startTime: timestamp("start_time").defaultNow().notNull(),
  endTime: timestamp("end_time"),
  twilioCallSid: text("twilio_call_sid"),
  recordingUrl: text("recording_url"),
  conversationSummary: text("conversation_summary"),
  extractedWhatsapp: text("extracted_whatsapp"), // WhatsApp number extracted from call
  extractedEmail: text("extracted_email"), // Email extracted from call
  whatsappSent: boolean("whatsapp_sent").default(false),
  emailSent: boolean("email_sent").default(false),
  collectedData: jsonb("collected_data"),
  aiResponseTime: integer("ai_response_time"), // in milliseconds
  successScore: integer("success_score"), // 1-100
});

export const callMessages = pgTable("call_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  callId: varchar("call_id").references(() => calls.id),
  role: text("role").notNull(), // 'user', 'assistant'
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const whatsappTemplates = pgTable("whatsapp_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: text("category").notNull(), // 'AUTHENTICATION', 'MARKETING', 'UTILITY'
  language: text("language").notNull(),
  status: text("status").notNull(), // 'PENDING', 'APPROVED', 'REJECTED'
  components: jsonb("components").notNull(),
  metaTemplateId: text("meta_template_id"), // Meta's template ID
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bulkMessageJobs = pgTable("bulk_message_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateName: text("template_name").notNull(),
  recipients: jsonb("recipients").notNull(),
  status: text("status").notNull(), // 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'
  totalMessages: integer("total_messages").notNull(),
  sentMessages: integer("sent_messages").default(0).notNull(),
  failedMessages: integer("failed_messages").default(0).notNull(),
  languageCode: text("language_code").default("en_US").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const contactsRelations = relations(contacts, ({ many }) => ({
  calls: many(calls),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  calls: many(calls),
}));

export const callsRelations = relations(calls, ({ one, many }) => ({
  contact: one(contacts, {
    fields: [calls.contactId],
    references: [contacts.id],
  }),
  campaign: one(campaigns, {
    fields: [calls.campaignId],
    references: [campaigns.id],
  }),
  messages: many(callMessages),
}));

export const callMessagesRelations = relations(callMessages, ({ one }) => ({
  call: one(calls, {
    fields: [callMessages.callId],
    references: [calls.id],
  }),
}));

export const whatsappTemplatesRelations = relations(whatsappTemplates, ({ many }) => ({
  bulkJobs: many(bulkMessageJobs),
}));

export const bulkMessageJobsRelations = relations(bulkMessageJobs, ({ one }) => ({
  template: one(whatsappTemplates, {
    fields: [bulkMessageJobs.templateName],
    references: [whatsappTemplates.name],
  }),
}));

// Enhanced contact engagement tracking
export const contactEngagement = pgTable('contact_engagement', {
  id: serial('id').primaryKey(),
  contactId: integer('contact_id').notNull().references(() => contacts.id),
  channel: varchar('channel', { length: 20 }).notNull(), // CALL, WHATSAPP, EMAIL, BOTH
  status: varchar('status', { length: 20 }).default('PENDING'), // PENDING, REACHED, RESPONDED, ONBOARDED, FAILED
  campaignId: varchar('campaign_id', { length: 255 }),
  callId: varchar('call_id', { length: 255 }),
  whatsappMessageId: varchar('whatsapp_message_id', { length: 255 }),
  emailId: varchar('email_id', { length: 255 }),
  response: text('response'),
  followUpDate: timestamp('follow_up_date'),
  nextAction: varchar('next_action', { length: 50 }), // CALL, WHATSAPP, EMAIL, ONBOARD, CLOSE
  attempts: integer('attempts').default(0),
  lastContactedAt: timestamp('last_contacted_at'),
  onboardedAt: timestamp('onboarded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Campaign analytics tracking
export const campaignMetrics = pgTable('campaign_metrics', {
  id: serial('id').primaryKey(),
  campaignId: varchar('campaign_id', { length: 255 }).notNull(),
  date: date('date').notNull(),
  contactsReached: integer('contacts_reached').default(0),
  responsesReceived: integer('responses_received').default(0),
  onboardingStarted: integer('onboarding_started').default(0),
  onboardingCompleted: integer('onboarding_completed').default(0),
  followUpsScheduled: integer('follow_ups_scheduled').default(0),
  callsAttempted: integer('calls_attempted').default(0),
  callsConnected: integer('calls_connected').default(0),
  whatsappSent: integer('whatsapp_sent').default(0),
  whatsappDelivered: integer('whatsapp_delivered').default(0),
  emailsSent: integer('emails_sent').default(0),
  emailsOpened: integer('emails_opened').default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations for enhanced tracking
export const contactEngagementRelations = relations(contactEngagement, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactEngagement.contactId],
    references: [contacts.id],
  }),
}));

// Update existing contacts relations to include engagements
export const contactsEnhancedRelations = relations(contacts, ({ many }) => ({
  engagements: many(contactEngagement),
  calls: many(calls),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
});

export const insertCallSchema = createInsertSchema(calls).omit({
  id: true,
  startTime: true,
});

export const insertCallMessageSchema = createInsertSchema(callMessages).omit({
  id: true,
  timestamp: true,
});

export const insertWhatsAppTemplateSchema = createInsertSchema(whatsappTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBulkMessageJobSchema = createInsertSchema(bulkMessageJobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertContactEngagementSchema = createInsertSchema(contactEngagement).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCampaignMetricsSchema = createInsertSchema(campaignMetrics).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;

export type Call = typeof calls.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;

export type CallMessage = typeof callMessages.$inferSelect;
export type InsertCallMessage = z.infer<typeof insertCallMessageSchema>;

export type WhatsAppTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsAppTemplate = z.infer<typeof insertWhatsAppTemplateSchema>;

export type BulkMessageJob = typeof bulkMessageJobs.$inferSelect;
export type InsertBulkMessageJob = z.infer<typeof insertBulkMessageJobSchema>;

export type ContactEngagement = typeof contactEngagement.$inferSelect;
export type InsertContactEngagement = z.infer<typeof insertContactEngagementSchema>;

export type CampaignMetrics = typeof campaignMetrics.$inferSelect;
export type InsertCampaignMetrics = z.infer<typeof insertCampaignMetricsSchema>;

// Extended types for API responses
export type CallWithDetails = Call & {
  contact?: Contact;
  campaign?: Campaign;
  messages?: CallMessage[];
};

export type DashboardStats = {
  totalCalls: number;
  successRate: number;
  avgDuration: string;
  contactsCollected: number;
  activeCalls: number;
  aiResponseTime: number;
  aiAccuracy: number;
  todayConversations: number;
  dataPointsToday: number;
  // Enhanced dashboard metrics
  todayReached: number;
  todayResponded: number;
  todayOnboarded: number;
  followUpsDue: number;
  freshContacts: number;
  totalEngagements: number;
  whatsappDelivered: number;
  emailsSent: number;
};

// Enhanced contact with engagement tracking
export type ContactWithEngagement = Contact & {
  latestEngagement?: ContactEngagement;
  totalEngagements: number;
  lastContactedAt?: string;
  nextFollowUp?: string;
  status: string;
};
