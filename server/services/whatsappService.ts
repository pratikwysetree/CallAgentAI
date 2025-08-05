import { db } from '../db';
import { whatsappChats, whatsappMessages } from '@shared/schema';
import { eq, desc, sql } from 'drizzle-orm';

export class WhatsAppService {
  private static baseUrl = 'https://graph.facebook.com/v18.0';
  private static accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  private static phoneNumberId = process.env.META_WHATSAPP_BUSINESS_PHONE_NUMBER_ID;

  // Send a WhatsApp message using Meta Business API
  static async sendMessage(
    to: string,
    message: string,
    contactName: string,
    contactId?: string
  ): Promise<{ success: boolean; messageId?: string; error?: string; chatId?: string }> {
    try {
      // Create or get existing chat first
      const chatId = await this.getOrCreateChat(contactId || to, to, contactName);
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Format phone number (remove + and non-digits)
      const cleanNumber = to.replace(/\D/g, '');
      const whatsappNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;

      console.log(`Attempting to send WhatsApp message to ${whatsappNumber}: ${message}`);

      let actualMessageSent = false;
      let metaMessageId = null;

      // Try to send via Meta WhatsApp Business API if credentials are available
      if (this.accessToken && this.phoneNumberId) {
        try {
          const response = await fetch(`${this.baseUrl}/${this.phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to: whatsappNumber,
              type: 'text',
              text: {
                body: message
              }
            })
          });

          const result = await response.json();

          if (response.ok) {
            actualMessageSent = true;
            metaMessageId = result.messages?.[0]?.id;
            console.log(`✅ WhatsApp message sent successfully via Meta API`);
          } else {
            console.log(`⚠️ Meta API failed: ${result.error?.message}. Storing message locally for chat interface.`);
          }
        } catch (apiError: any) {
          console.log(`⚠️ Meta API error: ${apiError.message}. Storing message locally for chat interface.`);
        }
      } else {
        console.log(`⚠️ Meta WhatsApp credentials not configured. Storing message locally for chat interface.`);
      }

      // Store message in database regardless of API success (for chat interface)
      await db.insert(whatsappMessages).values({
        id: messageId,
        chatId,
        contactPhone: to,
        contactName,
        message,
        direction: 'outbound',
        status: actualMessageSent ? 'sent' : 'pending',
        messageType: 'text',
        twilioMessageSid: metaMessageId,
        timestamp: new Date(),
      });

      // Update chat with last message
      await db.update(whatsappChats)
        .set({
          lastMessage: message,
          lastMessageTime: new Date(),
        })
        .where(eq(whatsappChats.id, chatId));

      return {
        success: true,
        messageId,
        chatId,
      };
    } catch (error: any) {
      console.error('Error processing WhatsApp message:', error);
      return {
        success: false,
        error: error.message || 'Failed to process WhatsApp message',
      };
    }
  }

  // Get or create a chat for a contact
  static async getOrCreateChat(contactId: string, contactPhone: string, contactName: string): Promise<string> {
    try {
      // Try to find existing chat
      const existingChat = await db.select()
        .from(whatsappChats)
        .where(eq(whatsappChats.contactPhone, contactPhone))
        .limit(1);

      if (existingChat.length > 0) {
        return existingChat[0].id;
      }

      // Create new chat
      const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.insert(whatsappChats).values({
        id: chatId,
        contactId,
        contactPhone,
        contactName,
        status: 'active',
      });

      return chatId;
    } catch (error) {
      console.error('Error getting or creating chat:', error);
      throw error;
    }
  }

  // Get all chats with their latest messages
  static async getChats(): Promise<any[]> {
    try {
      const chats = await db.select()
        .from(whatsappChats)
        .orderBy(desc(whatsappChats.lastMessageTime));

      // Get messages for each chat
      const chatsWithMessages = await Promise.all(
        chats.map(async (chat) => {
          const messages = await db.select()
            .from(whatsappMessages)
            .where(eq(whatsappMessages.chatId, chat.id))
            .orderBy(desc(whatsappMessages.timestamp));

          return {
            ...chat,
            messages,
          };
        })
      );

      return chatsWithMessages;
    } catch (error) {
      console.error('Error fetching chats:', error);
      throw error;
    }
  }

  // Send message to existing chat
  static async sendChatMessage(chatId: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Get chat details
      const chat = await db.select()
        .from(whatsappChats)
        .where(eq(whatsappChats.id, chatId))
        .limit(1);

      if (chat.length === 0) {
        return { success: false, error: 'Chat not found' };
      }

      const chatData = chat[0];
      return await this.sendMessage(chatData.contactPhone, message, chatData.contactName, chatData.contactId || undefined);
    } catch (error: any) {
      console.error('Error sending chat message:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }
  }

  // Handle incoming WhatsApp message (webhook)
  static async handleIncomingMessage(messageData: any): Promise<void> {
    try {
      const { from, text, timestamp, id: messageId } = messageData;
      
      // Get contact info or create new contact entry
      let contactName = from; // Default to phone number
      
      // Try to find existing contact
      const contacts = await db.select()
        .from(whatsappChats)
        .where(eq(whatsappChats.contactPhone, from))
        .limit(1);
      
      if (contacts.length > 0) {
        contactName = contacts[0].contactName;
      }

      // Create or get existing chat
      const chatId = await this.getOrCreateChat(from, from, contactName);

      // Store incoming message
      const incomingMessageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.insert(whatsappMessages).values({
        id: incomingMessageId,
        chatId,
        contactPhone: from,
        contactName,
        message: text?.body || '',
        direction: 'inbound',
        status: 'received',
        messageType: 'text',
        twilioMessageSid: messageId,
        timestamp: new Date(timestamp * 1000),
      });

      // Update chat with last message
      await db.update(whatsappChats)
        .set({
          lastMessage: text?.body || '',
          lastMessageTime: new Date(timestamp * 1000),
          unreadCount: sql`${whatsappChats.unreadCount} + 1`,
        })
        .where(eq(whatsappChats.id, chatId));

      console.log(`✅ Incoming WhatsApp message stored from ${from}: ${text?.body}`);
    } catch (error) {
      console.error('Error handling incoming WhatsApp message:', error);
    }
  }

  // Update message
  static async updateMessage(messageId: string, newMessage: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(whatsappMessages)
        .set({
          message: newMessage,
        })
        .where(eq(whatsappMessages.id, messageId));

      return { success: true };
    } catch (error: any) {
      console.error('Error updating message:', error);
      return {
        success: false,
        error: error.message || 'Failed to update message',
      };
    }
  }

  // Delete chat
  static async deleteChat(chatId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete all messages in the chat first
      await db.delete(whatsappMessages).where(eq(whatsappMessages.chatId, chatId));
      
      // Delete the chat
      await db.delete(whatsappChats).where(eq(whatsappChats.id, chatId));

      return { success: true };
    } catch (error: any) {
      console.error('Error deleting chat:', error);
      return {
        success: false,
        error: error.message || 'Failed to delete chat',
      };
    }
  }
}