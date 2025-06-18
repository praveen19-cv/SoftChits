import Database from 'better-sqlite3';
import { dbPath } from './config';

export class DatabaseConnection {
  private static instance: DatabaseConnection;
  private readPool: Database.Database[];
  private writePool: Database.Database[];
  private readIndex: number = 0;
  private writeIndex: number = 0;
  private readonly maxReadConnections: number = 20;  // More connections for reads
  private readonly maxWriteConnections: number = 5;  // Fewer connections for writes

  private constructor() {
    this.readPool = [];
    this.writePool = [];
    this.initializePools();
  }

  private initializePools() {
    // Initialize read connections
    for (let i = 0; i < this.maxReadConnections; i++) {
      const db = new Database(dbPath, {
        verbose: console.log,
        fileMustExist: false,
        readonly: true  // Read-only connections
      });

      // Configure read connections
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 30000000000');
      db.pragma('page_size = 4096');
      db.pragma('cache_size = -2000');
      db.pragma('busy_timeout = 30000');
      db.pragma('foreign_keys = ON');
      db.pragma('locking_mode = NORMAL');
      db.pragma('query_only = ON');  // Ensure read-only mode

      this.readPool.push(db);
    }

    // Initialize write connections
    for (let i = 0; i < this.maxWriteConnections; i++) {
      const db = new Database(dbPath, {
        verbose: console.log,
        fileMustExist: false
      });

      // Configure write connections
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 30000000000');
      db.pragma('page_size = 4096');
      db.pragma('cache_size = -2000');
      db.pragma('busy_timeout = 30000');
      db.pragma('foreign_keys = ON');
      db.pragma('locking_mode = NORMAL');
      db.pragma('wal_autocheckpoint = 1000');  // Checkpoint WAL every 1000 pages
      db.pragma('journal_size_limit = 1000000');  // Limit WAL size

      this.writePool.push(db);
    }
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getReadConnection(): Database.Database {
    // Round-robin connection selection for reads
    const connection = this.readPool[this.readIndex];
    this.readIndex = (this.readIndex + 1) % this.maxReadConnections;
    return connection;
  }

  public getWriteConnection(): Database.Database {
    // Round-robin connection selection for writes
    const connection = this.writePool[this.writeIndex];
    this.writeIndex = (this.writeIndex + 1) % this.maxWriteConnections;
    return connection;
  }

  public closeAllConnections() {
    // Close read connections
    for (const db of this.readPool) {
      try {
        db.close();
      } catch (error) {
        console.error('Error closing read connection:', error);
      }
    }
    this.readPool = [];

    // Close write connections
    for (const db of this.writePool) {
      try {
        db.close();
      } catch (error) {
        console.error('Error closing write connection:', error);
      }
    }
    this.writePool = [];
  }
}

export const dbPool = DatabaseConnection.getInstance(); 