import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Configure database with busy timeout and retry logic
const db = new Database(path.join(dataDir, 'chitfund.db'), {
  verbose: console.log,
  // Set busy timeout to 5 seconds
  timeout: 5000,
  // Enable WAL mode for better concurrency
  pragma: {
    journal_mode: 'WAL',
    synchronous: 'NORMAL',
    busy_timeout: 5000,
    foreign_keys: 'ON'
  }
} as Database.Options);

// Helper function to execute queries with retry logic
export function executeWithRetry<T>(operation: () => T, maxRetries = 3): T {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      if (error.code === 'SQLITE_BUSY' && attempt < maxRetries) {
        // Wait for a random time between 100ms and 1000ms before retrying
        const delay = Math.floor(Math.random() * 900) + 100;
        console.log(`Database busy, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  
  throw lastError;
}

// Wrap the database object with retry logic
const dbWithRetry = {
  prepare: (sql: string) => {
    const stmt = db.prepare(sql);
    return {
      ...stmt,
      run: (...params: any[]) => executeWithRetry(() => stmt.run(...params)),
      get: (...params: any[]) => executeWithRetry(() => stmt.get(...params)),
      all: (...params: any[]) => executeWithRetry(() => stmt.all(...params))
    };
  },
  transaction: (fn: Function) => {
    return executeWithRetry(() => {
      db.prepare('BEGIN').run();
      try {
        const result = fn();
        db.prepare('COMMIT').run();
        return result;
      } catch (error) {
        db.prepare('ROLLBACK').run();
        throw error;
      }
    });
  }
};

export { dbWithRetry as db };

// Initialize database tables
export function initializeDatabase() {
  try {
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        member_count INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL,
        number_of_months INTEGER NOT NULL,
        commission_percentage REAL DEFAULT 4,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        group_member_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      );

      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        collection_date TEXT NOT NULL,
        month_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (member_id) REFERENCES members(id)
      );

      CREATE TABLE IF NOT EXISTS chit_dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        chit_date TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id)
      );

      CREATE TABLE IF NOT EXISTS monthly_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        bid_amount REAL NOT NULL,
        total_dividend REAL NOT NULL,
        distributed_dividend REAL NOT NULL,
        monthly_subscription REAL NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT CHECK(role IN ('admin', 'agent')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Handle process termination
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});