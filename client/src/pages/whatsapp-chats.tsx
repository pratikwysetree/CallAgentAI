import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, Edit, Send, Check, CheckCheck, MessageCircle, Phone, Clock } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

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
  const [newMessage, setNewMessage] = useState("");
  const [editingMessage, setEditingMessage] = useState<WhatsAppMessage | null>(null);
  const [editMessageText, setEditMessageText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch WhatsApp chats
  const { data: chats = [], isLoading } = useQuery<WhatsAppChat[]>({
    queryKey: ['/api/whatsapp/chats'],
  });

  // Send new message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { chatId: string; message: string }) => {
      return apiRequest('/api/whatsapp/messages', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setNewMessage("");
      toast({ title: "Message sent successfully" });
    },
    onError: () => {
      toast({ title: "Failed to send message", variant: "destructive" });
    }
  });

  // Edit message mutation
  const editMessageMutation = useMutation({
    mutationFn: async (data: { messageId: string; message: string }) => {
      return apiRequest(`/api/whatsapp/messages/${data.messageId}`, 'PATCH', { message: data.message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setEditingMessage(null);
      setEditMessageText("");
      toast({ title: "Message updated successfully" });
    },
    onError: () => {
      toast({ title: "Failed to update message", variant: "destructive" });
    }
  });

  // Delete chat mutation
  const deleteChatMutation = useMutation({
    mutationFn: async (chatId: string) => {
      return apiRequest(`/api/whatsapp/chats/${chatId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/chats'] });
      setSelectedChat(null);
      toast({ title: "Chat deleted successfully" });
    },
    onError: () => {
      toast({ title: "Failed to delete chat", variant: "destructive" });
    }
  });

  const handleSendMessage = () => {
    if (!selectedChat || !newMessage.trim()) return;
    sendMessageMutation.mutate({
      chatId: selectedChat.id,
      message: newMessage.trim()
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading WhatsApp chats...</div>
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
        {/* Chat List */}
        <div className="lg:col-span-1">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Conversations ({chats.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-1 max-h-[calc(100vh-300px)] overflow-y-auto">
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
                    <p className="text-sm mt-2">Start a campaign to begin messaging</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Messages */}
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
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  {selectedChat.messages.map((message) => (
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
          ) : (
            <Card className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Select a conversation to start messaging</p>
                <p className="text-sm mt-2">Choose a chat from the left panel</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}