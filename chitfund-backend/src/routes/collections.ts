import express from 'express';
import { getReadDb, getWriteDb, executeTransaction, Group } from '../database/setup';
import { GroupTableService } from '../services/GroupTableService';
import Database from 'better-sqlite3';
import { dbPool } from '../database/connection';
import { withRetry } from '../utils/dbUtils';

const router = express.Router();

interface Installment {
  number: number;
  isCompleted: boolean;
}

interface ExistingPayment {
  collection_amount: number;
  remaining_balance: number;
  is_completed: number;
}

interface CollectionBalance {
  id: number;
  group_id: number;
  member_id: number;
  installment_number: number;
  total_paid: number;
  remaining_balance: number;
  is_completed: boolean;
  last_updated: string;
}

interface Balance {
  member_id: number;
  installment_number: number;
  remaining_amount: number;
}

interface GroupMember {
  member_id: number;
}

interface MonthlySubscription {
  monthly_subscription: number;
}

interface MemberBalance {
  member_name: string;
  installment_number: number;
  remaining_balance: number;
  total_paid: number;
  is_completed: number;
}

interface BalanceResponse {
  member_name: string;
  installment_number: number;
  remaining_balance: number;
  total_paid: number;
  is_completed: number;
}

// Route alias for backward compatibility
router.get('/:groupId', async (req, res, next) => {
  // Forward to the group route handler
  req.url = `/group/${req.params.groupId}`;
  next();
});

