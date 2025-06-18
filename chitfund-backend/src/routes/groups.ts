import express from 'express';
import { dbPool } from '../database/connection';
import { GroupTableService } from '../services/GroupTableService';

interface Group {
  id: number;
  name: string;
  total_amount: number;
  member_count: number;
  start_date: string;
  end_date: string;
  commission_percentage: number;
  created_at: string;
  updated_at: string;
}

const router = express.Router();

// Helper function to retry database operations
async function withRetry<T>(operation: () => T, maxRetries = 3): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      if (error.code === 'SQLITE_BUSY') {
        // Wait for a short time before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 100));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

// Helper function to execute transactions with retry
async function executeTransaction<T>(db: any, operation: () => T): Promise<T> {
  return withRetry(() => {
    return db.transaction(operation)();
  });
}

// Get all groups
router.get('/', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const groups = await withRetry(() => 
      db.prepare('SELECT * FROM groups').all() as Group[]
    );
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
});

// Get group by ID
router.get('/:id', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Create new group
router.post('/', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const { name, total_amount, member_count, start_date, end_date } = req.body;
    
    const result = await withRetry(() => 
      db.prepare(`
        INSERT INTO groups (name, total_amount, member_count, start_date, end_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, total_amount, member_count, start_date, end_date)
    );

    const newGroup = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid) as Group
    );
    
    // Create dynamic tables for the new group
    await GroupTableService.createGroupTables(newGroup.id, newGroup.name);
    
    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const { name, total_amount, member_count, start_date, end_date } = req.body;
    
    const result = await withRetry(() => 
      db.prepare(`
        UPDATE groups
        SET name = ?, total_amount = ?, member_count = ?, start_date = ?, end_date = ?
        WHERE id = ?
      `).run(name, total_amount, member_count, start_date, end_date, req.params.id)
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const updatedGroup = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id)
    );
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Delete dynamic tables for the group
    await GroupTableService.deleteGroupTables(group.id, group.name);
    
    // Delete the group
    await withRetry(() => 
      db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id)
    );
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Get group members
router.get('/:id/members', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const id = Number(req.params.id);
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');

    const members = await withRetry(() => 
      db.prepare(`
        SELECT m.* 
        FROM members m
        JOIN ${groupMembersTableName} gm ON m.id = gm.member_id
        WHERE gm.group_id = ?
      `).all(id)
    );
    
    res.json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ error: 'Failed to fetch group members' });
  }
});

// Add member to group
router.post('/:id/members', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const id = Number(req.params.id);
    const { member_id } = req.body;
    
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');
    
    const result = await withRetry(() => 
      db.prepare(`
        INSERT INTO ${groupMembersTableName} (group_id, member_id, group_member_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(id, member_id, `GM${id}_${member_id}`, new Date().toISOString())
    );

    const newGroupMember = await withRetry(() => 
      db.prepare(`
        SELECT m.* 
        FROM members m
        JOIN ${groupMembersTableName} gm ON m.id = gm.member_id
        WHERE gm.group_id = ? AND gm.member_id = ?
      `).get(id, member_id)
    );
    
    res.status(201).json(newGroupMember);
  } catch (error) {
    console.error('Error adding member to group:', error);
    res.status(500).json({ error: 'Failed to add member to group' });
  }
});

// Remove member from group
router.delete('/:id/members/:memberId', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const id = Number(req.params.id);
    const memberId = Number(req.params.memberId);
    
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');
    
    const result = await withRetry(() => 
      db.prepare(`
        DELETE FROM ${groupMembersTableName} 
        WHERE group_id = ? AND member_id = ?
      `).run(id, memberId)
    );
    
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Group member not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error removing member from group:', error);
    res.status(500).json({ error: 'Failed to remove member from group' });
  }
});

// Update group members
router.put('/:id/members', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const id = Number(req.params.id);
    const { members } = req.body;
    
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');

    // Delete existing members and add new ones in a transaction
    await executeTransaction(db, () => {
      // Delete all existing members
      db.prepare(`DELETE FROM ${groupMembersTableName} WHERE group_id = ?`).run(id);

      // Add new members
      for (const member of members) {
        db.prepare(`
          INSERT INTO ${groupMembersTableName} (group_id, member_id, group_member_id, created_at)
          VALUES (?, ?, ?, ?)
        `).run(id, member.id, member.groupMemberId, new Date().toISOString());
      }

      // Update group member count
      db.prepare('UPDATE groups SET member_count = ? WHERE id = ?').run(members.length, id);
    });

    res.json({ message: 'Group members updated successfully' });
  } catch (error) {
    console.error('Error updating group members:', error);
    res.status(500).json({ message: 'Failed to update group members' });
  }
});

