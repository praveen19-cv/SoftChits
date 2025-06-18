import path from 'path';
import fs from 'fs';

// Ensure data directory exists with proper permissions
const dataDir = path.join(process.cwd(), 'data');
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
  }
  // Ensure directory is writable
  fs.accessSync(dataDir, fs.constants.W_OK);
} catch (error) {
  console.error('Error setting up database directory:', error);
  throw error;
}

export const dbPath = path.join(dataDir, 'chitfund.db');
console.log('Database path:', dbPath); 