// Get all collections for a group
router.get('/group/:groupId', async (req, res) => {
  const db = getReadDb();
  try {
    const groupId = Number(req.params.groupId);
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for collections
    const collectionsTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection');

    // Fetch collections
    const collections = await withRetry(() => 
      db.prepare(`
        SELECT c.*, m.name as member_name
        FROM ${collectionsTableName} c
        JOIN members m ON c.member_id = m.id
        WHERE c.group_id = ?
        ORDER BY c.collection_date DESC
      `).all(groupId)
    );

    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Get collections by date and group
router.get('/by-date-group/:groupId/:date', async (req, res) => {
  try {
    const { groupId, date } = req.params;
    const db = getReadDb();
    
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined;
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection');
    console.log(`Using collection table: ${tableName}`);
    
    const collections = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} WHERE collection_date = ? ORDER BY created_at DESC`)
        .all(date)
    );
    
    res.json(collections);
  } catch (error: any) {
    console.error('Error fetching collections by date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collection balances for a specific group
router.get('/:groupId/balances', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const db = getReadDb();
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Use existing balance table with proper case
    const balanceTableName = `collection_balance_${groupId}_${group.name.toUpperCase()}`;
    console.log(`Using balance table: ${balanceTableName}`);

    // Check if table exists
    const tableExists = await withRetry(() => 
      db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(balanceTableName)
    );

    if (!tableExists) {
      return res.json([]); // Return empty array if table doesn't exist
    }

    // Get balances with member names and remaining balance for each installment
    const balances = await withRetry(() => 
      db.prepare(`
        SELECT 
          m.id as member_id,
          m.name as member_name,
          cb.installment_number,
          cb.remaining_balance,
          cb.total_paid,
          cb.is_completed
        FROM members m
        JOIN ${balanceTableName} cb ON m.id = cb.member_id
        WHERE cb.group_id = ?
        ORDER BY m.name, cb.installment_number
      `).all(groupId)
    );

    // Group the results by member
    const groupedBalances = balances.reduce((acc: any[], curr: any) => {
      const existingMember = acc.find(m => m.member_id === curr.member_id);
      
      if (existingMember) {
        existingMember.installments = existingMember.installments + 
          (curr.is_completed ? ',' + curr.installment_number + 'c' : ',' + curr.installment_number);
        existingMember.installment_balances = existingMember.installment_balances + 
          ', Inst-' + curr.installment_number + ': ₹' + curr.remaining_balance;
        existingMember.total_amount = (existingMember.total_amount || 0) + curr.total_paid;
      } else {
        acc.push({
          member_id: curr.member_id,
          member_name: curr.member_name,
          installments: curr.is_completed ? curr.installment_number + 'c' : curr.installment_number,
          installment_balances: 'Inst-' + curr.installment_number + ': ₹' + curr.remaining_balance,
          total_amount: curr.total_paid
        });
      }
      return acc;
    }, []);

    res.json(groupedBalances);
  } catch (error) {
    console.error('Error fetching collection balances:', error);
    res.status(500).json({ 
      error: 'Failed to fetch collection balances',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Create a new collection
router.post('/', async (req, res) => {
  const db = getWriteDb();
  try {
    const { group_id, member_id, collection_date, installment_number, collection_amount } = req.body;
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Use existing collection and balance tables with proper case
    const collectionTableName = `collection_${group_id}_${group.name.toUpperCase()}`;
    const balanceTableName = `collection_balance_${group_id}_${group.name.toUpperCase()}`;

    console.log(`Using tables: ${collectionTableName}, ${balanceTableName}`);

    // Get the current balance for this installment
    const currentBalance = await withRetry(() => 
      db.prepare(`
        SELECT remaining_balance, total_paid, is_completed
        FROM ${balanceTableName}
        WHERE group_id = ? AND member_id = ? AND installment_number = ?
      `).get(group_id, member_id, installment_number) as { remaining_balance: number; total_paid: number; is_completed: number } | undefined
    );

    if (!currentBalance) {
      return res.status(404).json({ error: 'No balance record found for this installment' });
    }

    const result = await executeTransaction(db, () => {
      // Insert into collections table
      const result = db.prepare(`
        INSERT INTO ${collectionTableName} (
          collection_date, group_id, member_id, installment_number, 
          collection_amount, remaining_balance, is_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        collection_date,
        group_id,
        member_id,
        installment_number,
        collection_amount,
        currentBalance.remaining_balance,
        currentBalance.is_completed ? 1 : 0
      );

      // Update collection balance
      const newRemainingBalance = currentBalance.remaining_balance - collection_amount;
      const isCompleted = newRemainingBalance <= 0 ? 1 : 0;

      db.prepare(`
        UPDATE ${balanceTableName}
        SET total_paid = total_paid + ?,
            remaining_balance = ?,
            is_completed = ?,
            last_updated = CURRENT_TIMESTAMP
        WHERE group_id = ? AND member_id = ? AND installment_number = ?
      `).run(
        collection_amount,
        newRemainingBalance,
        isCompleted,
        group_id,
        member_id,
        installment_number
      );

      return result;
    });

    // Get all balances for this member to show breakup
    const memberBalances = await withRetry(() => 
      db.prepare(`
        SELECT 
          m.name as member_name,
          cb.installment_number,
          cb.remaining_balance,
          cb.total_paid,
          cb.is_completed
        FROM members m
        JOIN ${balanceTableName} cb ON m.id = cb.member_id
        WHERE cb.group_id = ? AND cb.member_id = ?
        ORDER BY cb.installment_number
      `).all(group_id, member_id) as MemberBalance[]
    );

    // Format the response with breakup
    const formattedResponse = {
      member_name: memberBalances[0]?.member_name,
      installments: memberBalances.map((b: MemberBalance) => 
        b.is_completed ? `${b.installment_number}c` : b.installment_number
      ).join(','),
      total_amount: memberBalances.reduce((sum: number, b: MemberBalance) => sum + b.total_paid, 0),
      installment_balances: memberBalances.map((b: MemberBalance) => 
        `Inst-${b.installment_number}: ₹${b.remaining_balance}`
      ).join(', ')
    };

    res.status(201).json(formattedResponse);
  } catch (error: any) {
    console.error('Error creating collection:', error);
    res.status(500).json({ 
      error: 'Failed to create collection',
      details: error.message 
    });
  }
});

