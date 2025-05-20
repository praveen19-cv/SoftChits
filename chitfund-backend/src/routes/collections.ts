import express from 'express';
import { getDb } from '../database/setup';
import { GroupTableService } from '../services/GroupTableService';

const router = express.Router();

interface Group {
  name: string;
  total_amount: number;
  member_count: number;
}

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

// Helper function to handle database operations with retries
async function withRetry<T>(operation: () => T, maxRetries = 5): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      if (error.code === 'SQLITE_BUSY') {
        // Exponential backoff
        const delay = Math.min(100 * Math.pow(2, i), 2000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Helper function to execute a transaction with retries
async function executeTransaction<T>(db: Database, transactionFn: () => T): Promise<T> {
  return withRetry(() => {
    const transaction = db.transaction(transactionFn);
    return transaction();
  });
}

// Get all collections for a group
router.get('/:groupId', async (req, res) => {
  try {
    const { groupId } = req.params;
    const db = getDb();
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(groupId, group.name, 'collection');
    const collections = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} ORDER BY collection_date DESC`).all()
    );
    
    res.json(collections);
  } catch (error: any) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get collections by date and group
router.get('/by-date-group/:groupId/:date', async (req, res) => {
  try {
    const { groupId, date } = req.params;
    const db = getDb();
    
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(groupId, group.name, 'collection');
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

// Create a new collection
router.post('/', async (req, res) => {
  try {
    const { group_id, member_id, collection_date, installment_number, collection_amount } = req.body;
    const db = getDb();
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id)
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(group_id, group.name, 'collection');
    const balanceTableName = GroupTableService.getTableName(group_id, group.name, 'collection_balance');

    const result = await executeTransaction(db, () => {
      // Insert into collections table
      const result = db.prepare(`
        INSERT INTO ${tableName} (
          collection_date, group_id, member_id, installment_number, 
          collection_amount, remaining_balance, is_completed
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        collection_date,
        group_id,
        member_id,
        installment_number,
        collection_amount,
        collection_amount,
        false
      );

      // Update or insert into collection balance table
      db.prepare(`
        INSERT INTO ${balanceTableName} (
          group_id, member_id, installment_number, total_paid, 
          remaining_balance, is_completed
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(group_id, member_id, installment_number) 
        DO UPDATE SET 
          total_paid = total_paid + ?,
          remaining_balance = remaining_balance - ?,
          last_updated = CURRENT_TIMESTAMP
      `).run(
        group_id,
        member_id,
        installment_number,
        collection_amount,
        collection_amount,
        false,
        collection_amount,
        collection_amount
      );

      return result;
    });

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (error: any) {
    console.error('Error creating collection:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update a collection
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { group_id, collection_amount } = req.body;
    const db = getDb();
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id)
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(group_id, group.name, 'collection');
    const balanceTableName = GroupTableService.getTableName(group_id, group.name, 'collection_balance');

    // Get the current collection with retry
    const currentCollection = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id)
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
    const { group_id } = req.query;
    const db = getDb();
    
    // Get group info with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(group_id)
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = GroupTableService.getTableName(group_id, group.name, 'collection');
    const balanceTableName = GroupTableService.getTableName(group_id, group.name, 'collection_balance');

    // Get the collection to be deleted with retry
    const collection = await withRetry(() => 
      db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id)
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

// Get collection balances for a specific group table
router.get('/:tableName/balances', async (req, res) => {
  try {
    const { tableName } = req.params;
    const db = getDb();
    
    const balances = db.prepare(`
      SELECT cb.*, m.name as member_name
      FROM ${tableName}_balance cb
      JOIN members m ON cb.member_id = m.id
      ORDER BY cb.member_id, cb.installment_number
    `).all();
    
    res.json(balances);
  } catch (error) {
    console.error('Error fetching collection balances:', error);
    res.status(500).json({ error: 'Failed to fetch collection balances' });
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

export default router; 