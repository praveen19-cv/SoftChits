import { getWriteDb } from '../database/setup';

export class GroupTableService {
  static getTableName(groupId: number, groupName: string, tableType: string): string {
    const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `${tableType}_${groupId}_${sanitizedName}`;
  }

  static async createGroupTables(groupId: number, groupName: string): Promise<string[]> {
    const db = getWriteDb();
    const tables: string[] = [];

    try {
      // Create collections table
      const collectionsTableName = this.getTableName(groupId, groupName, 'collection');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${collectionsTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          collection_date TEXT NOT NULL,
          month_number INTEGER NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (member_id) REFERENCES members(id)
        )
      `).run();
      tables.push(collectionsTableName);

      // Create collection balances table
      const collectionBalancesTableName = this.getTableName(groupId, groupName, 'collection_balance');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${collectionBalancesTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          installment_number INTEGER NOT NULL,
          total_paid REAL NOT NULL DEFAULT 0,
          remaining_balance REAL NOT NULL DEFAULT 0,
          is_completed BOOLEAN NOT NULL DEFAULT 0,
          export_month INTEGER,
          is_exported BOOLEAN NOT NULL DEFAULT 0,
          last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (member_id) REFERENCES members(id),
          UNIQUE(group_id, member_id, installment_number)
        )
      `).run();
      tables.push(collectionBalancesTableName);

      // Create group members table
      const groupMembersTableName = this.getTableName(groupId, groupName, 'group_members');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${groupMembersTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          group_member_id TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (member_id) REFERENCES members(id)
        )
      `).run();
      tables.push(groupMembersTableName);

      // Create chit dates table
      const chitDatesTableName = this.getTableName(groupId, groupName, 'chit_dates');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${chitDatesTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          chit_date TEXT NOT NULL,
          amount REAL NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id)
        )
      `).run();
      tables.push(chitDatesTableName);

      // Create monthly subscriptions table
      const monthlySubscriptionsTableName = this.getTableName(groupId, groupName, 'monthly_subscription');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${monthlySubscriptionsTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          month_number INTEGER NOT NULL,
          bid_amount REAL NOT NULL,
          total_dividend REAL NOT NULL,
          distributed_dividend REAL NOT NULL,
          monthly_subscription REAL NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id)
        )
      `).run();
      tables.push(monthlySubscriptionsTableName);

      return tables;
    } catch (error) {
      console.error('Error creating group tables:', error);
      throw error;
    }
  }

  static async deleteGroupTables(groupId: number, groupName: string): Promise<void> {
    const db = getWriteDb();
    try {
      const tableTypes = ['collection', 'collection_balance', 'group_members', 'chit_dates', 'monthly_subscription'];
      
      for (const tableType of tableTypes) {
        const tableName = this.getTableName(groupId, groupName, tableType);
        db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
      }
    } catch (error) {
      console.error('Error deleting group tables:', error);
      throw error;
    }
  }

  static getGroupTableNames(groupId: number, groupName: string) {
    return {
      collectionTable: this.getTableName(groupId, groupName, 'collection'),
      balanceTable: this.getTableName(groupId, groupName, 'collection_balance'),
      membersTable: this.getTableName(groupId, groupName, 'group_members'),
      chitDatesTable: this.getTableName(groupId, groupName, 'chit_dates'),
      subscriptionsTable: this.getTableName(groupId, groupName, 'monthly_subscription')
    };
  }
} 