// Update a collection
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { group_id, collection_amount } = req.body;
    const db = getWriteDb();
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(Number(group_id), group.name, 'collection');
    const balanceTableName = GroupTableService.getTableName(group_id, group.name, 'collection_balance');

    // Get the current collection with retry
    const currentCollection = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as { collection_amount: number; member_id: number; installment_number: number } | undefined
    );

    if (!currentCollection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    // Calculate the difference in amount
    const amountDifference = collection_amount - currentCollection.collection_amount;

    await executeTransaction(db, () => {
      // Update collection
      db.prepare(`
        UPDATE ${tableName} 
        SET collection_amount = ?,
            remaining_balance = remaining_balance + ?,
            is_completed = remaining_balance + ? <= 0
        WHERE id = ?
      `).run(
        collection_amount,
        amountDifference,
        amountDifference,
        id
      );

      // Update collection balance
      db.prepare(`
        UPDATE ${balanceTableName}
        SET total_paid = total_paid + ?,
            remaining_balance = remaining_balance - ?,
            is_completed = remaining_balance - ? <= 0,
            last_updated = CURRENT_TIMESTAMP
        WHERE group_id = ? AND member_id = ? AND installment_number = ?
      `).run(
        amountDifference,
        amountDifference,
        amountDifference,
        group_id,
        currentCollection.member_id,
        currentCollection.installment_number
      );
    });

    res.json({ message: 'Collection updated successfully' });
  } catch (error: any) {
    console.error('Error updating collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a collection
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const group_id = Number(req.query.group_id);
    const db = getWriteDb();
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(Number(group_id), group.name, 'collection');
    const balanceTableName = GroupTableService.getTableName(group_id, group.name, 'collection_balance');

    // Get the collection to be deleted with retry
    const collection = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as { collection_amount: number; member_id: number; installment_number: number } | undefined
    );

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    await executeTransaction(db, () => {
      // Delete the collection
      db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);

      // Update collection balance
      db.prepare(`
        UPDATE ${balanceTableName}
        SET total_paid = total_paid - ?,
            remaining_balance = remaining_balance + ?,
            is_completed = false,
            last_updated = CURRENT_TIMESTAMP
        WHERE group_id = ? AND member_id = ? AND installment_number = ?
      `).run(
        collection.collection_amount,
        collection.collection_amount,
        group_id,
        collection.member_id,
        collection.installment_number
      );
    });

    res.json({ message: 'Collection deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create table for a new group
router.post('/:tableName/create-table', async (req, res) => {
  try {
    const { tableName } = req.params;
    const groupId = parseInt(tableName.split('_')[1]);
    const groupName = tableName.split('_').slice(2).join('_');
    
    await GroupTableService.createGroupTables(groupId, groupName);
    res.status(201).json({ message: 'Collection tables created successfully' });
  } catch (error) {
    console.error('Error creating collection tables:', error);
    res.status(500).json({ error: 'Failed to create collection tables' });
  }
});

// Helper function to ensure table has required columns
async function ensureTableColumns(db: Database.Database, tableName: string) {
  try {
    // Use write connection for table alterations
    const writeDb = dbPool.getWriteConnection();
    
    // Check if export_month column exists
    const hasExportMonth = await withRetry(() => 
      writeDb.prepare(`
        SELECT name FROM pragma_table_info(?) 
        WHERE name = 'export_month'
      `).get(tableName)
    );

    if (!hasExportMonth) {
      await withRetry(() => 
        writeDb.prepare(`
          ALTER TABLE ${tableName}
          ADD COLUMN export_month INTEGER
        `).run()
      );
    }

    // Check if is_exported column exists
    const hasIsExported = await withRetry(() => 
      writeDb.prepare(`
        SELECT name FROM pragma_table_info(?) 
        WHERE name = 'is_exported'
      `).get(tableName)
    );

    if (!hasIsExported) {
      await withRetry(() => 
        writeDb.prepare(`
          ALTER TABLE ${tableName}
          ADD COLUMN is_exported BOOLEAN NOT NULL DEFAULT 0
        `).run()
      );
    }
  } catch (error) {
    console.error('Error ensuring table columns:', error);
    throw error;
  }
}

// Get next month payout status
router.get('/group/:groupId/next-month-status/:month', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const groupId = Number(req.params.groupId);
    const month = Number(req.params.month);

    if (isNaN(groupId) || isNaN(month)) {
      return res.status(400).json({ error: 'Invalid group ID or month' });
    }

    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name
    const balanceTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection_balance');

    // First check if the table exists
    const tableExists = await withRetry(() => 
      db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(balanceTableName)
    );

    if (!tableExists) {
      return res.json({ isExported: false });
    }

    // Ensure table has required columns
    await ensureTableColumns(db, balanceTableName);

    // Check if any entries are exported for the month
    const result = await withRetry(() => 
      db.prepare(`
        SELECT COUNT(*) as count
        FROM ${balanceTableName}
        WHERE group_id = ? AND export_month = ? AND is_exported = 1
      `).get(groupId, month) as { count: number }
    );

    res.json({ isExported: result.count > 0 });
  } catch (error) {
    console.error('Error checking next month status:', error);
    res.status(500).json({ error: 'Failed to check next month status' });
  }
});

