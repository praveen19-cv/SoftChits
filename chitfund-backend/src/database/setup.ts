import { dbPool } from './connection';
import Database from 'better-sqlite3';

// Transaction queue to handle concurrent access
let transactionQueue: Promise<any> = Promise.resolve();

// Configure database with busy handler
function configureDatabase(db: Database.Database) {
  // Set busy timeout to 30 seconds
  db.pragma('busy_timeout = 30000');
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Set synchronous mode to NORMAL for better performance
  db.pragma('synchronous = NORMAL');
  
  // Set temp store to memory
  db.pragma('temp_store = MEMORY');
}

// Execute transaction with queue and retry
export async function executeTransaction<T>(db: Database.Database, transactionFn: () => T): Promise<T> {
  const maxRetries = 5;
  const baseDelay = 100; // ms

  for (let i = 0; i < maxRetries; i++) {
    try {
      // Set busy timeout
      db.pragma('busy_timeout = 30000');
      
      // Begin transaction with immediate lock
      db.prepare('BEGIN IMMEDIATE').run();
      
      try {
        const result = transactionFn();
        db.prepare('COMMIT').run();
        return result;
      } catch (error) {
        db.prepare('ROLLBACK').run();
        throw error;
      }
    } catch (error: any) {
      if (error.code === 'SQLITE_BUSY' && i < maxRetries - 1) {
        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, i) * (0.5 + Math.random());
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

// Initialize database
export async function initializeDatabase() {
  const db = dbPool.getWriteConnection();
  
  try {
    // Create groups table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        total_amount REAL NOT NULL,
        member_count INTEGER NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        commission_percentage REAL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create members table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create users table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();

    // Create audit_logs table
    db.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        old_values TEXT,
        new_values TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `).run();

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

// Export interfaces
export interface Member {
  id?: number;
  name: string;
  phone?: string;
  address?: string;
  email?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Group {
  id?: number;
  name: string;
  total_amount: number;
  member_count: number;
  start_date: string;
  end_date: string;
  status: string;
  number_of_months: number;
  commission_percentage?: number;
  created_at?: string;
  updated_at?: string;
}

export interface GroupMember {
  id?: number;
  group_id: number;
  member_id: number;
  group_member_id: string;
  created_at?: string;
}

export interface Collection {
  id?: number;
  group_id: number;
  member_id: number;
  amount: number;
  collection_date: string;
  month_number: number;
  created_at?: string;
}

export interface ChitDate {
  id?: number;
  group_id: number;
  chit_date: string;
  amount: number;
  created_at?: string;
}

export interface MonthlySubscription {
  id?: number;
  group_id: number;
  month_number: number;
  bid_amount: number;
  total_dividend: number;
  distributed_dividend: number;
  monthly_subscription: number;
  created_at?: string;
}

export interface User {
  id?: number;
  name: string;
  email: string;
  password: string;
  role: string;
  created_at?: string;
}

// Export functions to get database connections
export function getReadDb() {
  const db = dbPool.getReadConnection();
  configureDatabase(db);
  return db;
}

export function getWriteDb() {
  const db = dbPool.getWriteConnection();
  configureDatabase(db);
  return db;
}