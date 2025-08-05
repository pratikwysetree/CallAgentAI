import { db } from './db';
import { sql } from 'drizzle-orm';

// Create WhatsApp tables manually to avoid data loss with existing contacts table
export async function createWhatsAppTables() {
  try {
    console.log('Creating WhatsApp tables...');
    
    // Create whatsapp_chats table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_chats (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        contact_id TEXT,
        contact_phone TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        last_message TEXT,
        last_message_time TIMESTAMP,
        unread_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active' NOT NULL,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      );
    `);

    // Create whatsapp_messages table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        chat_id VARCHAR REFERENCES whatsapp_chats(id),
        contact_phone TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        message TEXT NOT NULL,
        direction TEXT NOT NULL,
        status TEXT DEFAULT 'sent' NOT NULL,
        message_type TEXT DEFAULT 'text' NOT NULL,
        timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
        twilio_message_sid TEXT
      );
    `);

    console.log('WhatsApp tables created successfully');
  } catch (error) {
    console.error('Error creating WhatsApp tables:', error);
  }
}