// Export next month payout
router.post('/group/:groupId/export-month/:month', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const groupId = Number(req.params.groupId);
    const month = Number(req.params.month);

    if (isNaN(groupId) || isNaN(month)) {
      return res.status(400).json({ error: 'Invalid group ID or month' });
    }

    console.log(`Starting export for group ${groupId}, month ${month}`);

    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      console.error(`Group not found: ${groupId}`);
      return res.status(404).json({ error: 'Group not found' });
    }

    console.log(`Found group: ${group.name}`);

    // Get the dynamic table names
    const balanceTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection_balance');
    const groupMembersTableName = GroupTableService.getTableName(Number(groupId), group.name, 'group_members');
    console.log(`Using balance table: ${balanceTableName}`);
    console.log(`Using group members table: ${groupMembersTableName}`);

    // First check if the table exists
    const tableExists = await withRetry(() => 
      db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(balanceTableName)
    );

    if (!tableExists) {
      console.log(`Creating new table: ${balanceTableName}`);
      // Create the table if it doesn't exist
      await GroupTableService.createGroupTables(groupId, group.name);
    } else {
      console.log(`Table exists, ensuring columns`);
      // Ensure table has required columns
      await ensureTableColumns(db, balanceTableName);
    }

    // Get all members for this group
    const members = await withRetry(() => 
      db.prepare(`
        SELECT m.id as member_id
        FROM members m
        JOIN ${groupMembersTableName} gm ON m.id = gm.member_id
        WHERE gm.group_id = ?
      `).all(groupId) as GroupMember[]
    );

    if (!members.length) {
      console.error(`No members found for group ${groupId}`);
      return res.status(404).json({ error: 'No members found for this group' });
    }

    console.log(`Found ${members.length} members`);

    // Get monthly subscription amount
    const monthlySubscription = await withRetry(() => 
      db.prepare(`
        SELECT monthly_subscription
        FROM ${GroupTableService.getTableName(groupId, group.name, 'monthly_subscription')}
        WHERE month_number = ?
      `).get(month) as MonthlySubscription | undefined
    );

    if (!monthlySubscription) {
      console.error(`Monthly subscription not found for month ${month}`);
      return res.status(404).json({ error: 'Monthly subscription not found for this month' });
    }

    console.log(`Found monthly subscription: ${monthlySubscription.monthly_subscription}`);

    // Create or update balances for all members
    await executeTransaction(db, () => {
      for (const member of members) {
        try {
          // Check if balance already exists
          const existingBalance = db.prepare(`
            SELECT id FROM ${balanceTableName}
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
          `).get(groupId, member.member_id, month);

          if (existingBalance) {
            console.log(`Updating existing balance for member ${member.member_id}`);
            // Update existing balance
            db.prepare(`
              UPDATE ${balanceTableName}
              SET export_month = ?,
                  is_exported = 1,
                  last_updated = CURRENT_TIMESTAMP
              WHERE group_id = ? 
              AND member_id = ? 
              AND installment_number = ?
            `).run(month, groupId, member.member_id, month);
          } else {
            console.log(`Creating new balance for member ${member.member_id}`);
            // Insert new balance
            db.prepare(`
              INSERT INTO ${balanceTableName} (
                group_id, member_id, installment_number,
                total_paid, remaining_balance, is_completed,
                export_month, is_exported
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              groupId,
              member.member_id,
              month,
              0, // total_paid
              monthlySubscription.monthly_subscription, // remaining_balance
              0, // is_completed
              month, // export_month
              1 // is_exported
            );
          }
        } catch (error) {
          console.error(`Error processing member ${member.member_id}:`, error);
          throw error;
        }
      }
    });

    console.log(`Successfully exported month ${month} for group ${groupId}`);
    res.json({ message: 'Month payout exported successfully' });
  } catch (error) {
    console.error('Error exporting month payout:', error);
    res.status(500).json({ 
      error: 'Failed to export month payout',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Reset next month payout
router.post('/group/:groupId/reset-next-month', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const groupId = Number(req.params.groupId);
    const month = Number(req.body.month);

    if (isNaN(groupId) || isNaN(month)) {
      return res.status(400).json({ error: 'Invalid group ID or month' });
    }

    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name
    const balanceTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection_balance');

    // Reset export status for the specified month
    await withRetry(() => 
      db.prepare(`
        UPDATE ${balanceTableName}
        SET export_month = NULL,
            is_exported = 0
        WHERE group_id = ? AND export_month = ?
      `).run(groupId, month)
    );

    res.json({ message: 'Next month payout reset successfully' });
  } catch (error) {
    console.error('Error resetting next month payout:', error);
    res.status(500).json({ error: 'Failed to reset next month payout' });
  }
});

export default router; 