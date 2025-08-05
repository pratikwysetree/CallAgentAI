import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Phone, Mail, Download, Upload, Users } from "lucide-react";
import Sidebar from "@/components/sidebar";
import type { Contact, InsertContact } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function Contacts() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newContact, setNewContact] = useState<InsertContact>({
    name: "",
    phoneNumber: "",
    email: "",
    whatsappNumber: "",
    company: "",
    notes: "",
  });
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch contacts
  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
  });

  // Add contact mutation
  const addContactMutation = useMutation({
    mutationFn: (contact: InsertContact) => apiRequest('/api/contacts', 'POST', contact),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsAddModalOpen(false);
      setNewContact({
        name: "",
        phoneNumber: "",
        email: "",
        whatsappNumber: "",
        company: "",
        notes: "",
      });
      toast({
        title: "Contact added successfully",
        description: "The new contact has been added to your database.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error adding contact",
        description: "Please check your information and try again.",
        variant: "destructive",
      });
    },
  });

  // Excel import handler
  const handleExcelImport = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('excel', file);
      
      const response = await fetch('/api/contacts/import-excel', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      
      toast({
        title: "Excel import successful",
        description: `${result.imported} contacts imported successfully.`,
      });
    } catch (error) {
      toast({
        title: "Import failed",
        description: "Please check your Excel file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Excel export handler
  const handleExcelExport = async () => {
    try {
      const response = await fetch('/api/contacts/export-excel');
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contacts-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export successful",
        description: "Contacts exported to Excel file.",
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: "Please try again later.",
        variant: "destructive",
      });
    }
  };

  const handleAddContact = () => {
    addContactMutation.mutate(newContact);
  };

  const initiateCall = async (contact: Contact) => {
    try {
      const response = await apiRequest('/api/calls/initiate', 'POST', {
        phoneNumber: contact.phoneNumber,
        contactId: contact.id,
        campaignId: "default", // You might want to select a campaign
      });

      toast({
        title: "Call initiated",
        description: `Calling ${contact.name} at ${contact.phoneNumber}`,
      });
    } catch (error) {
      toast({
        title: "Call failed",
        description: "Could not initiate the call. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">Contact Database</h2>
              <p className="text-gray-600 mt-1">Manage your contacts and import from Excel</p>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" onClick={handleExcelExport}>
                <Download className="mr-2 h-4 w-4" />
                Export Excel
              </Button>
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Add New Contact</DialogTitle>
                    <DialogDescription>
                      Enter the contact details below.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={newContact.name}
                          onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                          placeholder="John Doe"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                          id="phone"
                          value={newContact.phoneNumber}
                          onChange={(e) => setNewContact({ ...newContact, phoneNumber: e.target.value })}
                          placeholder="+1234567890"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
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
                        <Label htmlFor="whatsapp">WhatsApp Number</Label>
                        <Input
                          id="whatsapp"
                          value={newContact.whatsappNumber || ""}
                          onChange={(e) => setNewContact({ ...newContact, whatsappNumber: e.target.value })}
                          placeholder="+1234567890"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={newContact.company || ""}
                        onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                        placeholder="Company Name"
                      />
                    </div>

                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Input
                        id="notes"
                        value={newContact.notes || ""}
                        onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                        placeholder="Additional notes..."
                      />
                    </div>

                    <div className="flex justify-end space-x-2 pt-4">
                      <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleAddContact}
                        disabled={addContactMutation.isPending || !newContact.name || !newContact.phoneNumber}
                      >
                        {addContactMutation.isPending ? "Adding..." : "Add Contact"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            
            {/* Excel Import Section */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Upload className="mr-2 h-5 w-5" />
                  Excel Import
                </CardTitle>
                <CardDescription>
                  Import contacts from Excel file. Supported columns: Name, Phone, Email, WhatsApp, Company, Notes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileUpload
                  onFileSelect={handleExcelImport}
                  accept=".xlsx,.xls,.csv"
                  className="max-w-md"
                >
                  {isUploading ? "Importing..." : "Upload Excel File"}
                </FileUpload>
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Users className="h-8 w-8 text-blue-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">Total Contacts</p>
                      <p className="text-2xl font-bold text-gray-900">{contacts.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Mail className="h-8 w-8 text-green-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">With Email</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {contacts.filter(c => c.email).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center">
                    <Phone className="h-8 w-8 text-purple-600" />
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">With WhatsApp</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {contacts.filter(c => c.whatsappNumber).length}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Contacts List */}
            <Card>
              <CardHeader>
                <CardTitle>All Contacts</CardTitle>
                <CardDescription>
                  Click on a contact to view details or start a call
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">Loading contacts...</div>
                ) : contacts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No contacts found. Add your first contact or import from Excel.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-4">Name</th>
                          <th className="text-left py-2 px-4">Phone</th>
                          <th className="text-left py-2 px-4">Email</th>
                          <th className="text-left py-2 px-4">WhatsApp</th>
                          <th className="text-left py-2 px-4">Company</th>
                          <th className="text-left py-2 px-4">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {contacts.map((contact) => (
                          <tr key={contact.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium">{contact.name}</td>
                            <td className="py-3 px-4">{contact.phoneNumber}</td>
                            <td className="py-3 px-4">{contact.email || "-"}</td>
                            <td className="py-3 px-4">{contact.whatsappNumber || "-"}</td>
                            <td className="py-3 px-4">{contact.company || "-"}</td>
                            <td className="py-3 px-4">
                              <Button
                                size="sm"
                                onClick={() => initiateCall(contact)}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <Phone className="h-4 w-4 mr-1" />
                                Call
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}