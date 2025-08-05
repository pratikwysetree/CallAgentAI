import { db } from '../db';
import { whatsappChats, whatsappMessages } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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
      if (!this.accessToken || !this.phoneNumberId) {
        throw new Error('Meta WhatsApp credentials not configured');
      }

      // Format phone number (remove + and non-digits)
      const cleanNumber = to.replace(/\D/g, '');
      const whatsappNumber = cleanNumber.startsWith('91') ? cleanNumber : `91${cleanNumber}`;

      console.log(`Sending WhatsApp message to ${whatsappNumber}: ${message}`);

      // Send message via Meta WhatsApp Business API
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

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${result.error?.message || 'Unknown error'}`);
      }

      // Create or get existing chat
      const chatId = await this.getOrCreateChat(contactId || to, to, contactName);

      // Store message in database
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.insert(whatsappMessages).values({
        id: messageId,
        chatId,
        contactPhone: to,
        contactName,
        message,
        direction: 'outbound',
        status: 'sent',
        messageType: 'text',
        twilioMessageSid: result.messages?.[0]?.id || null,
        timestamp: new Date(),
      });

      // Update chat with last message
      await db.update(whatsappChats)
        .set({
          lastMessage: message,
          lastMessageTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(whatsappChats.id, chatId));

      return {
        success: true,
        messageId,
        chatId,
      };
    } catch (error: any) {
      console.error('Error sending WhatsApp message:', error);
      return {
        success: false,
        error: error.message || 'Failed to send WhatsApp message',
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
      return await this.sendMessage(chatData.contactPhone, message, chatData.contactName, chatData.contactId);
    } catch (error: any) {
      console.error('Error sending chat message:', error);
      return {
        success: false,
        error: error.message || 'Failed to send message',
      };
    }
  }

  // Update message
  static async updateMessage(messageId: string, newMessage: string): Promise<{ success: boolean; error?: string }> {
    try {
      await db.update(whatsappMessages)
        .set({
          message: newMessage,
          updatedAt: new Date(),
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