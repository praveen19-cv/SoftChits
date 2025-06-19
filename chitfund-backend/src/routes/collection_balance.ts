import express from 'express';
import { getReadDb } from '../database/setup';
import { withRetry } from '../utils/dbUtils';
import { GroupTableService } from '../services/GroupTableService';

const router = express.Router();

// GET /api/collection-balance/:groupId
router.get('/:groupId', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const db = getReadDb();

    // Get group details
    const group: any = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Build table name
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');
    console.log(`Using balance table: ${balanceTableName}`);

    // Check if table exists
    const tableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(balanceTableName)
    );
    if (!tableExists) {
      return res.json([]);
    }

    // Query all balances for this group
    const balances = await withRetry(() =>
      db.prepare(`SELECT * FROM ${balanceTableName}`).all()
    );
    console.log('Balances query executed successfully.');
    res.json(balances);
  } catch (error) {
    console.error('Error fetching collection balances:', error);
    res.status(500).json({ error: 'Failed to fetch collection balances', details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/collection-balance/:groupId/customer-sheet
router.get('/:groupId/customer-sheet', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const db = getReadDb();

    // Get group details
    const group: any = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId)
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Build table name
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');
    console.log(`Using balance table: ${balanceTableName}`);

    // Check if table exists
    const tableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(balanceTableName)
    );
    if (!tableExists) {
      return res.json([]);
    }

    // Query customer sheet data
    const customerSheetData = await withRetry(() =>
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
        ORDER BY m.id, cb.installment_number
      `).all(groupId)
    );

    console.log('Customer sheet query executed successfully.');
    res.json(customerSheetData);
  } catch (error) {
    console.error('Error fetching customer sheet data:', error);
    res.status(500).json({ error: 'Failed to fetch customer sheet data', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
