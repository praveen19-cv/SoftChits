import { getWriteDb } from '../database/setup';
import { DailyCollectionSummaryService } from '../database/dailyCollectionSummary';

export class GroupTableService {
  static getTableName(groupId: number, groupName: string, tableType: string): string {
    if (!groupId || !groupName || isNaN(Number(groupId))) {
      console.error('Invalid groupId or groupName for table creation:', { groupId, groupName, tableType });
      throw new Error('Invalid groupId or groupName for table creation');
    }
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
          collection_date TEXT NOT NULL,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          installment_number INTEGER NOT NULL,
          collection_amount DECIMAL(10,2) NOT NULL,
          remaining_balance DECIMAL(10,2) NOT NULL,
          is_completed BOOLEAN NOT NULL DEFAULT FALSE,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_remaining_balance REAL,
          FOREIGN KEY (group_id) REFERENCES groups(id),
          FOREIGN KEY (member_id) REFERENCES members(id),
          UNIQUE(group_id, member_id, installment_number, collection_date)
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
          total_paid DECIMAL(10,2) DEFAULT 0,
          remaining_balance DECIMAL(10,2) DEFAULT 0,
          is_completed BOOLEAN DEFAULT 0,
          last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          export_month INTEGER,
          is_exported BOOLEAN DEFAULT 0,
          monthly_subscription DECIMAL(10,2) DEFAULT 0
        )
      `).run();
      tables.push(collectionBalancesTableName);      // Create group members table
      const groupMembersTableName = this.getTableName(groupId, groupName, 'group_members');
      db.prepare(`
        CREATE TABLE IF NOT EXISTS ${groupMembersTableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          group_id INTEGER NOT NULL,
          member_id INTEGER NOT NULL,
          member_name TEXT NOT NULL,
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
          is_exported BOOLEAN NOT NULL DEFAULT 0,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id)
        )
      `).run();
      tables.push(monthlySubscriptionsTableName);

      // Create daily collection summary table using the dedicated service
      await DailyCollectionSummaryService.createTable(groupId, groupName);
      const dailySummaryTableName = DailyCollectionSummaryService.getTableName(groupId, groupName);
      tables.push(dailySummaryTableName);

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
      
      // Delete daily collection summary table using the dedicated service
      await DailyCollectionSummaryService.dropTable(groupId, groupName);
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
      subscriptionsTable: this.getTableName(groupId, groupName, 'monthly_subscription'),
      dailySummaryTable: this.getTableName(groupId, groupName, 'daily_collection_summary')
    };
  }

  static async ensureMemberNameColumn(groupId: number, groupName: string): Promise<void> {
    const db = getWriteDb();
    try {
      const groupMembersTableName = this.getTableName(groupId, groupName, 'group_members');
      
      // Check if member_name column exists
      const columnInfo = db.prepare(`PRAGMA table_info(${groupMembersTableName})`).all() as any[];
      const hasMemberNameColumn = columnInfo.some(col => col.name === 'member_name');
      
      if (!hasMemberNameColumn) {
        // Add member_name column
        db.prepare(`ALTER TABLE ${groupMembersTableName} ADD COLUMN member_name TEXT`).run();
        
        // Update existing records with member names
        const existingRecords = db.prepare(`
          SELECT member_id FROM ${groupMembersTableName}
        `).all() as { member_id: number }[];
        
        for (const record of existingRecords) {
          const member = db.prepare('SELECT name FROM members WHERE id = ?').get(record.member_id) as { name: string } | undefined;
          if (member) {
            db.prepare(`
              UPDATE ${groupMembersTableName} 
              SET member_name = ? 
              WHERE member_id = ?
            `).run(member.name, record.member_id);
          }
        }
      }
    } catch (error) {
      console.error('Error ensuring member_name column:', error);
      // Don't throw error for migration issues
    }
  }
}