import { dbPool } from './connection';
import Database from 'better-sqlite3';

// Initialize database
export async function initializeDatabase() {
  try {
    // Get a connection from the pool
    const db = dbPool.getConnection();
    
    // Create tables if they don't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        email TEXT,
        status TEXT,
        created_at TEXT,
        updated_at TEXT
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
        commission_percentage REAL,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        group_member_id TEXT NOT NULL,
        created_at TEXT,
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
        created_at TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      );

      CREATE TABLE IF NOT EXISTS chit_dates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        chit_date TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT,
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
        created_at TEXT,
        FOREIGN KEY (group_id) REFERENCES groups(id)
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        created_at TEXT
      );
    `);

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

// Export a function to get a database connection
export function getDb(): Database {
  return dbPool.getConnection();
}