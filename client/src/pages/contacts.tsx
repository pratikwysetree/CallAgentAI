import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Contact, InsertContact } from "@shared/schema";
import Sidebar from "@/components/sidebar";

export default function Contacts() {
  const [newContact, setNewContact] = useState<InsertContact>({
    name: "",
    phoneNumber: "",
    email: "",
    company: "",
    notes: "",
  });
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    refetchInterval: 30000,
  });

  // Create contact mutation
  const createContactMutation = useMutation({
    mutationFn: async (data: InsertContact) => {
      return await apiRequest('POST', '/api/contacts', data);
    },
    onSuccess: () => {
      toast({
        title: "Contact created successfully",
        description: "The new contact has been added to your database.",
      });
      setNewContact({ name: "", phoneNumber: "", email: "", company: "", notes: "" });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: () => {
      toast({
        title: "Failed to create contact",
        description: "There was an error creating the contact.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phoneNumber) {
      toast({
        title: "Missing required fields",
        description: "Please enter at least a name and phone number.",
        variant: "destructive",
      });
      return;
    }

    createContactMutation.mutate(newContact);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Contact Database</h2>
              <p className="text-gray-600 mt-1">Manage your contact information</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-white hover:bg-blue-700">
                  <i className="fas fa-plus mr-2"></i>
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={newContact.name}
                      onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                      placeholder="John Smith"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phoneNumber">Phone Number *</Label>
                    <Input
                      id="phoneNumber"
                      type="tel"
                      value={newContact.phoneNumber}
                      onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email || ""}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Company</Label>
                    <Input
                      id="company"
                      value={newContact.company || ""}
                      onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                      placeholder="Tech Solutions Inc"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={newContact.notes || ""}
                      onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                      placeholder="Additional information"
                    />
                  </div>
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createContactMutation.isPending}
                      className="bg-primary text-white hover:bg-blue-700"
                    >
                      {createContactMutation.isPending ? "Creating..." : "Create Contact"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">All Contacts ({contacts.length})</h3>
            </div>
            
            {isLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-gray-300 rounded-full"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-300 rounded w-48"></div>
                        <div className="h-3 bg-gray-300 rounded w-32"></div>
                      </div>
                      <div className="w-24 h-8 bg-gray-300 rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-12 text-center">
                <i className="fas fa-address-book text-gray-400 text-4xl mb-4"></i>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No contacts yet</h3>
                <p className="text-gray-600">Add your first contact to get started with calling campaigns.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {contacts.map((contact) => (
                  <div key={contact.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <i className="fas fa-user text-primary text-lg"></i>
                        </div>
                        <div>
                          <h4 className="text-lg font-medium text-gray-900">{contact.name}</h4>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div className="flex items-center space-x-2">
                              <i className="fas fa-phone text-xs"></i>
                              <span>{contact.phoneNumber}</span>
                            </div>
                            {contact.email && (
                              <div className="flex items-center space-x-2">
                                <i className="fas fa-envelope text-xs"></i>
                                <span>{contact.email}</span>
                              </div>
                            )}
                            {contact.company && (
                              <div className="flex items-center space-x-2">
                                <i className="fas fa-building text-xs"></i>
                                <span>{contact.company}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <i className="fas fa-edit mr-2"></i>
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" className="text-primary hover:text-blue-700">
                          <i className="fas fa-phone mr-2"></i>
                          Call
                        </Button>
                      </div>
                    </div>
                    {contact.notes && (
                      <div className="mt-3 ml-16">
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                          <i className="fas fa-sticky-note mr-2"></i>
                          {contact.notes}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}