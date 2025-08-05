import { importContactsFromCSV } from './importContacts';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  const csvPath = resolve(__dirname, '../attached_assets/Small Labs Excel sheet - Only Mobiles_1754394580218.csv');
  
  try {
    const result = await importContactsFromCSV(csvPath);
    console.log('Import completed successfully:', result);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();