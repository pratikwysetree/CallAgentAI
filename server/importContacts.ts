import { readFileSync } from 'fs';
import { db } from './db';
import { contacts } from '@shared/schema';
import type { InsertContact } from '@shared/schema';

interface CSVContact {
  name: string;
  city: string;
  state: string;
  phone_number: string;
  email: string;
}

export async function importContactsFromCSV(filePath: string) {
  try {
    console.log('Starting contact import from CSV...');
    
    // Read and parse CSV file manually
    const fileContent = readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    
    const csvData: CSVContact[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim()); // Push the last value
      
      if (values.length >= 4) {
        csvData.push({
          name: values[0] || '',
          city: values[1] || '',
          state: values[2] || '',
          phone_number: values[3] || '',
          email: values[4] || ''
        });
      }
    }

    console.log(`Found ${csvData.length} contacts in CSV file`);

    // Get existing phone numbers from database
    const existingContacts = await db.select({ phone: contacts.phone }).from(contacts);
    const existingPhones = new Set(existingContacts.map(c => c.phone));
    
    console.log(`Found ${existingContacts.length} existing contacts in database`);

    // Filter out contacts that already exist
    const newContacts: InsertContact[] = [];
    let skipped = 0;
    let invalid = 0;

    for (const csvContact of csvData) {
      // Clean and validate phone number
      const phone = csvContact.phone_number?.trim();
      
      if (!phone || phone.length < 10 || phone.length > 13 || !phone.match(/^[0-9+]+$/)) {
        invalid++;
        continue;
      }

      // Skip if phone already exists
      if (existingPhones.has(phone)) {
        skipped++;
        continue;
      }

      // Prepare contact for insertion
      const newContact: InsertContact = {
        name: csvContact.name?.trim() || 'Unknown',
        phone: phone,
        email: csvContact.email?.trim() || null,
        city: csvContact.city?.trim() || null,
        state: csvContact.state?.trim() || null,
        company: null, // Will be extracted from name if needed
        notes: null
      };

      newContacts.push(newContact);
      existingPhones.add(phone); // Add to set to prevent duplicates within the CSV
    }

    console.log(`Prepared ${newContacts.length} new contacts for insertion`);
    console.log(`Skipped ${skipped} existing contacts`);
    console.log(`Skipped ${invalid} invalid contacts`);

    // Insert new contacts in batches
    const batchSize = 100;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < newContacts.length; i += batchSize) {
      const batch = newContacts.slice(i, i + batchSize);
      
      try {
        await db.insert(contacts).values(batch).onConflictDoNothing();
        inserted += batch.length;
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(newContacts.length / batchSize)}`);
      } catch (error) {
        console.error(`Error inserting batch starting at ${i}:`, error);
        errors += batch.length;
      }
    }

    // Final verification
    const finalCount = await db.select({ count: contacts.id }).from(contacts);
    
    console.log('\n=== IMPORT SUMMARY ===');
    console.log(`Total contacts in CSV: ${csvData.length}`);
    console.log(`Existing contacts (skipped): ${skipped}`);
    console.log(`Invalid contacts (skipped): ${invalid}`);
    console.log(`New contacts inserted: ${inserted}`);
    console.log(`Insertion errors: ${errors}`);
    console.log(`Final database count: ${finalCount.length}`);
    console.log('===================\n');

    return {
      totalInCSV: csvData.length,
      skipped,
      invalid,
      inserted,
      errors,
      finalCount: finalCount.length
    };

  } catch (error) {
    console.error('Error during contact import:', error);
    throw error;
  }
}