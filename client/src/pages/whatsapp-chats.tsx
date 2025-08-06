import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, Send, Check, CheckCheck, MessageCircle, Phone, Clock, Users, Plus } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Contact } from "@shared/schema";

interface WhatsAppMessage {
  id: string;
  chatId: string;
  contactPhone: string;
  contactName: string;
  message: string;
  direction: 'outbound' | 'inbound';
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  messageType: 'text' | 'template';
}

interface WhatsAppChat {
  id: string;
  contactPhone: string;
  contactName: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  status: 'active' | 'archived';
  messages: WhatsAppMessage[];
}

export default function WhatsAppChats() {
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newContactMessage, setNewContactMessage] = useState("");
  const [editingMessage, setEditingMessage] = useState<WhatsAppMessage | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const [activeTab, setActiveTab] = useState("chats");
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WhatsApp chats with auto-refresh
  const { data: chats = [], isLoading: chatsLoading } = useQuery<WhatsAppChat[]>({
    queryKey: ['/api/whatsapp/chats'],
    refetchInterval: 3000, // Auto-refresh every 3 seconds
    refetchIntervalInBackground: true,
  });

  // Fetch all contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts/enhanced'],
    refetchInterval: 10000, // Auto-refresh every 10 seconds for contacts
  });

  // Filter contacts based on search term
  const filteredContacts = contacts.filter(contact => 
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm) ||
    (contact.company && contact.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contact.city && contact.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (contact.state && contact.state.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Send message to existing chat
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { chatId: string; message: string }) => {
      const response = await apiRequest('POST', '/api/whatsapp/messages', data);
      return response.json();
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      toast({
        title: "Message sent successfully",
        description: "Your WhatsApp message has been sent.",
      });
    },
    onError: (error: any) => {
      console.error('Error sending message:', error);
      toast({
        title: "Failed to send message",
        description: error instanceof Error ? error.message : "Failed to send WhatsApp message",
        variant: "destructive",
      });
    }
  });

  // Send message to contact (creates new chat)
  const sendContactMessageMutation = useMutation({
    mutationFn: async (data: { contactId: number; contactPhone: string; contactName: string; message: string }) => {
      const response = await apiRequest('POST', '/api/whatsapp/messages/contact', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setNewContactMessage("");
      setSelectedContact(null);
      setActiveTab("chats");
      toast({ title: "Message sent successfully" });
    },
    onError: (error: any) => {
      console.error('Error sending message to contact:', error);
      toast({ title: "Failed to send message", description: error.message || "Please try again", variant: "destructive" });
    }
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async (data: { messageId: string; message: string }) => {
      const response = await apiRequest('PATCH', `/api/whatsapp/messages/${data.messageId}`, { message: data.message });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setEditingMessage(null);
      setEditMessageText("");
      toast({ title: "Message updated successfully" });
    },
    onError: (error: any) => {
      console.error('Error editing message:', error);
      toast({ title: "Failed to update message", description: error.message || "Please try again", variant: "destructive" });
    }
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      const response = await apiRequest('DELETE', `/api/whatsapp/chats/${chatId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChat(null);
      toast({ title: "Chat deleted successfully" });
    },
    onError: (error: any) => {
      console.error('Error deleting chat:', error);
      toast({ title: "Failed to delete chat", description: error.message || "Please try again", variant: "destructive" });
    }
  });

  const handleSendMessage = () => {
    if (!selectedChat || !newMessage.trim()) return;
    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      message: newMessage.trim()
    });
  };

  const handleSendContactMessage = () => {
    if (!selectedContact || !newContactMessage.trim()) return;
    sendContactMessageMutation.mutate({
      contactId: selectedContact.id,
      contactPhone: selectedContact.phone,
      contactName: selectedContact.name,
      message: newContactMessage.trim()
    });
  };

  const handleEditMessage = (message: WhatsAppMessage) => {
    setEditingMessage(message);
    setEditMessageText(message.message);
  };

  const handleSaveEdit = () => {
    if (!editingMessage || !editMessageText.trim()) return;
    editMessageMutation.mutate({
      messageId: editingMessage.id,
      message: editMessageText.trim()
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="w-4 h-4 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="w-4 h-4 text-gray-400" />;
      case 'read':
        return <CheckCheck className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <Clock className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (chatsLoading || contactsLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading WhatsApp data...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">WhatsApp Chats</h1>
        <p className="text-muted-foreground">Manage your WhatsApp conversations and messages</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
        {/* Left Panel - Chats and Contacts */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="chats" className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Chats ({chats.length})
                  </TabsTrigger>
                  <TabsTrigger value="contacts" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Contacts ({contacts.length})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                {/* Existing Chats Tab */}
                <TabsContent value="chats">
                  <div className="space-y-1 max-h-[calc(100vh-350px)] overflow-y-auto">
                    {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedChat?.id === chat.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedChat(chat)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-600" />
                          <p className="font-medium truncate">{chat.contactName}</p>
                          {chat.unreadCount > 0 && (
                            <Badge variant="default" className="ml-auto">
                              {chat.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{chat.contactPhone}</p>
                        <p className="text-sm text-muted-foreground mt-1 truncate">
                          {chat.lastMessage}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(chat.lastMessageTime)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                    {chats.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>No WhatsApp conversations yet</p>
                        <p className="text-sm mt-2">Select a contact to start messaging</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* All Contacts Tab */}
                <TabsContent value="contacts">
                  <div className="p-4 border-b">
                    <Input
                      placeholder="Search contacts by name, phone, company, city..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-2">
                      {filteredContacts.length} of {contacts.length} contacts shown
                    </p>
                  </div>
                  <div className="space-y-1 max-h-[calc(100vh-450px)] overflow-y-auto">
                    {filteredContacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={`p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors ${
                          selectedContact?.id === contact.id ? 'bg-muted' : ''
                        }`}
                        onClick={() => {
                          setSelectedContact(contact);
                          setSelectedChat(null);
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-green-600" />
                              <p className="font-medium truncate">{contact.name}</p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{contact.phone}</p>
                            {contact.city && contact.state && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {contact.city}, {contact.state}
                              </p>
                            )}
                            {contact.company && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {contact.company}
                              </p>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedContact(contact);
                              setSelectedChat(null);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Message
                          </Button>
                        </div>
                      </div>
                    ))}
                    {filteredContacts.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{searchTerm ? "No contacts match your search" : "No contacts available"}</p>
                        <p className="text-sm mt-2">{searchTerm ? "Try a different search term" : "Import contacts to start messaging"}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Messages */}
        <div className="lg:col-span-2">
          {selectedChat ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-green-600" />
                      {selectedChat.contactName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedChat.contactPhone}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] })}
                    >
                      Refresh
                    </Button>
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Chat
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Chat</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete this chat with {selectedChat.contactName}? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteChatMutation.mutate(selectedChat.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  {selectedChat.messages
                    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                    .map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          message.direction === 'outbound'
                            ? 'bg-green-500 text-white'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.message}</p>
                        <div className="flex items-center justify-end gap-2 mt-2">
                          <span className="text-xs opacity-75">
                            {formatTime(message.timestamp)}
                          </span>
                          {message.direction === 'outbound' && (
                            <>
                              {getStatusIcon(message.status)}
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-1 text-white hover:bg-green-600"
                                    onClick={() => handleEditMessage(message)}
                                  >
                                    <Edit className="w-3 h-3" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Edit Message</DialogTitle>
                                  </DialogHeader>
                                  <div className="space-y-4">
                                    <Textarea
                                      value={editMessageText}
                                      onChange={(e) => setEditMessageText(e.target.value)}
                                      placeholder="Edit your message..."
                                      rows={3}
                                    />
                                    <div className="flex justify-end gap-2">
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setEditingMessage(null);
                                          setEditMessageText("");
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button onClick={handleSaveEdit}>
                                        Save Changes
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type a message..."
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1"
                  />
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ) : selectedContact ? (
            <Card className="h-full flex flex-col">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Phone className="w-5 h-5 text-green-600" />
                      {selectedContact.name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">{selectedContact.phone}</p>
                    {selectedContact.city && selectedContact.state && (
                      <p className="text-xs text-muted-foreground">
                        {selectedContact.city}, {selectedContact.state}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">New Chat</Badge>
                </div>
              </CardHeader>

              {/* New Contact Message Area */}
              <CardContent className="flex-1 p-4 flex flex-col justify-end">
                <div className="text-center text-muted-foreground mb-8">
                  <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">Start a new conversation</p>
                  <p className="text-sm mt-2">Send your first message to {selectedContact.name}</p>
                </div>
              </CardContent>

              {/* Message Input for New Contact */}
              <div className="border-t p-4">
                <div className="space-y-3">
                  <Textarea
                    value={newContactMessage}
                    onChange={(e) => setNewContactMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end">
                    <Button 
                      onClick={handleSendContactMessage}
                      disabled={!newContactMessage.trim() || sendContactMessageMutation.isPending}
                      className="min-w-24"
                    >
                      {sendContactMessageMutation.isPending ? (
                        "Sending..."
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a chat or contact to start messaging</p>
                <p className="text-sm mt-2">Choose from existing chats or select a contact to send a new message</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}