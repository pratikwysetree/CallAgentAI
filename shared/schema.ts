import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, jsonb } from "drizzle-orm/pg-core";
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
  phoneNumber: text("phone_number").notNull(),
  email: text("email"),
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
};
