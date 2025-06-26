import { getWriteDb, getReadDb } from './setup';
import { withRetry } from '../utils/dbUtils';

export interface DailyCollectionSummary {
  id: number;
  collection_date: string;
  group_id: number;
  total_amount: number;
  total_members_paid: number;
  collection_agent_id: number;
  created_at: string;
  updated_at: string;
}

export class DailyCollectionSummaryService {
  /**
   * Get the daily collection summary table name for a specific group
   */
  static getTableName(groupId: number, groupName: string): string {
    if (!groupId || !groupName || isNaN(Number(groupId))) {
      console.error('Invalid groupId or groupName for daily summary table:', { groupId, groupName });
      throw new Error('Invalid groupId or groupName for daily summary table');
    }
    const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `daily_collection_summary_${groupId}_${sanitizedName}`;
  }

  /**
   * Get the collection table name for a specific group
   */
  static getCollectionTableName(groupId: number, groupName: string): string {
    if (!groupId || !groupName || isNaN(Number(groupId))) {
      console.error('Invalid groupId or groupName for collection table:', { groupId, groupName });
      throw new Error('Invalid groupId or groupName for collection table');
    }
    const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    return `collection_${groupId}_${sanitizedName}`;
  }

  /**
   * Create daily collection summary table for a group
   */
  static async createTable(groupId: number, groupName: string): Promise<void> {
    const db = getWriteDb();
    try {
      const tableName = this.getTableName(groupId, groupName);
      
      await withRetry(() => {
        db.prepare(`
          CREATE TABLE IF NOT EXISTS ${tableName} (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_date TEXT NOT NULL,
            group_id INTEGER NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            total_members_paid INTEGER NOT NULL DEFAULT 0,
            collection_agent_id INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id),
            UNIQUE(group_id, collection_date)
          )
        `).run();
      });

      console.log(`Created daily collection summary table: ${tableName}`);
    } catch (error) {
      console.error('Error creating daily collection summary table:', error);
      throw error;
    }
  }

  /**
   * Drop daily collection summary table for a group
   */
  static async dropTable(groupId: number, groupName: string): Promise<void> {
    const db = getWriteDb();
    try {
      const tableName = this.getTableName(groupId, groupName);
      
      await withRetry(() => {
        db.prepare(`DROP TABLE IF EXISTS ${tableName}`).run();
      });

      console.log(`Dropped daily collection summary table: ${tableName}`);
    } catch (error) {
      console.error('Error dropping daily collection summary table:', error);
      throw error;
    }
  }

