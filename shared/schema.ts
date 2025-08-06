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
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  phoneNumber: text("phone_number"), // Keep both for compatibility
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
  script: text("script"), // Agent script for calling
  introLine: text("intro_line").default("Hi, this is Anvika from LabsCheck. Am I speaking with the owner or manager of the lab?").notNull(),
  agentName: text("agent_name").default("Anvika").notNull(),
  openaiModel: text("openai_model").default("gpt-4o").notNull(),
  language: text("language").default("en").notNull(), // Language for the campaign
  elevenlabsModel: text("elevenlabs_model").default("eleven_multilingual_v2").notNull(), // ElevenLabs model selection
  voiceId: text("voice_id").default("21m00Tcm4TlvDq8ikWAM").notNull(), // Voice agent selection
  voiceConfig: jsonb("voice_config"), // ElevenLabs voice configuration (deprecated in favor of voiceId)
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
  content: text("content").notNull(),
  variables: jsonb("variables"), // Dynamic variables for template
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bulkMessageJobs = pgTable("bulk_message_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  templateId: varchar("template_id").references(() => whatsappTemplates.id),
  contactIds: jsonb("contact_ids").notNull(), // Array of contact IDs
  status: text("status").default("pending").notNull(), // pending, in_progress, completed, failed
  totalMessages: integer("total_messages").default(0).notNull(),
  sentMessages: integer("sent_messages").default(0).notNull(),
  failedMessages: integer("failed_messages").default(0).notNull(),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactEngagement = pgTable("contact_engagement", {
  id: serial("id").primaryKey(),
  contactId: varchar("contact_id").references(() => contacts.id).notNull(),
  campaignId: varchar("campaign_id").references(() => campaigns.id),
  messagesSent: integer("messages_sent").default(0),
  messagesDelivered: integer("messages_delivered").default(0),
  messagesRead: integer("messages_read").default(0),
  lastMessageAt: timestamp("last_message_at"),
  lastResponseAt: timestamp("last_response_at"),
  engagementScore: integer("engagement_score").default(0), // 0-100
  status: text("status").default("active"), // active, paused, completed
  nextFollowUp: timestamp("next_follow_up"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const campaignMetrics = pgTable("campaign_metrics", {
  id: serial("id").primaryKey(),
  campaignId: varchar("campaign_id").references(() => campaigns.id).notNull(),
  date: date("date").notNull(),
  totalMessages: integer("total_messages").default(0),
  messagesDelivered: integer("messages_delivered").default(0),
  messagesRead: integer("messages_read").default(0),
  responses: integer("responses").default(0),
  engagements: integer("engagements").default(0),
  conversions: integer("conversions").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  // Users don't have direct relations in this messaging platform
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  calls: many(calls),
  engagements: many(contactEngagement),
}));

export const campaignsRelations = relations(campaigns, ({ many }) => ({
  calls: many(calls),
  engagements: many(contactEngagement),
  metrics: many(campaignMetrics),
}));

export const whatsappTemplatesRelations = relations(whatsappTemplates, ({ many }) => ({
  bulkJobs: many(bulkMessageJobs),
}));

export const bulkMessageJobsRelations = relations(bulkMessageJobs, ({ one }) => ({
  template: one(whatsappTemplates, {
    fields: [bulkMessageJobs.templateId],
    references: [whatsappTemplates.id],
  }),
}));

export const contactEngagementRelations = relations(contactEngagement, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactEngagement.contactId],
    references: [contacts.id],
  }),
  campaign: one(campaigns, {
    fields: [contactEngagement.campaignId],
    references: [campaigns.id],
  }),
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

export const campaignMetricsRelations = relations(campaignMetrics, ({ one }) => ({
  campaign: one(campaigns, {
    fields: [campaignMetrics.campaignId],
    references: [campaigns.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = typeof contacts.$inferInsert;

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

export type Call = typeof calls.$inferSelect;
export type InsertCall = typeof calls.$inferInsert;

export type CallMessage = typeof callMessages.$inferSelect;
export type InsertCallMessage = typeof callMessages.$inferInsert;

export type WhatsAppTemplate = typeof whatsappTemplates.$inferSelect;
export type InsertWhatsAppTemplate = typeof whatsappTemplates.$inferInsert;

export type BulkMessageJob = typeof bulkMessageJobs.$inferSelect;
export type InsertBulkMessageJob = typeof bulkMessageJobs.$inferInsert;

export type ContactEngagement = typeof contactEngagement.$inferSelect;
export type CampaignMetrics = typeof campaignMetrics.$inferSelect;

export interface DashboardStats {
  totalContacts: number;
  totalCampaigns: number;
  totalCalls: number;
  activeCalls: number;
  totalMessages: number;
  deliveryRate: number;
  engagementRate: number;
  averageResponseTime: number;
  successRate: number;
}

// Call with joined data for detailed views
export interface CallWithDetails extends Call {
  contact?: Contact;
  campaign?: Campaign;
}

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const insertContactSchema = createInsertSchema(contacts);
export const insertCampaignSchema = createInsertSchema(campaigns);
export const insertCallSchema = createInsertSchema(calls);
export const insertCallMessageSchema = createInsertSchema(callMessages);
export const insertWhatsAppTemplateSchema = createInsertSchema(whatsappTemplates);
export const insertBulkMessageJobSchema = createInsertSchema(bulkMessageJobs);