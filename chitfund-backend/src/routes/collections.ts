import express from 'express';
import { getReadDb, getWriteDb, executeTransaction, Group } from '../database/setup';
import { GroupTableService } from '../services/GroupTableService';
import { DailyCollectionSummaryService } from '../database/dailyCollectionSummary';
import { Database as BetterSqliteDatabase } from 'better-sqlite3';
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
  is_completed: number;
  total_paid: number;
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
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
    if (!group) {
      console.error(`Group not found for ID: ${groupId}`);
      return res.status(404).json({ error: 'Group not found' });
    }
    const tableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection');
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(tableName);

    if (!tableExists) {
      console.error(`Table does not exist: ${tableName}`);
      return res.status(404).json({ error: 'Table not found' });
    }
    try {
      const collections = await withRetry(() => 
        db.prepare(`SELECT * FROM ${tableName} WHERE collection_date = ? ORDER BY created_at DESC`)
          .all(date)
      );
      res.json(collections);
    } catch (queryError) {
      console.error(`Error executing query on table ${tableName}:`, queryError);
      res.status(500).json({ error: 'Failed to execute query', details: queryError instanceof Error ? queryError.message : String(queryError) });
    }
  } catch (error: any) {
    console.error('Error fetching collections by date:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collections by table name and date
router.get('/by-table-date/:tableName/:date', async (req, res) => {
  try {
    const { tableName, date } = req.params;
    const db = getReadDb();

    const collections = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} WHERE collection_date = ? ORDER BY created_at DESC`)
        .all(date)
    );

    res.json(collections);
  } catch (error: any) {
    console.error('Error fetching collections by table name and date:', error);
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
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');
    

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
    const { group_id, member_id, collection_date, installment_number, collection_amount, allow_excess } = req.body;

    const groupId = parseInt(group_id, 10);
    const memberId = parseInt(member_id, 10);
    let installmentNum = parseInt(installment_number, 10);
    let amount = parseFloat(collection_amount);
    if (isNaN(groupId) || isNaN(memberId) || isNaN(installmentNum)) {
      return res.status(400).json({ error: 'Invalid ID values' });
    }
    if (isNaN(amount) || amount < 0) {
      return res.status(400).json({ error: 'Invalid collection amount' });
    }
    const group = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const collectionTableName = GroupTableService.getTableName(groupId, group.name, 'collection');
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');
    
    
    
    // Debug: Check what balance records exist for this member
    try {
      const allBalances = db.prepare(`
        SELECT * FROM ${balanceTableName}
        WHERE group_id = ? AND member_id = ?
        ORDER BY installment_number
      `).all(groupId, memberId);
    } catch (balanceError: any) {
      console.log('Error checking balance records:', balanceError?.message || balanceError);
    }
    
    let remainingAmount = amount;
    let currentInstallment = installmentNum;
    let affectedInstallments: {installment: number, paid: number}[] = [];
    
    await executeTransaction(db, () => {
      // If allow_excess is true, apply the full amount to the specific installment only (no auto-distribution)
      if (allow_excess) {
        // Get the current balance for this specific installment
        const currentBalance = db.prepare(`
          SELECT remaining_balance, total_paid, is_completed
          FROM ${balanceTableName}
          WHERE group_id = ? AND member_id = ? AND installment_number = ?
        `).get(groupId, memberId, currentInstallment) as { remaining_balance: number; total_paid: number; is_completed: number } | undefined;

        if (!currentBalance) {
          console.log(`No balance found for installment ${currentInstallment}`);
          return;
        }

        // Apply the full amount to this installment only, even if it creates excess
        // The excess amount stays with this installment as negative remaining_balance
        const payAmount = amount;
        const newRemainingBalance = currentBalance.remaining_balance - payAmount;
        // Mark as completed ONLY when remaining balance is exactly 0
        const isCompleted = newRemainingBalance === 0 ? 1 : 0;
        // Check if a collection already exists for this combination
        const existingCollection = db.prepare(`
          SELECT id, collection_amount FROM ${collectionTableName}
          WHERE group_id = ? AND member_id = ? AND installment_number = ? AND collection_date = ?
        `).get(groupId, memberId, currentInstallment, collection_date) as { id: number; collection_amount: number } | undefined;

        if (existingCollection) {
          // Update existing collection instead of inserting
          db.prepare(`
            UPDATE ${collectionTableName}
            SET collection_amount = ?,
                updated_remaining_balance = ?,
                is_completed = ?
            WHERE id = ?
          `).run(payAmount, newRemainingBalance, isCompleted, existingCollection.id);
        } else {
          // Insert new collection record
          db.prepare(`
            INSERT INTO ${collectionTableName} (
              collection_date, group_id, member_id, installment_number, 
              collection_amount, remaining_balance, is_completed, updated_remaining_balance
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            collection_date,
            groupId,
            memberId,
            currentInstallment,
            payAmount,
            currentBalance.remaining_balance,
            isCompleted,
            newRemainingBalance
          );
        }

        // Update collection balance
        if (existingCollection) {
          // For existing collections, we need to adjust the total_paid correctly
          const oldAmount = existingCollection.collection_amount;
          const newTotalPaid = currentBalance.total_paid - oldAmount + payAmount;
          
          db.prepare(`
            UPDATE ${balanceTableName}
            SET total_paid = ?,
                remaining_balance = ?,
                is_completed = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
          `).run(
            newTotalPaid,
            newRemainingBalance,
            isCompleted,
            groupId,
            memberId,
            currentInstallment
          );
        } else {
          // For new collections, just add the amount
          db.prepare(`
            UPDATE ${balanceTableName}
            SET total_paid = total_paid + ?,
                remaining_balance = ?,
                is_completed = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
          `).run(
            payAmount,
            newRemainingBalance,
            isCompleted,
            groupId,
            memberId,
            currentInstallment
          );
        }

        affectedInstallments.push({installment: currentInstallment, paid: payAmount});
        remainingAmount = 0; // All amount applied to this specific installment ONLY
      } else {
        // Original sequential distribution logic
        while (remainingAmount > 0) {
          // Get the current balance for this installment
          const currentBalance = db.prepare(`
            SELECT remaining_balance, total_paid, is_completed
            FROM ${balanceTableName}
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
          `).get(groupId, memberId, currentInstallment) as { remaining_balance: number; total_paid: number; is_completed: number } | undefined;
          
          if (!currentBalance) {
            console.log(`Stopping: no balance found for installment ${currentInstallment}`);
            // If no more installments, stop
            break;
          }
          
          if (currentBalance.is_completed) {
            console.log(`Skipping completed installment ${currentInstallment}, moving to next`);
            // Skip completed installments and continue to next
            currentInstallment++;
            continue;
          }
          
          const payAmount = Math.min(remainingAmount, currentBalance.remaining_balance);
          const newRemainingBalance = currentBalance.remaining_balance - payAmount;
          const isCompleted = newRemainingBalance === 0 ? 1 : 0; // Complete ONLY when exactly 0
          
          // Check if a collection already exists for this combination
          const existingCollection = db.prepare(`
            SELECT id FROM ${collectionTableName}
            WHERE group_id = ? AND member_id = ? AND installment_number = ? AND collection_date = ?
          `).get(groupId, memberId, currentInstallment, collection_date) as { id: number } | undefined;
          
          if (existingCollection) {
            // Update existing collection instead of inserting
            db.prepare(`
              UPDATE ${collectionTableName}
              SET collection_amount = collection_amount + ?,
                  updated_remaining_balance = ?,
                  is_completed = ?
              WHERE id = ?
            `).run(payAmount, newRemainingBalance, isCompleted, existingCollection.id);
          } else {
            // Insert new collection record
            db.prepare(`
              INSERT INTO ${collectionTableName} (
                collection_date, group_id, member_id, installment_number, 
                collection_amount, remaining_balance, is_completed, updated_remaining_balance
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              collection_date,
              groupId,
              memberId,
              currentInstallment,
              payAmount,
              currentBalance.remaining_balance,
              isCompleted,
              newRemainingBalance
            );
          }
          
          // Update collection balance
          db.prepare(`
            UPDATE ${balanceTableName}
            SET total_paid = total_paid + ?,
                remaining_balance = ?,
                is_completed = ?,
                last_updated = CURRENT_TIMESTAMP
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
          `).run(
            payAmount,
            newRemainingBalance,
            isCompleted,
            groupId,
            memberId,
            currentInstallment
          );
          
          affectedInstallments.push({installment: currentInstallment, paid: payAmount});
          remainingAmount -= payAmount;
          currentInstallment++;
        }
      }
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
      `).all(groupId, memberId) as MemberBalance[]
    );
    const formattedResponse = {
      member_name: memberBalances[0]?.member_name,
      installments: memberBalances.map((b: MemberBalance) =>
        b.is_completed ? `${b.installment_number}c` : b.installment_number
      ).join(','),
      total_amount: memberBalances.reduce((sum: number, b: MemberBalance) => sum + b.total_paid, 0),
      installment_balances: memberBalances.map((b: MemberBalance) =>
        `Inst-${b.installment_number}: ₹${b.remaining_balance}`
      ).join(', '),
      affectedInstallments
    };
    
    // Update daily collection summary
    try {
      await DailyCollectionSummaryService.updateSummary(groupId, group.name, collection_date);
    } catch (summaryError) {
      console.error('Error updating daily collection summary:', summaryError);
      // Don't fail the entire operation if summary update fails
    }
    
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
            updated_remaining_balance = updated_remaining_balance + ?,
            is_completed = CASE WHEN updated_remaining_balance + ? = 0 THEN 1 ELSE 0 END
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
            is_completed = CASE WHEN remaining_balance - ? = 0 THEN 1 ELSE 0 END,
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
      db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id) as { collection_amount: number; member_id: number; installment_number: number; collection_date: string } | undefined
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
            is_completed = 0,
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

    // Update daily collection summary
    try {
      await DailyCollectionSummaryService.updateSummary(group_id, group.name, collection.collection_date);
    } catch (summaryError) {
      console.error('Error updating daily collection summary after deletion:', summaryError);
      // Don't fail the entire operation if summary update fails
    }

    res.json({ message: 'Collection deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create table for a new group (now using groupId only)
router.post('/:groupId/create-table', async (req, res) => {
  try {
    const groupId = parseInt(req.params.groupId);
    if (!groupId || isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid groupId' });
    }
    const db = getWriteDb();
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as any;
    if (!group || !group.name) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const groupName = group.name;
    await GroupTableService.createGroupTables(groupId, groupName);
    res.status(201).json({ message: 'Collection tables created successfully' });
  } catch (error) {
    console.error('Error creating collection tables:', error);
    res.status(500).json({ error: 'Failed to create collection tables' });
  }
});

// Ensure the correct schema for new collection_balance tabl

// Example usage in routes
router.post('/create-balance-table', async (req, res) => {
  const db = getWriteDb();
  const { group_id, group_name } = req.body;

  try {
    const balanceTableName = GroupTableService.getTableName(group_id, group_name, 'collection_balance');
    res.status(201).json({ message: 'Balance table created successfully.' });
  } catch (error) {
    console.error('Error creating balance table:', error);
    res.status(500).json({ error: 'Failed to create balance table.' });
  }
});

// Helper function to ensure table has required columns
async function ensureTableColumns(db: BetterSqliteDatabase, tableName: string) {
  try {
    // Use write connection for table alterations
    const writeDb = dbPool.getWriteConnection();
    
    // Check if export_month column exists
    const hasExportMonth = await withRetry(() => 
      writeDb.prepare(`
        SELECT name, type FROM pragma_table_info(?) 
        WHERE name = 'export_month'
      `).get(tableName) as {name: string, type: string} | undefined
    );

    if (!hasExportMonth) {
      await withRetry(() => 
        writeDb.prepare(`
          ALTER TABLE ${tableName}
          ADD COLUMN export_month NUMBER
        `).run()
      );
    } else if (hasExportMonth.type !== 'NUMBER') {
      // Get all column definitions
      const columns = await withRetry(() => 
        writeDb.prepare(`PRAGMA table_info(${tableName})`).all() as {name: string, type: string}[]
      );
      
      // Create temporary table with correct column types
      await withRetry(() => 
        writeDb.prepare(`
          CREATE TABLE ${tableName}_temp (
            ${columns.map(col => {
              if (col.name === 'export_month') {
                return `${col.name} NUMBER`;
              }
              return `${col.name} ${col.type}`;
            }).join(', ')}
          )
        `).run()
      );
      
      // Copy data
      await withRetry(() => 
        writeDb.prepare(`
          INSERT INTO ${tableName}_temp
          SELECT * FROM ${tableName}
        `).run()
      );
      
      // Drop old table
      await withRetry(() => 
        writeDb.prepare(`DROP TABLE ${tableName}`).run()
      );
      
      // Rename temp table
      await withRetry(() => 
        writeDb.prepare(`ALTER TABLE ${tableName}_temp RENAME TO ${tableName}`).run()
      );
      
      console.log(`Updated export_month column type to NUMBER`);
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

    // Get the dynamic table name for monthly_subscription
    const monthlySubscriptionTable = GroupTableService.getTableName(Number(groupId), group.name, 'monthly_subscription');
    // First check if the table exists
    const tableExists = await withRetry(() => 
      db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(monthlySubscriptionTable)
    );

    if (!tableExists) {
      console.log(`Table ${monthlySubscriptionTable} does not exist`);
      return res.json({ isExported: false });
    }

    // Check if monthly_subscription record exists for this month
    const msRecord = await withRetry(() => 
      db.prepare(`
        SELECT is_exported
        FROM ${monthlySubscriptionTable}
        WHERE group_id = ? AND month_number = ?
      `).get(groupId, month) as { is_exported: number } | undefined
    );

    if (!msRecord) {
      console.log(`No monthly subscription record found for group ${groupId}, month ${month}`);
      return res.json({ isExported: false });
    }
    // Return true if is_exported is 1
    res.json({ isExported: msRecord.is_exported === 1 });

  } catch (error) {
    console.error('Error checking next month status:', error);
    res.status(500).json({ error: 'Failed to check next month status' });
  }
});

// Export next month payout
router.post('/group/:groupId/export-month/:month', async (req, res) => {
  const db = getWriteDb();
  try {
    const groupId = Number(req.params.groupId);
    const month = Number(req.params.month);
    const { monthly_subscription } = req.body;

    console.log('Export request received:', { groupId, month, monthly_subscription, body: req.body });
    
    if (isNaN(groupId) || isNaN(month) || monthly_subscription === undefined || monthly_subscription === null || isNaN(Number(monthly_subscription))) {
      return res.status(400).json({ error: 'Invalid group ID, month, or missing monthly subscription' });
    }
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      console.error(`Group not found: ${groupId}`);
      return res.status(404).json({ error: 'Group not found' });
    }

    // Verify that group has members before continuing
    if (!group.member_count || group.member_count === 0) {
      console.error(`Group has no members: ${groupId}`);
      return res.status(400).json({ 
        error: 'No members in group', 
        message: 'This group has no members. Please add members to the group before exporting.' 
      });
    }
    
    // Get the dynamic table names
    const groupMembersTableName = GroupTableService.getTableName(Number(groupId), group.name, 'group_members');
    
    // Count actual members in the group_members table
    const membersQuery = `SELECT COUNT(*) as count FROM ${groupMembersTableName} WHERE group_id = ?`;
    const memberCount = await withRetry(() => 
      db.prepare(membersQuery).get(groupId) as { count: number }
    );
    
    const reportedMemberCount = group.member_count || 0;
    const actualMemberCount = memberCount?.count || 0;
    
    // Verify that the group's member_count matches actual members in group_members table
    if (reportedMemberCount !== actualMemberCount) {
      console.error(`Group member count mismatch: reported=${reportedMemberCount}, actual=${actualMemberCount} for group ${groupId}`);
      return res.status(400).json({
        error: 'Member count mismatch',
        message: `Member count mismatch: ${reportedMemberCount} in groups table vs ${actualMemberCount} actual members. Please verify all members are properly added before exporting.`
      });
    }

    // Get the rest of the dynamic table names
    const monthlySubscriptionTable = GroupTableService.getTableName(Number(groupId), group.name, 'monthly_subscription');
    const balanceTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection_balance');

    // Execute all updates in a transaction
    await executeTransaction(db, async () => {
      // 1. Get group members
      const members = await withRetry(() => 
        db.prepare(`
          SELECT gm.member_id, gm.member_name 
          FROM ${groupMembersTableName} gm
          WHERE gm.group_id = ?
        `).all(groupId) as { member_id: number, member_name: string }[]
      );

      if (!members.length) {
        console.error(`No members found in group members table for group ${groupId}`);
        throw new Error('No members found in this group. Please add members to the group before exporting.');
      }


      // Check if entry exists first
      const existingMS = await withRetry(() => 
        db.prepare(`
          SELECT id 
          FROM ${monthlySubscriptionTable}
          WHERE group_id = ? AND month_number = ?
        `).get(groupId, month)
      );
      
      
      if (existingMS) {
        // Update existing entry
        const updateMSResult = await withRetry(() => 
          db.prepare(`
            UPDATE ${monthlySubscriptionTable}
            SET is_exported = 1,
                monthly_subscription = ?
            WHERE group_id = ? AND month_number = ?
          `).run(monthly_subscription, groupId, month)
        );

        // Immediately check the row after update
        const msCheck = await withRetry(() =>
          db.prepare(`
            SELECT * FROM ${monthlySubscriptionTable}
            WHERE group_id = ? AND month_number = ?
          `).get(groupId, month)
        );

        // If update did not affect any rows, force an insert
        if (updateMSResult.changes === 0) {
          console.log('Update did not affect any rows, forcing insert.');
          await withRetry(() =>
            db.prepare(`
              INSERT INTO ${monthlySubscriptionTable} (
                group_id, month_number, bid_amount, total_dividend, 
                distributed_dividend, monthly_subscription, is_exported
              ) VALUES (?, ?, 0, 0, 0, ?, 1)
            `).run(groupId, month, monthly_subscription)
          );
          const msCheckAfterInsert = await withRetry(() =>
            db.prepare(`
              SELECT * FROM ${monthlySubscriptionTable}
              WHERE group_id = ? AND month_number = ?
            `).get(groupId, month)
          );
        }
      } else {
        // Insert new entry
        await withRetry(() => 
          db.prepare(`
            INSERT INTO ${monthlySubscriptionTable} (
              group_id, month_number, bid_amount, total_dividend, 
              distributed_dividend, monthly_subscription, is_exported
            ) VALUES (?, ?, 0, 0, 0, ?, 1)
          `).run(groupId, month, monthly_subscription)
        );
        console.log(`Inserted new row in monthly subscription table for month ${month}`);
      }

      // DEBUG: Print all rows for this group after update/insert
      const allRowsAfter = await withRetry(() =>
        db.prepare(`SELECT * FROM ${monthlySubscriptionTable} WHERE group_id = ? ORDER BY month_number`).all(groupId)
      );

      // 3. First delete any existing collection_balance entries for this month
      const deleteResult = await withRetry(() => 
        db.prepare(`
          DELETE FROM ${balanceTableName}
          WHERE group_id = ? AND installment_number = ?
        `).run(groupId, month)
      );
      
      // 4. Create new collection balance entries for each member
      for (const member of members) {
        await withRetry(() => 
          db.prepare(`
            INSERT INTO ${balanceTableName} (
              group_id, member_id, installment_number,
              total_paid, remaining_balance, is_completed,
              is_exported, export_month, last_updated, monthly_subscription
            ) VALUES (?, ?, ?, 0, ?, 0, 1, ?, CURRENT_TIMESTAMP, ?)
          `).run(groupId, member.member_id, month, monthly_subscription, month, monthly_subscription)
        );
      }

      // 5. Verify the updates
      const msVerifyResult = await withRetry(() => 
        db.prepare(`
          SELECT is_exported, monthly_subscription
          FROM ${monthlySubscriptionTable}
          WHERE group_id = ? AND month_number = ?
        `).get(groupId, month) as { is_exported: number, monthly_subscription: number } | undefined
      );

      if (!msVerifyResult || msVerifyResult.is_exported !== 1) {
        throw new Error('Failed to update monthly subscription is_exported flag');
      }

      // Verify collection balance entries
      const balanceVerifyResult = await withRetry(() => 
        db.prepare(`
          SELECT COUNT(*) as count
          FROM ${balanceTableName}
          WHERE group_id = ? 
            AND installment_number = ? 
            AND is_exported = 1 
            AND export_month = ?
        `).get(groupId, month, month) as { count: number }
      );

      if (balanceVerifyResult.count !== members.length) {
        throw new Error('Failed to update all collection balance entries');
      }
    });

    res.json({ success: true, message: 'Month exported successfully' });
  } catch (error: any) {
    console.error('Error in export endpoint:', error);
    console.error('Error stack:', error.stack);
    console.error('Request params:', { groupId: req.params.groupId, month: req.params.month });
    console.error('Request body:', req.body);
    res.status(500).json({ error: error.message || 'Failed to export month' });
  }
});

// Reset next month payout
router.post('/group/:groupId/reset-next-month', async (req, res) => {
  const db = getWriteDb();
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

    // Get the dynamic table names
    const monthlySubscriptionTable = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');

    // Execute all updates in a transaction
    await executeTransaction(db, async () => {
      // 1. First verify tables exist
      const tables = await withRetry(() => 
        db.prepare(`
          SELECT name FROM sqlite_master 
          WHERE type='table' AND (name = ? OR name = ?)
        `).all(monthlySubscriptionTable, balanceTableName) as { name: string }[]
      );
      
      if (tables.length !== 2) {
        throw new Error(`Missing required tables. Found: ${tables.map(t => t.name).join(', ')}`);
      }

      // 2. Update is_exported in monthly subscription table
      const updateMSResult = await withRetry(() => 
        db.prepare(`
          UPDATE ${monthlySubscriptionTable}
          SET is_exported = 0
          WHERE group_id = ? AND month_number = ?
        `).run(groupId, month)
      );

      // 3. DELETE collection balance entries instead of updating them
      const deleteBalanceResult = await withRetry(() => 
        db.prepare(`
          DELETE FROM ${balanceTableName}
          WHERE group_id = ? AND installment_number = ?
        `).run(groupId, month)
      );
      
      

      // 4. Verify the updates
      const msVerifyResult = await withRetry(() => 
        db.prepare(`
          SELECT is_exported
          FROM ${monthlySubscriptionTable}
          WHERE group_id = ? AND month_number = ?
        `).get(groupId, month) as { is_exported: number } | undefined
      );

      if (!msVerifyResult) {
        console.log("No monthly subscription entry found to verify reset");
      } else if (msVerifyResult.is_exported !== 0) {
        throw new Error('Failed to reset monthly subscription is_exported flag');
      }

      // Verify collection balance entries were deleted
      const balanceVerifyResult = await withRetry(() => 
        db.prepare(`
          SELECT COUNT(*) as count
          FROM ${balanceTableName}
          WHERE group_id = ? AND installment_number = ?
        `).get(groupId, month) as { count: number }
      );

      if (balanceVerifyResult.count > 0) {
        throw new Error('Failed to delete collection balance entries');
      }
    });

    res.json({ success: true, message: 'Month reset successfully' });
  } catch (error: any) {
    console.error('Error in reset endpoint:', error);
    res.status(500).json({ error: error.message || 'Failed to reset month' });
  }
});

// Get customer-wise collection sheet for a group
router.get('/:groupId/customer-sheet', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const customerId = Number(req.query.customer);
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;
    if (!groupId || !customerId || !fromDate || !toDate) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }
    const db = getReadDb();
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    // Get the dynamic table name for collections
    const collectionsTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection');
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(collectionsTableName);
    if (!tableExists) {
      return res.status(404).json({ error: 'Collection table not found' });
    }
    // Get the monthly subscription table name
    const monthlySubscriptionTableName = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    
    // Check if monthly subscription table exists
    const subscriptionTableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`)
        .get(monthlySubscriptionTableName)
    );
    
    let query;
    if (subscriptionTableExists) {
      // Join with monthly_subscription table if it exists
      query = `
        SELECT 
          c.*, 
          m.name as member_name,
          ms.monthly_subscription
        FROM ${collectionsTableName} c
        JOIN members m ON c.member_id = m.id
        LEFT JOIN ${monthlySubscriptionTableName} ms ON c.installment_number = ms.month_number
        WHERE c.group_id = ? AND c.member_id = ?
          AND c.collection_date >= ? AND c.collection_date <= ?
        ORDER BY c.collection_date ASC, c.installment_number ASC
      `;
    } else {
      // Use original query if table doesn't exist
      query = `
        SELECT c.*, m.name as member_name
        FROM ${collectionsTableName} c
        JOIN members m ON c.member_id = m.id
        WHERE c.group_id = ? AND c.member_id = ?
          AND c.collection_date >= ? AND c.collection_date <= ?
        ORDER BY c.collection_date ASC, c.installment_number ASC
      `;
    }
    
    // Fetch collections for the customer in the date range
    const collections = await withRetry(() =>
      db.prepare(query).all(groupId, customerId, fromDate, toDate)
    );
    
    // Log debug info
  
    
    res.json(collections);
  } catch (error) {
    console.error('Error fetching customer-wise collection sheet:', error);
    res.status(500).json({ error: 'Failed to fetch customer-wise collection sheet' });
  }
});

// Get exported monthly subscriptions for a group
router.get('/:groupId/monthly-subscription', async (req, res) => {
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
    // Get the dynamic table name for monthly_subscription
    const monthlySubscriptionTable = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(monthlySubscriptionTable);
    if (!tableExists) {
      return res.json([]); // Return empty array if table doesn't exist
    }
    // Fetch all exported monthly subscriptions for the group
    const rows = await withRetry(() =>
      db.prepare(`
        SELECT month_number, monthly_subscription, is_exported
        FROM ${monthlySubscriptionTable}
        WHERE is_exported = 1
        ORDER BY month_number ASC
      `).all()
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching monthly subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch monthly subscriptions' });
  }
});

// Set is_exported for a monthly subscription (PUT)
router.put('/:groupId/monthly-subscription/:month/export', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const month = Number(req.params.month);
    const { is_exported } = req.body;
    const db = getWriteDb();
    // Get group details
    const group = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    // Get the dynamic table name for monthly_subscription
    const monthlySubscriptionTable = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(monthlySubscriptionTable);
    if (!tableExists) {
      return res.status(404).json({ error: 'Monthly subscription table not found' });
    }    // Update is_exported for the month and verify the update
    await executeTransaction(db, async () => {
      const updateResult = await withRetry(() =>
        db.prepare(`          UPDATE ${monthlySubscriptionTable}
          SET is_exported = ?
          WHERE group_id = ? AND month_number = ?
        `).run(is_exported ? 1 : 0, groupId, month)
      );
      
      const verifyResult = await withRetry(() =>
        db.prepare(`          SELECT is_exported
          FROM ${monthlySubscriptionTable}
          WHERE group_id = ? AND month_number = ?
        `).get(groupId, month) as { is_exported: number }
      );


      if (!verifyResult || verifyResult.is_exported !== (is_exported ? 1 : 0)) {
        throw new Error('Failed to update monthly subscription status');
      }
    });

    // Read back the updated data to send in response
    const updatedData = await withRetry(() =>
      db.prepare(`
        SELECT month_number, monthly_subscription, is_exported
        FROM ${monthlySubscriptionTable}
        WHERE month_number = ?
      `).get(month)
    );

    res.json({
      message: 'Export status updated successfully',
      data: updatedData
    });
  } catch (error) {
    console.error('Error updating export status:', error);
    res.status(500).json({ error: 'Failed to update export status' });
  }
});

// Update schema for collection_balance_groupid_groupname table
// Remove and re-add columns: collection_amount, updated_remaining_balance, collection_date
// Ensure proper column definitions
router.post('/update-schema/:groupId', async (req, res) => {
  const db = getWriteDb();
  try {
    const groupId = Number(req.params.groupId);
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }

    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic balance table name
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');

    // Check if table exists
    const tableExists = await withRetry(() => 
      db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(balanceTableName)
    );

    if (!tableExists) {
      return res.status(404).json({ error: 'Balance table not found' });
    }

    // Begin transaction
    await executeTransaction(db, () => {
      // Remove existing columns
      db.prepare(`
        CREATE TABLE IF NOT EXISTS temp_table AS
        SELECT id, group_id, member_id, installment_number, total_paid, remaining_balance, is_completed, last_updated
        FROM ${balanceTableName}
      `).run();

      db.prepare(`DROP TABLE ${balanceTableName}`).run();

      db.prepare(`
        ALTER TABLE temp_table
        RENAME TO ${balanceTableName}
      `).run();
    });

    res.json({ message: 'Schema updated successfully' });
  } catch (error) {
    console.error('Error updating schema:', error);
    res.status(500).json({ error: 'Failed to update schema' });
  }
});

// Get actual group members count for validation
router.get('/group/:groupId/members-count', async (req, res) => {
  const db = getReadDb();
  try {
    const groupId = Number(req.params.groupId);
    
    if (isNaN(groupId)) {
      return res.status(400).json({ error: 'Invalid group ID' });
    }
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    // Get the group members table name
    const groupMembersTableName = GroupTableService.getTableName(groupId, group.name, 'group_members');
    
    // Count actual members in the group_members table
    const membersQuery = `SELECT COUNT(*) as count FROM ${groupMembersTableName} WHERE group_id = ?`;
    const memberCount = await withRetry(() => 
      db.prepare(membersQuery).get(groupId) as { count: number }
    );
    
    const reportedMemberCount = group.member_count || 0;
    const actualMemberCount = memberCount?.count || 0;
    
    return res.json({
      groupId,
      reportedMemberCount,
      actualMemberCount: memberCount?.count || 0,
      memberCount: memberCount?.count || 0,
      matched: reportedMemberCount === actualMemberCount
    });
  } catch (error) {
    console.error('Error getting group members count:', error);
    res.status(500).json({ error: 'Failed to get group members count' });
  }
});

// POST /api/collections/adjust - Adjust collections between installments
router.post('/adjust', async (req, res) => {
  try {
    const { 
      customerId, 
      fromGroupId, 
      fromInstallmentNumber, 
      toGroupId, 
      toInstallmentNumber, 
      amount, 
      adjustmentDate 
    } = req.body;

    // Validate required parameters
    if (!customerId || !fromGroupId || !fromInstallmentNumber || !toGroupId || !toInstallmentNumber || !amount) {
      return res.status(400).json({ 
        error: 'Missing required parameters: customerId, fromGroupId, fromInstallmentNumber, toGroupId, toInstallmentNumber, amount' 
      });
    }

    if (amount <= 0) {
      return res.status(400).json({ error: 'Amount must be greater than 0' });
    }

    const db = getWriteDb();
    
    // Get group details
    const fromGroup = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(fromGroupId)
    ) as Group;
    const toGroup = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(toGroupId)
    ) as Group;

    if (!fromGroup || !toGroup) {
      return res.status(404).json({ error: 'One or both groups not found' });
    }

    // Build table names
    const fromBalanceTableName = GroupTableService.getTableName(fromGroupId, fromGroup.name, 'collection_balance');
    const toBalanceTableName = GroupTableService.getTableName(toGroupId, toGroup.name, 'collection_balance');
    const fromCollectionTableName = GroupTableService.getTableName(fromGroupId, fromGroup.name, 'collection');
    const toCollectionTableName = GroupTableService.getTableName(toGroupId, toGroup.name, 'collection');

    // Start transaction
    await executeTransaction(db, async () => {
      // 1. Get current balance from the source installment
      const fromBalance = db.prepare(`
        SELECT * FROM ${fromBalanceTableName} 
        WHERE member_id = ? AND installment_number = ? AND group_id = ?
      `).get(customerId, fromInstallmentNumber, fromGroupId) as CollectionBalance;

      if (!fromBalance) {
        throw new Error(`Source installment not found: Group ${fromGroupId}, Installment ${fromInstallmentNumber}, Customer ${customerId}`);
      }

      // Check if there's enough excess to transfer
      if (fromBalance.remaining_balance >= 0) {
        throw new Error(`Source installment has no excess. Remaining balance: ₹${fromBalance.remaining_balance}`);
      }

      const availableExcess = Math.abs(fromBalance.remaining_balance);
      if (amount > availableExcess) {
        throw new Error(`Transfer amount (₹${amount}) exceeds available excess (₹${availableExcess})`);
      }

      // 2. Get current balance from the target installment
      const toBalance = db.prepare(`
        SELECT * FROM ${toBalanceTableName} 
        WHERE member_id = ? AND installment_number = ? AND group_id = ?
      `).get(customerId, toInstallmentNumber, toGroupId) as CollectionBalance;

      if (!toBalance) {
        throw new Error(`Target installment not found: Group ${toGroupId}, Installment ${toInstallmentNumber}, Customer ${customerId}`);
      }

      // Check if target installment has shortage
      if (toBalance.remaining_balance <= 0) {
        throw new Error(`Target installment has no shortage. Remaining balance: ₹${toBalance.remaining_balance}`);
      }

      // 3. Calculate new balances
      const newFromRemainingBalance = fromBalance.remaining_balance + amount; // Less negative (reducing excess)
      const newFromTotalPaid = fromBalance.total_paid - amount; // Decrease total_paid by transferred amount
      const newToRemainingBalance = Math.max(0, toBalance.remaining_balance - amount); // Reducing shortage
      const newToTotalPaid = toBalance.total_paid + amount;
      const isToCompleted = newToRemainingBalance === 0; // Completed only when exactly 0
      const isFromCompleted = newFromRemainingBalance === 0; // Completed only when exactly 0

      // 4. Update source balance - decrease total_paid and adjust remaining_balance
      db.prepare(`
        UPDATE ${fromBalanceTableName} 
        SET total_paid = ?, remaining_balance = ?, is_completed = ?, last_updated = CURRENT_TIMESTAMP
        WHERE member_id = ? AND installment_number = ? AND group_id = ?
      `).run(newFromTotalPaid, newFromRemainingBalance, isFromCompleted ? 1 : 0, customerId, fromInstallmentNumber, fromGroupId);

      // 5. Update target balance
      db.prepare(`
        UPDATE ${toBalanceTableName} 
        SET total_paid = ?, remaining_balance = ?, is_completed = ?, last_updated = CURRENT_TIMESTAMP
        WHERE member_id = ? AND installment_number = ? AND group_id = ?
      `).run(newToTotalPaid, newToRemainingBalance, isToCompleted ? 1 : 0, customerId, toInstallmentNumber, toGroupId);

      // 6. Record the adjustment as collections with adjustment markers
      const collectionDate = adjustmentDate || new Date().toISOString().slice(0, 10);

      // For source installment (reducing the excess)
      // Always check for existing record first to avoid constraint violations
      const existingFromCollection = db.prepare(`
        SELECT id, collection_amount FROM ${fromCollectionTableName}
        WHERE group_id = ? AND member_id = ? AND installment_number = ? AND collection_date = ?
      `).get(fromGroupId, customerId, fromInstallmentNumber, collectionDate) as { id: number; collection_amount: number } | undefined;

      if (existingFromCollection) {
        // Update existing collection record
        const newCollectionAmount = existingFromCollection.collection_amount - amount;
        
        if (newCollectionAmount === 0) {
          // Remove the collection record if amount becomes 0
          db.prepare(`DELETE FROM ${fromCollectionTableName} WHERE id = ?`).run(existingFromCollection.id);
        } else {
          // Update existing collection record
          db.prepare(`
            UPDATE ${fromCollectionTableName} 
            SET collection_amount = ?, 
                updated_remaining_balance = ?
            WHERE id = ?
          `).run(newCollectionAmount, newFromRemainingBalance, existingFromCollection.id);
        }
      } else {
        // Create new adjustment record (negative amount to represent transfer out)
        db.prepare(`
          INSERT INTO ${fromCollectionTableName} (
            group_id, member_id, installment_number, collection_amount, 
            remaining_balance, is_completed, collection_date, created_at,
            updated_remaining_balance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          fromGroupId, customerId, fromInstallmentNumber, -amount, 
          fromBalance.remaining_balance, fromBalance.is_completed, collectionDate,
          new Date().toISOString(), newFromRemainingBalance
        );
      }

      // For target installment (receiving the transfer)
      const existingToCollection = db.prepare(`
        SELECT id, collection_amount FROM ${toCollectionTableName}
        WHERE group_id = ? AND member_id = ? AND installment_number = ? AND collection_date = ?
      `).get(toGroupId, customerId, toInstallmentNumber, collectionDate) as { id: number; collection_amount: number } | undefined;

      if (existingToCollection) {
        // Update existing collection record
        const newCollectionAmount = existingToCollection.collection_amount + amount;
        
        if (newCollectionAmount === 0) {
          // Remove the collection record if amount becomes 0 (shouldn't happen for TO but for safety)
          db.prepare(`DELETE FROM ${toCollectionTableName} WHERE id = ?`).run(existingToCollection.id);
        } else {
          // Update existing collection record
          db.prepare(`
            UPDATE ${toCollectionTableName} 
            SET collection_amount = ?, 
                is_completed = ?,
                updated_remaining_balance = ?
            WHERE id = ?
          `).run(newCollectionAmount, isToCompleted ? 1 : 0, newToRemainingBalance, existingToCollection.id);
        }
      } else {
        // Create new adjustment record (positive amount to represent transfer in)
        db.prepare(`
          INSERT INTO ${toCollectionTableName} (
            group_id, member_id, installment_number, collection_amount, 
            remaining_balance, is_completed, collection_date, created_at,
            updated_remaining_balance
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          toGroupId, customerId, toInstallmentNumber, amount, 
          toBalance.remaining_balance, toBalance.is_completed, collectionDate,
          new Date().toISOString(), newToRemainingBalance
        );
      }

      console.log(`Collection adjustment completed: Transferred ₹${amount} from Group ${fromGroupId} Installment ${fromInstallmentNumber} to Group ${toGroupId} Installment ${toInstallmentNumber} for Customer ${customerId}`);
    });

    res.json({ 
      success: true, 
      message: `Successfully transferred ₹${amount} from Group ${fromGroupId} Installment ${fromInstallmentNumber} to Group ${toGroupId} Installment ${toInstallmentNumber}`,
      adjustmentDate: adjustmentDate || new Date().toISOString().slice(0, 10)
    });

  } catch (error: any) {
    console.error('Error performing collection adjustment:', error);
    res.status(500).json({ 
      error: 'Failed to perform collection adjustment', 
      details: error.message 
    });
  }
});

export default router;