  /**
   * Update daily collection summary for a specific date and group
   */
  static async updateSummary(groupId: number, groupName: string, collectionDate: string): Promise<void> {
    const db = getWriteDb();
    try {
      const summaryTableName = this.getTableName(groupId, groupName);
      const collectionTableName = this.getCollectionTableName(groupId, groupName);
      
      // Calculate daily totals from collections table
      const dailyStats = await withRetry(() => {
        return db.prepare(`
          SELECT 
            COALESCE(SUM(collection_amount), 0) as total_amount,
            COUNT(DISTINCT member_id) as total_members_paid
          FROM ${collectionTableName}
          WHERE collection_date = ? AND group_id = ?
        `).get(collectionDate, groupId) as { total_amount: number; total_members_paid: number };
      });

      // Check if summary already exists
      const existingSummary = await withRetry(() => {
        return db.prepare(`
          SELECT id FROM ${summaryTableName}
          WHERE collection_date = ? AND group_id = ?
        `).get(collectionDate, groupId) as { id: number } | undefined;
      });

      if (existingSummary) {
        // Update existing summary
        await withRetry(() => {
          db.prepare(`
            UPDATE ${summaryTableName}
            SET 
              total_amount = ?,
              total_members_paid = ?,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).run(dailyStats.total_amount, dailyStats.total_members_paid, existingSummary.id);
        });
      } else {
        // Insert new summary
        await withRetry(() => {
          db.prepare(`
            INSERT INTO ${summaryTableName} (
              collection_date, group_id, total_amount, total_members_paid, collection_agent_id
            ) VALUES (?, ?, ?, ?, 1)
          `).run(collectionDate, groupId, dailyStats.total_amount, dailyStats.total_members_paid);
        });
      }

      console.log(`Updated daily summary for ${groupName} on ${collectionDate}: ₹${dailyStats.total_amount} from ${dailyStats.total_members_paid} members`);
    } catch (error) {
      console.error('Error updating daily collection summary:', error);
      throw error;
    }
  }

  /**
   * Get daily collection summaries for a group
   */
  static async getSummaries(groupId: number, groupName: string, collectionDate?: string): Promise<DailyCollectionSummary[]> {
    const db = getReadDb();
    try {
      const tableName = this.getTableName(groupId, groupName);
      
      if (collectionDate) {
        // Get summary for specific date
        return await withRetry(() => {
          return db.prepare(`
            SELECT * FROM ${tableName}
            WHERE collection_date = ? AND group_id = ?
            ORDER BY collection_date DESC
          `).all(collectionDate, groupId) as DailyCollectionSummary[];
        });
      } else {
        // Get all summaries for the group
        return await withRetry(() => {
          return db.prepare(`
            SELECT * FROM ${tableName}
            WHERE group_id = ?
            ORDER BY collection_date DESC
          `).all(groupId) as DailyCollectionSummary[];
        });
      }
    } catch (error) {
      console.error('Error getting daily collection summaries:', error);
      throw error;
    }
  }

  /**
   * Get daily summaries within a date range
   */
  static async getSummariesByDateRange(
    groupId: number, 
    groupName: string, 
    startDate: string, 
    endDate: string
  ): Promise<DailyCollectionSummary[]> {
    const db = getReadDb();
    try {
      const tableName = this.getTableName(groupId, groupName);
      
      return await withRetry(() => {
        return db.prepare(`
          SELECT * FROM ${tableName}
          WHERE group_id = ? AND collection_date BETWEEN ? AND ?
          ORDER BY collection_date DESC
        `).all(groupId, startDate, endDate) as DailyCollectionSummary[];
      });
    } catch (error) {
      console.error('Error getting daily summaries by date range:', error);
      throw error;
    }
  }

  /**
   * Delete daily collection summary for a specific date
   */
  static async deleteSummary(groupId: number, groupName: string, collectionDate: string): Promise<void> {
    const db = getWriteDb();
    try {
      const tableName = this.getTableName(groupId, groupName);
      
      await withRetry(() => {
        db.prepare(`
          DELETE FROM ${tableName}
          WHERE collection_date = ? AND group_id = ?
        `).run(collectionDate, groupId);
      });

      console.log(`Deleted daily summary for ${groupName} on ${collectionDate}`);
    } catch (error) {
      console.error('Error deleting daily collection summary:', error);
      throw error;
    }
  }

  /**
   * Get monthly totals from daily summaries
   */
  static async getMonthlySummary(groupId: number, groupName: string, year: number, month: number): Promise<{
    total_amount: number;
    total_members_paid: number;
    collection_days: number;
    average_daily_amount: number;
  }> {
    const db = getReadDb();
    try {
      const tableName = this.getTableName(groupId, groupName);
      const monthStr = month.toString().padStart(2, '0');
      const yearMonth = `${year}-${monthStr}`;
      
      const result = await withRetry(() => {
        return db.prepare(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_amount,
            COALESCE(SUM(total_members_paid), 0) as total_members_paid,
            COUNT(*) as collection_days,
            COALESCE(AVG(total_amount), 0) as average_daily_amount
          FROM ${tableName}
          WHERE group_id = ? AND collection_date LIKE ?
        `).get(groupId, `${yearMonth}%`) as {
          total_amount: number;
          total_members_paid: number;
          collection_days: number;
          average_daily_amount: number;
        };
      });

      return result;
    } catch (error) {
      console.error('Error getting monthly summary:', error);
      throw error;
    }
  }

  /**
   * Rebuild daily summaries from collection data (useful for data repair)
   */
  static async rebuildSummaries(groupId: number, groupName: string): Promise<void> {
    const db = getWriteDb();
    try {
      const summaryTableName = this.getTableName(groupId, groupName);
      const collectionTableName = this.getCollectionTableName(groupId, groupName);
      
      // Clear existing summaries
      await withRetry(() => {
        db.prepare(`DELETE FROM ${summaryTableName} WHERE group_id = ?`).run(groupId);
      });

      // Get all unique collection dates
      const collectionDates = await withRetry(() => {
        return db.prepare(`
          SELECT DISTINCT collection_date
          FROM ${collectionTableName}
          WHERE group_id = ?
          ORDER BY collection_date
        `).all(groupId) as { collection_date: string }[];
      });

      console.log(`Rebuilding ${collectionDates.length} daily summaries for group ${groupName}`);

      // Rebuild each day's summary
      for (const { collection_date } of collectionDates) {
        await this.updateSummary(groupId, groupName, collection_date);
      }

      console.log(`Successfully rebuilt daily summaries for group ${groupName}`);
    } catch (error) {
      console.error('Error rebuilding daily summaries:', error);
      throw error;
    }
  }
}