// Get chit dates for a group
router.get('/:id/chit-dates', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const id = Number(req.params.id);
    
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for chit dates
    const chitDatesTableName = GroupTableService.getTableName(id, group.name, 'chit_dates');

    // Fetch chit dates
    const chitDates = await withRetry(() => 
      db.prepare(`
        SELECT * FROM ${chitDatesTableName} 
        WHERE group_id = ? 
        ORDER BY chit_date
      `).all(id)
    );

    res.json(chitDates);
  } catch (error) {
    console.error('Error fetching chit dates:', error);
    res.status(500).json({ error: 'Failed to fetch chit dates' });
  }
});

// Update chit dates for a group
router.put('/:id/chit-dates', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const id = Number(req.params.id);
    const { chit_dates } = req.body;
    
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for chit dates
    const chitDatesTableName = GroupTableService.getTableName(id, group.name, 'chit_dates');

    // Delete existing chit dates for this group
    await withRetry(() => 
      db.prepare(`DELETE FROM ${chitDatesTableName} WHERE group_id = ?`).run(id)
    );

    // Insert new chit dates
    for (const chitDate of chit_dates) {
      await withRetry(() => 
        db.prepare(`
          INSERT INTO ${chitDatesTableName} (group_id, chit_date, amount, created_at)
          VALUES (?, ?, ?, ?)
        `).run(id, chitDate.chit_date, chitDate.minimum_amount || 0, new Date().toISOString())
      );
    }

    // Fetch and return the updated chit dates
    const updatedChitDates = await withRetry(() => 
      db.prepare(`
        SELECT * FROM ${chitDatesTableName} WHERE group_id = ? ORDER BY chit_date
      `).all(id)
    );

    res.json(updatedChitDates);
  } catch (error) {
    console.error('Error updating chit dates:', error);
    res.status(500).json({ message: 'Failed to update chit dates' });
  }
});

// Update group commission
router.put('/:id/commission', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const { commission_percentage } = req.body;
    const id = Number(req.params.id);

    // Get group with retry
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id)
    );

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Update commission with retry
    await withRetry(() => 
      db.prepare('UPDATE groups SET commission_percentage = ? WHERE id = ?')
        .run(commission_percentage, id)
    );

    // Get updated group with retry
    const updatedGroup = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id)
    );

    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group commission:', error);
    res.status(500).json({ message: 'Failed to update group commission' });
  }
});

// Get monthly subscriptions for a group
router.get('/:id/monthly-subscriptions', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const id = Number(req.params.id);
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for monthly subscriptions
    const subscriptionsTableName = GroupTableService.getTableName(id, group.name, 'monthly_subscription');

    const subscriptions = await withRetry(() => 
      db.prepare(`
        SELECT * FROM ${subscriptionsTableName} WHERE group_id = ? ORDER BY month_number
      `).all(id)
    );
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching monthly subscriptions:', error);
    res.status(500).json({ message: 'Failed to fetch monthly subscriptions' });
  }
});

// Update monthly subscriptions for a group
router.put('/:id/monthly-subscriptions', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const id = Number(req.params.id);
    const { subscriptions } = req.body;
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the dynamic table name for monthly subscriptions
    const subscriptionsTableName = GroupTableService.getTableName(id, group.name, 'monthly_subscription');

    // Delete existing subscriptions for this group
    await withRetry(() => 
      db.prepare(`DELETE FROM ${subscriptionsTableName} WHERE group_id = ?`).run(id)
    );

    // Insert new subscriptions
    for (const sub of subscriptions) {
      await withRetry(() => 
        db.prepare(`
          INSERT INTO ${subscriptionsTableName} (group_id, month_number, bid_amount, total_dividend, distributed_dividend, monthly_subscription, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, sub.month_number, sub.bid_amount || 0, sub.total_dividend || 0, sub.distributed_dividend || 0, sub.monthly_subscription || 0, new Date().toISOString())
      );
    }

    // Fetch and return the updated subscriptions
    const updatedSubscriptions = await withRetry(() => 
      db.prepare(`
        SELECT * FROM ${subscriptionsTableName} WHERE group_id = ? ORDER BY month_number
      `).all(id)
    );
    res.json(updatedSubscriptions);
  } catch (error) {
    console.error('Error updating monthly subscriptions:', error);
    res.status(500).json({ message: 'Failed to update monthly subscriptions' });
  }
});

// Create tables for existing group
router.post('/:id/create-tables', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const id = Number(req.params.id);

    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group | undefined
    );
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Create tables for this group
    const tables = await GroupTableService.createGroupTables(id, group.name);

    res.json({ 
      message: 'Tables created successfully',
      group,
      tables 
    });
  } catch (error) {
    console.error('Error creating tables for group:', error);
    res.status(500).json({ error: 'Failed to create tables for group' });
  }
});

export default router; 