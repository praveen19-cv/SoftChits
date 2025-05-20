import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private connections: Database[] = [];
  private currentIndex = 0;
  private readonly maxConnections = 10;
  private readonly dataDir = path.join(process.cwd(), 'data');

  private constructor() {
    // Ensure data directory exists
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Initialize connection pool
    for (let i = 0; i < this.maxConnections; i++) {
      const db = new Database(path.join(this.dataDir, 'chitfund.db'), {
        verbose: console.log,
        // Enable WAL mode for better concurrency
        fileMustExist: false,
        // Increase busy timeout to 10 seconds
        busyTimeout: 10000,
        // Configure for maximum concurrency
        pragma: {
          journal_mode: 'WAL',
          synchronous: 'NORMAL',
          temp_store: 'MEMORY',
          mmap_size: 30000000000,
          page_size: 4096,
          cache_size: -2000,
          foreign_keys: 'ON',
          // Add these pragmas for better concurrency
          locking_mode: 'NORMAL',
          busy_timeout: 10000,
          // Optimize for concurrent access
          wal_autocheckpoint: 1000,
          journal_size_limit: 1000000,
          // Cache more pages in memory
          cache_spill: 0,
          // Use memory-mapped I/O
          mmap_size: 30000000000
        }
      });

      // Configure each connection
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('temp_store = MEMORY');
      db.pragma('mmap_size = 30000000000');
      db.pragma('page_size = 4096');
      db.pragma('cache_size = -2000');
      db.pragma('foreign_keys = ON');
      db.pragma('locking_mode = NORMAL');
      db.pragma('busy_timeout = 10000');
      db.pragma('wal_autocheckpoint = 1000');
      db.pragma('journal_size_limit = 1000000');
      db.pragma('cache_spill = 0');
      db.pragma('mmap_size = 30000000000');

      this.connections.push(db);
    }
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public getConnection(): Database {
    // Round-robin connection selection
    const connection = this.connections[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.maxConnections;
    return connection;
  }

  public closeAll(): void {
    for (const connection of this.connections) {
      try {
        connection.close();
      } catch (error) {
        console.error('Error closing database connection:', error);
      }
    }
    this.connections = [];
  }
}

export const dbPool = DatabaseConnection.getInstance(); 