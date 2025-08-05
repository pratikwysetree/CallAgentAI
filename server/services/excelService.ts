import * as XLSX from 'xlsx';
import { storage } from '../storage';
import type { InsertContact } from '@shared/schema';

export class ExcelService {
  // Import contacts from Excel file
  static async importContactsFromExcel(buffer: Buffer): Promise<{ imported: number; errors: string[] }> {
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sheet to JSON
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length === 0) {
        throw new Error('Excel file is empty');
      }

      const headers = data[0] as string[];
      const rows = data.slice(1) as any[][];
      
      let imported = 0;
      const errors: string[] = [];

      // Map column names (case insensitive)
      const columnMap = {
        name: this.findColumn(headers, ['name', 'full name', 'contact name']),
        phone: this.findColumn(headers, ['phone', 'phone number', 'mobile', 'number']),
        email: this.findColumn(headers, ['email', 'email address', 'mail']),
        whatsapp: this.findColumn(headers, ['whatsapp', 'whatsapp number', 'wa number']),
        company: this.findColumn(headers, ['company', 'organization', 'org']),
        notes: this.findColumn(headers, ['notes', 'comments', 'remarks']),
      };

      // Process each row
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;

        try {
          const contact: InsertContact = {
            name: this.getCellValue(row, columnMap.name),
            phoneNumber: this.getCellValue(row, columnMap.phone),
            email: this.getCellValue(row, columnMap.email) || undefined,
            whatsappNumber: this.getCellValue(row, columnMap.whatsapp) || undefined,
            company: this.getCellValue(row, columnMap.company) || undefined,
            notes: this.getCellValue(row, columnMap.notes) || undefined,
            importedFrom: 'excel',
          };

          // Validate required fields
          if (!contact.name || !contact.phoneNumber) {
            errors.push(`Row ${i + 2}: Missing required fields (name or phone)`);
            continue;
          }

          // Check if contact already exists
          const existing = await storage.getContactByPhone(contact.phoneNumber);
          if (existing) {
            errors.push(`Row ${i + 2}: Contact with phone ${contact.phoneNumber} already exists`);
            continue;
          }

          await storage.createContact(contact);
          imported++;
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      return { imported, errors };
    } catch (error) {
      throw new Error(`Failed to import Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Export contacts to Excel file
  static async exportContactsToExcel(): Promise<Buffer> {
    try {
      const contacts = await storage.getContacts();
      
      // Prepare data for Excel
      const data = contacts.map(contact => ({
        'Name': contact.name,
        'Phone Number': contact.phoneNumber,
        'Email': contact.email || '',
        'WhatsApp Number': contact.whatsappNumber || '',
        'Company': contact.company || '',
        'Notes': contact.notes || '',
        'Created At': contact.createdAt.toISOString().split('T')[0],
      }));

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Auto-size columns
      const colWidths = [
        { wch: 20 }, // Name
        { wch: 15 }, // Phone
        { wch: 25 }, // Email
        { wch: 15 }, // WhatsApp
        { wch: 20 }, // Company
        { wch: 30 }, // Notes
        { wch: 12 }, // Created At
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
      
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
      throw new Error(`Failed to export contacts: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Export call summaries with extracted data to Excel
  static async exportCallSummariesWithData(): Promise<Buffer> {
    try {
      const calls = await storage.getCalls();
      
      // Prepare call data for Excel
      const data = calls.map(call => ({
        'Call ID': call.id,
        'Contact Name': call.contact?.name || 'Unknown',
        'Phone Number': call.phoneNumber,
        'Campaign': call.campaign?.name || 'Unknown',
        'Status': call.status,
        'Duration (seconds)': call.duration || 0,
        'Start Time': call.startTime.toISOString(),
        'End Time': call.endTime?.toISOString() || '',
        'Summary': call.conversationSummary || '',
        'Extracted WhatsApp': call.extractedWhatsapp || '',
        'Extracted Email': call.extractedEmail || '',
        'WhatsApp Sent': call.whatsappSent ? 'Yes' : 'No',
        'Email Sent': call.emailSent ? 'Yes' : 'No',
        'Success Score': call.successScore || 0,
      }));

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(data);
      
      // Auto-size columns
      const colWidths = [
        { wch: 15 }, // Call ID
        { wch: 20 }, // Contact Name
        { wch: 15 }, // Phone Number
        { wch: 15 }, // Campaign
        { wch: 12 }, // Status
        { wch: 12 }, // Duration
        { wch: 20 }, // Start Time
        { wch: 20 }, // End Time
        { wch: 40 }, // Summary
        { wch: 15 }, // WhatsApp
        { wch: 25 }, // Email
        { wch: 12 }, // WhatsApp Sent
        { wch: 12 }, // Email Sent
        { wch: 12 }, // Success Score
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'Call Summaries');
      
      return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    } catch (error) {
      throw new Error(`Failed to export call summaries: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper methods
  private static findColumn(headers: string[], possibleNames: string[]): number {
    for (const name of possibleNames) {
      const index = headers.findIndex(header => 
        header.toLowerCase().trim() === name.toLowerCase()
      );
      if (index !== -1) return index;
    }
    return -1;
  }

  private static getCellValue(row: any[], columnIndex: number): string {
    if (columnIndex === -1 || columnIndex >= row.length) return '';
    const value = row[columnIndex];
    return value ? String(value).trim() : '';
  }
}