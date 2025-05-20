import { getDb } from '../database/setup';

export class GroupTableService {
  static getTableName(groupId: number, groupName: string, tableType: string): string {
    const cleanGroupName = groupName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `${tableType}_${groupId}_${cleanGroupName}`;
  }

  static async createGroupTables(groupId: number, groupName: string) {
    const db = getDb();
    try {
      // Create collection table
      const collectionTableName = this.getTableName(groupId, groupName, 'collection');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${collectionTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          collection_date TEXT NOT NULL,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          installment_number INTEGER NOT NULL,
          collection_amount DECIMAL(10,2) NOT NULL,
          remaining_balance DECIMAL(10,2) NOT NULL,
          is_completed BOOLEAN DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES members(id)
        )
      `).run();

      // Create collection balance table
      const balanceTableName = this.getTableName(groupId, groupName, 'collection_balance');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${balanceTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          installment_number INTEGER NOT NULL,
          total_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
          remaining_balance DECIMAL(10,2) NOT NULL,
          is_completed BOOLEAN DEFAULT FALSE,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES members(id),
          UNIQUE(group_id, member_id, installment_number)
        )
      `).run();

      // Create group members table
      const membersTableName = this.getTableName(groupId, groupName, 'group_members');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${membersTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          group_member_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
          FOREIGN KEY (member_id) REFERENCES members(id)
        )
      `).run();

      // Create chit dates table
      const chitDatesTableName = this.getTableName(groupId, groupName, 'chit_dates');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${chitDatesTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          chit_date TEXT NOT NULL,
          amount REAL NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
      `).run();

      // Create monthly subscriptions table
      const subscriptionsTableName = this.getTableName(groupId, groupName, 'monthly_subscription');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${subscriptionsTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          month_number INTEGER NOT NULL,
          bid_amount REAL NOT NULL,
          total_dividend REAL NOT NULL,
          distributed_dividend REAL NOT NULL,
          monthly_subscription REAL NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
        )
      `).run();

      return {
        collectionTable: collectionTableName,
        balanceTable: balanceTableName,
        membersTable: membersTableName,
        chitDatesTable: chitDatesTableName,
        subscriptionsTable: subscriptionsTableName
      };
    } catch (error) {
      console.error('Error creating group tables:', error);
      throw error;
    }
  }

  static async deleteGroupTables(groupId: number, groupName: string) {
    const db = getDb();
    try {
      const tableNames = [
        this.getTableName(groupId, groupName, 'collection'),
        this.getTableName(groupId, groupName, 'collection_balance'),
        this.getTableName(groupId, groupName, 'group_members'),
        this.getTableName(groupId, groupName, 'chit_dates'),
        this.getTableName(groupId, groupName, 'monthly_subscription')
      ];

      for (const tableName of tableNames) {
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