import { getWriteDb, getReadDb } from './setup';
import { withRetry } from '../utils/dbUtils';

export interface ConsolidatedDailySummary {
  id: number;
  collection_date: string;
  total_amount: number;
  total_groups_collected: number;
  total_members_paid: number;
  created_at: string;
  updated_at: string;
}

export interface GroupDailySummary {
  group_id: number;
  group_name: string;
  total_amount: number;
  total_members_paid: number;
  collection_date: string;
}

export class ConsolidatedDailySummaryService {
  /**
   * Create the consolidated daily summary table
   */
  static async createTable(): Promise<void> {
    const db = getWriteDb();
    try {
      await withRetry(() => {
        db.prepare(`
          CREATE TABLE IF NOT EXISTS daily_collection_summary_consolidated (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            collection_date TEXT NOT NULL UNIQUE,
            total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
            total_groups_collected INTEGER NOT NULL DEFAULT 0,
            total_members_paid INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();
      });

      console.log('Created consolidated daily summary table successfully');
    } catch (error) {
      console.error('Error creating consolidated daily summary table:', error);
      throw error;
    }
  }

  /**
   * Update consolidated daily summary for a specific date
   */
  static async updateConsolidatedSummary(collectionDate: string): Promise<void> {
    const db = getWriteDb();
    try {
      // Get all groups and their daily summaries for this date
      const groups = await this.getAllGroups();
      
      let totalAmount = 0;
      let totalGroupsCollected = 0;
      let totalMembersPaid = 0;

      for (const group of groups) {
        try {
          const groupSummary = await this.getGroupDailySummary(group.id, group.name, collectionDate);
          if (groupSummary && groupSummary.total_amount > 0) {
            totalAmount += groupSummary.total_amount;
            totalGroupsCollected += 1;
            totalMembersPaid += groupSummary.total_members_paid;
          }
        } catch (error) {
          // Group might not have data for this date, continue
          console.log(`No data for group ${group.name} on ${collectionDate}`);
        }
      }

      // Update or insert consolidated summary
      await withRetry(() => {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO daily_collection_summary_consolidated 
          (collection_date, total_amount, total_groups_collected, total_members_paid, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        
        stmt.run(collectionDate, totalAmount, totalGroupsCollected, totalMembersPaid);
      });

      console.log(`Updated consolidated summary for ${collectionDate}: ₹${totalAmount} from ${totalGroupsCollected} groups`);
    } catch (error) {
      console.error('Error updating consolidated daily summary:', error);
      throw error;
    }
  }

  /**
   * Get all groups from the database
   */
  static async getAllGroups(): Promise<{ id: number; name: string }[]> {
    const db = getReadDb();
    try {
      return await withRetry(() => {
        const stmt = db.prepare('SELECT id, name FROM groups WHERE status = ?');
        return stmt.all('active') as { id: number; name: string }[];
      });
    } catch (error) {
      console.error('Error fetching groups:', error);
      return [];
    }
  }

  /**
   * Get group daily summary for a specific date
   */
  static async getGroupDailySummary(groupId: number, groupName: string, collectionDate: string): Promise<GroupDailySummary | null> {
    const db = getReadDb();
    try {
      const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const tableName = `daily_collection_summary_${groupId}_${sanitizedName}`;
      
      return await withRetry(() => {
        const stmt = db.prepare(`
          SELECT 
            group_id,
            total_amount,
            total_members_paid,
            collection_date
          FROM ${tableName} 
          WHERE collection_date = ?
        `);
        
        const result = stmt.get(collectionDate) as any;
        if (result) {
          return {
            group_id: groupId,
            group_name: groupName,
            total_amount: result.total_amount || 0,
            total_members_paid: result.total_members_paid || 0,
            collection_date: collectionDate
          };
        }
        return null;
      });
    } catch (error) {
      // Table might not exist or no data
      return null;
    }
  }

  /**
   * Get consolidated daily summary for a date range
   */
  static async getConsolidatedSummaryRange(startDate: string, endDate: string): Promise<ConsolidatedDailySummary[]> {
    const db = getReadDb();
    try {
      return await withRetry(() => {
        const stmt = db.prepare(`
          SELECT * FROM daily_collection_summary_consolidated 
          WHERE collection_date BETWEEN ? AND ?
          ORDER BY collection_date DESC
        `);
        
        return stmt.all(startDate, endDate) as ConsolidatedDailySummary[];
      });
    } catch (error) {
      console.error('Error fetching consolidated summary range:', error);
      return [];
    }
  }

  /**
   * Get consolidated daily summary for a specific date
   */
  static async getConsolidatedSummaryByDate(collectionDate: string): Promise<ConsolidatedDailySummary | null> {
    const db = getReadDb();
    try {
      return await withRetry(() => {
        const stmt = db.prepare(`
          SELECT * FROM daily_collection_summary_consolidated 
          WHERE collection_date = ?
        `);
        
        return stmt.get(collectionDate) as ConsolidatedDailySummary | null;
      });
    } catch (error) {
      console.error('Error fetching consolidated summary by date:', error);
      return null;
    }
  }

  /**
   * Rebuild consolidated summaries for all existing data
   */
  static async rebuildAllConsolidatedSummaries(): Promise<void> {
    const db = getReadDb();
    try {
      console.log('Starting consolidated summary rebuild...');
      
      // Get all unique collection dates from all group summary tables
      const groups = await this.getAllGroups();
      const allDates = new Set<string>();

      for (const group of groups) {
        try {
          const sanitizedName = group.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
          const tableName = `daily_collection_summary_${group.id}_${sanitizedName}`;
          
          const dates = await withRetry(() => {
            const stmt = db.prepare(`
              SELECT DISTINCT collection_date 
              FROM ${tableName}
              WHERE total_amount > 0
            `);
            return stmt.all() as { collection_date: string }[];
          });

          dates.forEach(d => allDates.add(d.collection_date));
        } catch (error) {
          // Table might not exist, continue
          console.log(`No summary table found for group ${group.name}`);
        }
      }

      console.log(`Found ${allDates.size} unique collection dates to process`);

      // Process each date
      let processed = 0;
      for (const date of Array.from(allDates).sort()) {
        try {
          await this.updateConsolidatedSummary(date);
          processed++;
          if (processed % 10 === 0) {
            console.log(`Processed ${processed}/${allDates.size} dates...`);
          }
        } catch (error) {
          console.error(`Error processing date ${date}:`, error);
        }
      }

      console.log(`Consolidated summary rebuild completed. Processed ${processed} dates.`);
    } catch (error) {
      console.error('Error rebuilding consolidated summaries:', error);
      throw error;
    }
  }

  /**
   * Get top collection days (for dashboard/reporting)
   */
  static async getTopCollectionDays(limit: number = 10): Promise<ConsolidatedDailySummary[]> {
    const db = getReadDb();
    try {
      return await withRetry(() => {
        const stmt = db.prepare(`
          SELECT * FROM daily_collection_summary_consolidated 
          WHERE total_amount > 0
          ORDER BY total_amount DESC
          LIMIT ?
        `);
        
        return stmt.all(limit) as ConsolidatedDailySummary[];
      });
    } catch (error) {
      console.error('Error fetching top collection days:', error);
      return [];
    }
  }

  /**
   * Get monthly consolidated totals
   */
  static async getMonthlyTotals(year: number, month: number): Promise<{
    total_amount: number;
    total_days: number;
    total_groups_average: number;
    total_members_average: number;
  }> {
    const db = getReadDb();
    try {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

      return await withRetry(() => {
        const stmt = db.prepare(`
          SELECT 
            COALESCE(SUM(total_amount), 0) as total_amount,
            COUNT(*) as total_days,
            COALESCE(AVG(total_groups_collected), 0) as total_groups_average,
            COALESCE(AVG(total_members_paid), 0) as total_members_average
          FROM daily_collection_summary_consolidated 
          WHERE collection_date BETWEEN ? AND ?
          AND total_amount > 0
        `);
        
        const result = stmt.get(startDate, endDate) as any;
        return {
          total_amount: result.total_amount || 0,
          total_days: result.total_days || 0,
          total_groups_average: result.total_groups_average || 0,
          total_members_average: result.total_members_average || 0
        };
      });
    } catch (error) {
      console.error('Error fetching monthly totals:', error);
      return {
        total_amount: 0,
        total_days: 0,
        total_groups_average: 0,
        total_members_average: 0
      };
    }
  }
}
