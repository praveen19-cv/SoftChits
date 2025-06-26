import express from 'express';
import { getReadDb, getWriteDb, Group } from '../database/setup';
import { GroupTableService } from '../services/GroupTableService';
import { withRetry } from '../utils/dbUtils';

const router = express.Router();

interface Collection {
  id: number;
  collection_date: string;
  group_id: number;
  member_id: number;
  installment_number: number;
  collection_amount: number;
  remaining_balance: number;
  is_completed: boolean;
  created_at: string;
  updated_remaining_balance?: number;
}

// Get collections for a specific group and installment
router.get('/:groupId/installment/:installmentNumber', async (req, res) => {
  try {
    const { groupId, installmentNumber } = req.params;
    const db = getReadDb();
    
    // Get group info
    const group = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const collectionTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection');
    
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(collectionTableName);

    if (!tableExists) {
      return res.status(404).json({ error: 'Collection table not found' });
    }
    
    // Get all collections for the specific installment
    const collections = await withRetry(() =>
      db.prepare(`
        SELECT c.*, m.name as member_name
        FROM ${collectionTableName} c
        LEFT JOIN members m ON c.member_id = m.id
        WHERE c.group_id = ? AND c.installment_number = ?
        ORDER BY c.member_id, c.collection_date DESC
      `).all(groupId, installmentNumber)
    ) as Collection[];
    
    res.json(collections);
  } catch (error: any) {
    console.error('Error fetching collections by installment:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get last collection for each member and installment (for completion dates)
router.get('/:groupId/completion-details', async (req, res) => {
  try {
    const { groupId } = req.params;
    const db = getReadDb();
    
    // Get group info
    const group = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const collectionTableName = GroupTableService.getTableName(Number(groupId), group.name, 'collection');
    
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(collectionTableName);

    if (!tableExists) {
      return res.status(404).json({ error: 'Collection table not found' });
    }
    
    // Get completion details for each member and installment
    const completionDetails = await withRetry(() =>
      db.prepare(`
        SELECT 
          member_id,
          installment_number,
          collection_date as last_payment_date,
          collection_amount as last_payment_amount,
          is_completed,
          ROW_NUMBER() OVER (
            PARTITION BY member_id, installment_number 
            ORDER BY collection_date DESC, created_at DESC
          ) as rn
        FROM ${collectionTableName}
        WHERE group_id = ?
      `).all(groupId)
    );
    
    // Filter to get only the latest record for each member-installment combination
    const latestDetails = completionDetails.filter((detail: any) => detail.rn === 1);
    
    res.json(latestDetails);
  } catch (error: any) {
    console.error('Error fetching completion details:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
