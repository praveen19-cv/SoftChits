import express from 'express';
import { db } from '../database/setup';

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

// Get all collection tables
router.get('/', (req, res) => {
  try {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE 'collection_%'
    `).all();
    res.json(tables);
  } catch (error) {
    console.error('Error fetching collection tables:', error);
    res.status(500).json({ error: 'Failed to fetch collection tables' });
  }
});

// Create a new collection table for a group
router.post('/:tableName/create-table', (req, res) => {
  try {
    const { tableName } = req.params;
    if (!tableName) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Create the collection table if it doesn't exist
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_date TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        installment_number INTEGER NOT NULL,
        collection_amount DECIMAL(10,2) NOT NULL,
        remaining_balance DECIMAL(10,2) NOT NULL,
        is_completed BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      )
    `).run();

    // Create the corresponding balance table
    const balanceTableName = `collection_balance_${tableName.replace('collection_', '')}`;
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
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (member_id) REFERENCES members(id),
        UNIQUE(group_id, member_id, installment_number)
      )
    `).run();

    res.status(201).json({ 
      message: `Tables ${tableName} and ${balanceTableName} created successfully`,
      collectionTable: tableName,
      balanceTable: balanceTableName
    });
  } catch (error: any) {
    console.error('Error creating collection tables:', error);
    res.status(500).json({ error: 'Failed to create collection tables' });
  }
});

// Get collections by date and group
router.get('/by-date-group', (req, res) => {
  try {
    const { date, groupId } = req.query;
    if (!date || !groupId) {
      return res.status(400).json({ error: 'Date and group ID are required' });
    }

    // Get the table name for this group
    const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(groupId) as Group | undefined;
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const tableName = `collection_${groupId}_${group.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `).get(tableName);

    if (!tableExists) {
      return res.json([]); // Return empty array if table doesn't exist
    }
    
    // Get collections for the specified date and group
    const collections = db.prepare(`
      SELECT c.*, m.name as member_name 
      FROM ${tableName} c
      JOIN members m ON c.member_id = m.id
      WHERE c.collection_date = ? AND c.group_id = ?
      ORDER BY c.installment_number
    `).all(date, groupId);

    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Get collections by date from a specific table
router.get('/:tableName/by-date', (req, res) => {
  try {
    const { tableName } = req.params;
    const { date } = req.query;
    
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `).get(tableName);

    if (!tableExists) {
      return res.json([]); // Return empty array if table doesn't exist
    }
    
    // Get collections for the specified date
    const collections = db.prepare(`
      SELECT c.*, m.name as member_name 
      FROM ${tableName} c
      JOIN members m ON c.member_id = m.id
      WHERE c.collection_date = ?
      ORDER BY c.installment_number
    `).all(date);

    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Get all collections from a specific table
router.get('/:tableName', (req, res) => {
  try {
    const { tableName } = req.params;
    const collections = db.prepare(`SELECT * FROM ${tableName}`).all();
    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Get collection by ID from a specific table
router.get('/:tableName/:id', (req, res) => {
  try {
    const { tableName, id } = req.params;
    const collection = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// Create new collection in a specific table
router.post('/:tableName', (req, res) => {
  try {
    const { tableName } = req.params;
    const collection = req.body;
    
    if (!collection) {
      return res.status(400).json({ error: 'Collection data is required' });
    }

    const { date, group_id, member_id, installment_string, amount } = collection;
    
    if (!date || !group_id || !member_id || !installment_string || !amount) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: { date, group_id, member_id, installment_string, amount }
      });
    }

    // Get group details for monthly subscription amount
    const group = db.prepare('SELECT total_amount, member_count FROM groups WHERE id = ?').get(group_id) as Group;
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const monthlySubscription = group.total_amount / group.member_count;

    // Get the balance table name
    const balanceTableName = `collection_balance_${tableName.replace('collection_', '')}`;

    // Parse installment string (e.g., "1c,2")
    const installments = installment_string.split(',').map((inst: string) => {
      const isCompleted = inst.endsWith('c');
      const number = parseInt(inst.replace('c', ''));
      return { number, isCompleted };
    });

    // Sort installments by number
    installments.sort((a: { number: number }, b: { number: number }) => a.number - b.number);

    // Check if previous installments are completed
    for (let i = 0; i < installments.length; i++) {
      const inst = installments[i];
      if (i > 0) {
        const prevInst = installments[i - 1];
        if (!prevInst.isCompleted) {
          return res.status(400).json({ 
            error: `Cannot add installment ${inst.number} before completing installment ${prevInst.number}`
          });
        }
      }
    }

    // Calculate amounts for each installment
    const results = [];
    let remainingAmount = amount;

    for (const inst of installments) {
      // Get or create balance record for this installment
      let balanceRecord = db.prepare(`
        SELECT * FROM ${balanceTableName}
        WHERE group_id = ? AND member_id = ? AND installment_number = ?
      `).get(group_id, member_id, inst.number) as CollectionBalance | undefined;

      if (!balanceRecord) {
        // Create new balance record
        db.prepare(`
          INSERT INTO ${balanceTableName} (
            group_id, member_id, installment_number, 
            total_paid, remaining_balance, is_completed
          )
          VALUES (?, ?, ?, 0, ?, FALSE)
        `).run(group_id, member_id, inst.number, monthlySubscription);
        
        balanceRecord = db.prepare(`
          SELECT * FROM ${balanceTableName}
          WHERE group_id = ? AND member_id = ? AND installment_number = ?
        `).get(group_id, member_id, inst.number) as CollectionBalance;
      }

      const amountForThisInstallment = Math.min(remainingAmount, balanceRecord.remaining_balance);
      const newTotalPaid = balanceRecord.total_paid + amountForThisInstallment;
      const newRemainingBalance = monthlySubscription - newTotalPaid;
      const isFullyPaid = newRemainingBalance <= 0;

      // Update balance record
      db.prepare(`
        UPDATE ${balanceTableName}
        SET total_paid = ?, 
            remaining_balance = ?, 
            is_completed = ?,
            last_updated = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(newTotalPaid, newRemainingBalance, isFullyPaid ? 1 : 0, balanceRecord.id);

      // Create the collection record
      const result = db.prepare(`
        INSERT INTO ${tableName} (
          collection_date, group_id, member_id, installment_number, 
          collection_amount, remaining_balance, is_completed
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        date, 
        group_id, 
        member_id, 
        inst.number,
        amountForThisInstallment,
        newRemainingBalance,
        isFullyPaid ? 1 : 0
      );

      const newCollection = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(result.lastInsertRowid);
      results.push(newCollection);

      remainingAmount -= amountForThisInstallment;
      if (remainingAmount <= 0) break;
    }

    res.status(201).json(results);
  } catch (error: any) {
    console.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection', details: error.message });
  }
});

// Update collection in a specific table
router.put('/:tableName/:id', (req, res) => {
  try {
    const { tableName, id } = req.params;
    const { collection } = req.body;
    if (!collection) {
      return res.status(400).json({ error: 'Collection data is required' });
    }

    const { date, group_id, member_id, installment_number, amount, is_completed } = collection;
    const result = db.prepare(`
      UPDATE ${tableName}
      SET date = ?, group_id = ?, member_id = ?, installment_number = ?, amount = ?, is_completed = ?
      WHERE id = ?
    `).run(date, group_id, member_id, installment_number, amount, is_completed, id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const updatedCollection = db.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(id);
    res.json(updatedCollection);
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// Delete collection from a specific table
router.delete('/:tableName/:id', (req, res) => {
  try {
    const { tableName, id } = req.params;
    const result = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`).run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// Get collection balances for a group
router.get('/balances/:groupId', (req, res) => {
  try {
    const { groupId } = req.params;
    
    // Get the group name
    const group = db.prepare('SELECT name FROM groups WHERE id = ?').get(groupId) as Group | undefined;
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the balance table name
    const cleanGroupName = group.name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const balanceTableName = `collection_balance_${groupId}_${cleanGroupName}`;

    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `).get(balanceTableName);

    if (!tableExists) {
      return res.json([]); // Return empty array if table doesn't exist
    }

    const balances = db.prepare(`
      SELECT cb.*, m.name as member_name
      FROM ${balanceTableName} cb
      JOIN members m ON cb.member_id = m.id
      WHERE cb.group_id = ?
      ORDER BY cb.member_id, cb.installment_number
    `).all(groupId);
    res.json(balances);
  } catch (error) {
    console.error('Error fetching collection balances:', error);
    res.status(500).json({ error: 'Failed to fetch collection balances' });
  }
});

export default router; 