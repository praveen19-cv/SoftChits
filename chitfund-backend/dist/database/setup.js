"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.setupDatabase = setupDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Ensure data directory exists
const dataDir = path_1.default.join(__dirname, '../../data');
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path_1.default.join(dataDir, 'chitfund.db');
const db = new better_sqlite3_1.default(dbPath);
// Set busy timeout to 5 seconds (5000 ms)
db.pragma('busy_timeout = 5000');
// (Optional) Enable WAL mode for better concurrency
db.pragma('journal_mode = wal');
exports.db = db;
function setupDatabase() {
    // Create tables if they don't exist
    db.exec(`
    CREATE TABLE IF NOT EXISTS members (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS chit_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      member_count INTEGER NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT CHECK(status IN ('active', 'completed', 'cancelled')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      member_id INTEGER,
      chit_group_id INTEGER,
      amount DECIMAL(10,2) NOT NULL,
      collection_date DATE NOT NULL,
      collected_by INTEGER,
      payment_mode TEXT CHECK(payment_mode IN ('cash', 'bank', 'upi')),
      status TEXT CHECK(status IN ('pending', 'completed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (member_id) REFERENCES members(id),
      FOREIGN KEY (chit_group_id) REFERENCES chit_groups(id)
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
    console.log('Database setup completed');
}
