import express from 'express';
import { getReadDb, Group } from '../database/setup';
import { withRetry } from '../utils/dbUtils';
import { GroupTableService } from '../services/GroupTableService';

interface CollectionBalance {
  id: number;
  group_id: number;
  member_id: number;
  installment_number: number;
  total_paid: number;
  remaining_balance: number;
  is_completed: boolean;
  last_updated: string;
  export_month?: number;
  is_exported?: boolean;
}

interface GroupMember {
  id: number;
  group_id: number;
  member_id: number;
  member_name: string;
  group_member_id: string;
  created_at: string;
}

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

    // Build table names
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');
    const monthlySubscriptionTableName = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    
    // Check if tables exist
    const balanceTableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(balanceTableName)
    );
    const subscriptionTableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(monthlySubscriptionTableName)
    );
    if (!balanceTableExists || !subscriptionTableExists) {
      return res.json([]);
    }

    // Query all balances for this group with member names and subscription amount
    // Support optional customerId filtering
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;
    
    let query = `
      SELECT 
        cb.*, 
        m.name as member_name, 
        ms.monthly_subscription as subscription_amount,
        ms.monthly_subscription as monthly_subscription  -- Explicitly include monthly_subscription
      FROM ${balanceTableName} cb
      LEFT JOIN members m ON cb.member_id = m.id
      LEFT JOIN ${monthlySubscriptionTableName} ms ON cb.installment_number = ms.month_number
      WHERE cb.group_id = ?
    `;
    let params = [groupId];
    
    if (customerId) {
      query += ` AND cb.member_id = ?`;
      params.push(customerId);
    }
    
    query += ` ORDER BY cb.member_id, cb.installment_number`;
    
    const balances = await withRetry(() =>
      db.prepare(query).all(...params)
    );
    console.log('Balances query executed successfully.');
    // Add debug logging to verify the monthly_subscription values
    if (balances.length > 0) {
      console.log(`Sample balance record fields: ${Object.keys(balances[0] as object).join(', ')}`);
      console.log(`First few balances with subscription data:`);
      balances.slice(0, 3).forEach((balance, index) => {
        const b = balance as Record<string, any>;
        console.log(`Balance ${index + 1} - Installment: ${b.installment_number}, monthly_subscription: ${b.monthly_subscription}, subscription_amount: ${b.subscription_amount}`);
      });
    }
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

   
    res.json(customerSheetData);
  } catch (error) {
    console.error('Error fetching customer sheet data:', error);
    res.status(500).json({ error: 'Failed to fetch customer sheet data', details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/collection-balance/:groupId/pending-balance?customerId=123
router.get('/:groupId/pending-balance', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const customerId = Number(req.query.customerId);
    if (!customerId) {
      return res.status(400).json({ error: 'customerId is required' });
    }
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
   

    // Check if table exists
    const tableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(balanceTableName)
    );
    if (!tableExists) {
      return res.json([]);
    }

    // Query all pending installments for this customer in this group (no due_date)
    const pendingRows = await withRetry(() =>
      db.prepare(`
        SELECT 
          installment_number,
          remaining_balance as pending_amount,
          is_completed
        FROM ${balanceTableName}
        WHERE member_id = ? AND group_id = ? AND is_completed = 0
        ORDER BY installment_number
      `).all(customerId, groupId)
    );

    res.json(pendingRows);
  } catch (error) {
    console.error('Error fetching pending installments:', error);
    res.status(500).json({ error: 'Failed to fetch pending installments', details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/collection-balance/:groupId/members-ordered
router.get('/:groupId/members-ordered', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const db = getReadDb();
    
    // Get group info
    const group = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const groupMembersTableName = GroupTableService.getTableName(groupId, group.name, 'group_members');
    
    // Check if table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `).get(groupMembersTableName);

    if (!tableExists) {
      return res.status(404).json({ error: 'Group members table not found' });
    }
    
    // Get members in the order they were added to the group
    const members = await withRetry(() =>
      db.prepare(`
        SELECT gm.*, m.name, m.phone, m.email, m.address
        FROM ${groupMembersTableName} gm
        LEFT JOIN members m ON gm.member_id = m.id
        WHERE gm.group_id = ?
        ORDER BY gm.id ASC
      `).all(groupId)
    ) as (GroupMember & { name: string; phone: string; email: string; address: string })[];
    
    res.json(members);
  } catch (error: any) {
    console.error('Error fetching ordered group members:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/collection-balance/:groupId/customer-sheet-enhanced
router.get('/:groupId/customer-sheet-enhanced', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const db = getReadDb();
    
    // Get group info
    const group = await withRetry(() =>
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    const balanceTableName = GroupTableService.getTableName(groupId, group.name, 'collection_balance');
    const collectionTableName = GroupTableService.getTableName(groupId, group.name, 'collection');
    const groupMembersTableName = GroupTableService.getTableName(groupId, group.name, 'group_members');
    
    // Check if tables exist
    const balanceTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(balanceTableName);
    
    const collectionTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(collectionTableName);
    
    const membersTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(groupMembersTableName);

    if (!balanceTableExists || !collectionTableExists || !membersTableExists) {
      return res.status(404).json({ error: 'Required tables not found' });
    }
    
    // Get ordered members
    const orderedMembers = await withRetry(() =>
      db.prepare(`
        SELECT gm.*, m.name, m.phone
        FROM ${groupMembersTableName} gm
        LEFT JOIN members m ON gm.member_id = m.id
        WHERE gm.group_id = ?
        ORDER BY gm.id ASC
      `).all(groupId)
    );
    
    // Get collection balances with completion details
    const balancesQuery = `
      SELECT 
        cb.*,
        CASE 
          WHEN cb.is_completed = 1 THEN (
            SELECT collection_date 
            FROM ${collectionTableName} c 
            WHERE c.group_id = cb.group_id 
              AND c.member_id = cb.member_id 
              AND c.installment_number = cb.installment_number 
              AND c.is_completed = 1
            ORDER BY c.created_at DESC 
            LIMIT 1
          )
          ELSE NULL
        END as completion_date,
        CASE 
          WHEN cb.is_completed = 1 THEN cb.total_paid
          ELSE NULL
        END as paid_amount
      FROM ${balanceTableName} cb
      WHERE cb.group_id = ?
      ORDER BY cb.member_id, cb.installment_number
    `;
    
    const balances = await withRetry(() =>
      db.prepare(balancesQuery).all(groupId)
    );
    
    // Get exported installments
    const monthlySubscriptionTableName = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    let exportedInstallments: number[] = [];
    
    const subscriptionTableExists = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name=?
    `).get(monthlySubscriptionTableName);
    
    if (subscriptionTableExists) {
      const exported = await withRetry(() =>
        db.prepare(`
          SELECT month_number, monthly_subscription
          FROM ${monthlySubscriptionTableName}
          WHERE group_id = ? AND is_exported = 1
          ORDER BY month_number ASC
        `).all(groupId)
      );
      exportedInstallments = exported.map((e: any) => e.month_number);
    }
    
    res.json({
      members: orderedMembers,
      balances: balances,
      exportedInstallments: exportedInstallments
    });
  } catch (error: any) {
    console.error('Error fetching enhanced customer sheet data:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/collection-balance/:groupId/incomplete
router.get('/:groupId/incomplete', async (req, res) => {
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
  

    // Check if table exists
    const tableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(balanceTableName)
    );
    if (!tableExists) {
      return res.json([]);
    }

    // Query ONLY incomplete balances for this group with member names, sorted by installment number
    const balances = await withRetry(() =>
      db.prepare(`
        SELECT cb.*, m.name as member_name
        FROM ${balanceTableName} cb
        LEFT JOIN members m ON cb.member_id = m.id
        WHERE cb.group_id = ? AND cb.is_completed = 0 AND cb.remaining_balance > 0
        ORDER BY cb.member_id, cb.installment_number ASC
      `).all(groupId)
    );
    
    res.json(balances);
  } catch (error) {
    console.error('Error fetching incomplete collection balances:', error);
    res.status(500).json({ error: 'Failed to fetch incomplete collection balances', details: error instanceof Error ? error.message : String(error) });
  }
});

// GET /api/collection-balance/:groupId/monthly-subscriptions
router.get('/:groupId/monthly-subscriptions', async (req, res) => {
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

    // Build table name for monthly subscriptions
    const monthlySubscriptionTableName = GroupTableService.getTableName(groupId, group.name, 'monthly_subscription');
    
    // Check if table exists
    const tableExists = await withRetry(() =>
      db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(monthlySubscriptionTableName)
    );
    
    if (!tableExists) {
      return res.json([]); // Return empty array if table doesn't exist
    }

    // Query all monthly subscriptions for this group
    const subscriptions = await withRetry(() =>
      db.prepare(`
        SELECT month_number as installment_number, monthly_subscription
        FROM ${monthlySubscriptionTableName}
        ORDER BY month_number
      `).all()
    );
    
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching monthly subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch monthly subscriptions', details: error instanceof Error ? error.message : String(error) });
  }
});

export default router;
