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
  status: string;
  number_of_months: number;
  commission_percentage?: number; // Added commission_percentage
  is_ten_dates_chit?: boolean; // Added is_ten_dates_chit
  created_at?: string;
  updated_at?: string;
}

const router = express.Router();

// Enhanced retry logic with increased retries and logging for SQLITE_BUSY errors.
async function withRetry<T>(operation: () => T, maxRetries = 5): Promise<T> {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return operation();
    } catch (error: any) {
      lastError = error;
      if (error.code === 'SQLITE_BUSY') {
        console.warn(`SQLITE_BUSY detected. Retry attempt ${i + 1} of ${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 200)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
  console.error('SQLITE_BUSY error persisted after maximum retries:', lastError);
  throw lastError;
}

// Helper function to execute transactions with retry
async function executeTransaction<T>(db: any, operation: () => T): Promise<T> {
  try {
    console.log('Starting transaction...');
    const result = await withRetry(() => db.transaction(operation)());
    console.log('Transaction completed successfully.');
    return result;
  } catch (error) {
    console.error('Transaction failed:', error);
    throw error;
  }
}

// Helper function to generate initial chit dates for a new group
async function generateInitialChitDates(group: Group): Promise<void> {
  const db = dbPool.getWriteConnection();
  
  try {
    const dates: { chit_date: string; amount: number }[] = [];
    
    if (group.is_ten_dates_chit) {
      // For ten dates chit: 10th, 20th, 30th of each month
      const startParts = group.start_date.split('-');
      const endParts = group.end_date.split('-');
      
      let startYear = parseInt(startParts[0]);
      let startMonth = parseInt(startParts[1]);
      let endYear = parseInt(endParts[0]);
      let endMonth = parseInt(endParts[1]);
      
      // Generate dates from start month/year to end month/year
      for (let year = startYear; year <= endYear; year++) {
        let monthStart = (year === startYear) ? startMonth : 1;
        let monthEnd = (year === endYear) ? endMonth : 12;
        
        for (let month = monthStart; month <= monthEnd; month++) {
          // Add 10th, 20th, 30th of each month
          [10, 20, 30].forEach(day => {
            const monthStr = month.toString().padStart(2, '0');
            const dayStr = day.toString().padStart(2, '0');
            const dateString = `${year}-${monthStr}-${dayStr}`;
            
            // Skip February 30th manually
            if (month === 2 && day === 30) return;
            
            // Check if within range by string comparison
            if (dateString >= group.start_date && dateString <= group.end_date) {
              dates.push({ chit_date: dateString, amount: 0 });
            }
          });
        }
      }
    } else {
      // For normal chit: monthly
      const startDate = new Date(group.start_date);
      const endDate = new Date(group.end_date);
      let currentDate = new Date(startDate);
      
      while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0];
        dates.push({ chit_date: dateString, amount: 0 });
        currentDate.setMonth(currentDate.getMonth() + 1);
      }
    }
    
    // Calculate minimum amounts
    const numDates = dates.length;
    const totalAmount = group.total_amount;
    
    if (group.is_ten_dates_chit) {
      // For ten dates chit: start from 4% at last row, increase by 0.34% per row
      for (let i = 0; i < numDates; i++) {
        const percentage = 4 + (numDates - 1 - i) * 0.34;
        dates[i].amount = Math.round((totalAmount * percentage) / 100);
      }
    } else {
      // For normal chit: start from 4% at last row, increase by 1% per row
      for (let i = 0; i < numDates; i++) {
        const percentage = 4 + (numDates - 1 - i) * 1;
        dates[i].amount = Math.round((totalAmount * percentage) / 100);
      }
    }
    
    // Get the dynamic table name for chit dates
    const chitDatesTableName = GroupTableService.getTableName(group.id, group.name, 'chit_dates');
    
    // Insert chit dates
    for (const chitDate of dates) {
      await withRetry(() => 
        db.prepare(`
          INSERT INTO ${chitDatesTableName} (group_id, chit_date, amount, created_at)
          VALUES (?, ?, ?, ?)
        `).run(group.id, chitDate.chit_date, chitDate.amount, new Date().toISOString())
      );
    }
    
    console.log(`Generated ${dates.length} initial chit dates for group ${group.id}`);
  } catch (error) {
    console.error('Error generating initial chit dates:', error);
    throw error;
  }
}

// Get all groups
router.get('/', async (req, res) => {
  const db = dbPool.getReadConnection();
  try {
    const groups = await withRetry(() => 
      db.prepare('SELECT * FROM groups').all() as Group[]
    );
    // Convert is_ten_dates_chit from number to boolean
    const processedGroups = groups.map(group => ({
      ...group,
      is_ten_dates_chit: Boolean(group.is_ten_dates_chit)
    }));
    res.json(processedGroups);
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
    // Convert is_ten_dates_chit from number to boolean
    const processedGroup = {
      ...group,
      is_ten_dates_chit: Boolean(group.is_ten_dates_chit)
    };
    res.json(processedGroup);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
});

// Create new group
router.post('/', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const { name, total_amount, member_count, start_date, end_date, number_of_months, commission_percentage, is_ten_dates_chit } = req.body;
    
    const result = await withRetry(() => 
      db.prepare(`
        INSERT INTO groups (name, total_amount, member_count, start_date, end_date, number_of_months, commission_percentage, is_ten_dates_chit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, total_amount, member_count, start_date, end_date, number_of_months, commission_percentage || 0, is_ten_dates_chit ? 1 : 0)
    );

    const newGroup = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid) as Group
    );
    
    // Create dynamic tables for the new group
    await GroupTableService.createGroupTables(newGroup.id, newGroup.name);
    
    // Generate initial chit dates for the new group
    await generateInitialChitDates(newGroup);
    
    // Convert is_ten_dates_chit from number to boolean before sending response
    const processedGroup = {
      ...newGroup,
      is_ten_dates_chit: Boolean(newGroup.is_ten_dates_chit)
    };
    
    res.status(201).json(processedGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ error: 'Failed to create group' });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  const db = dbPool.getWriteConnection();
  try {
    const { name, total_amount, member_count, start_date, end_date, commission_percentage, is_ten_dates_chit } = req.body;
    
    const result = await withRetry(() => 
      db.prepare(`
        UPDATE groups
        SET name = ?, total_amount = ?, member_count = ?, start_date = ?, end_date = ?, commission_percentage = ?, is_ten_dates_chit = ?
        WHERE id = ?
      `).run(name, total_amount, member_count, start_date, end_date, commission_percentage || 0, is_ten_dates_chit ? 1 : 0, req.params.id)
    );

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const updatedGroup = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id) as Group
    );
    
    // Convert is_ten_dates_chit from number to boolean
    const processedGroup = {
      ...updatedGroup,
      is_ten_dates_chit: Boolean(updatedGroup.is_ten_dates_chit)
    };
    
    res.json(processedGroup);
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
    }    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');

    // Ensure the member_name column exists for backwards compatibility
    await GroupTableService.ensureMemberNameColumn(id, group.name);

    const members = await withRetry(() => 
      db.prepare(`
        SELECT gm.member_id as id, gm.member_name as name, m.phone, m.email, m.address, m.status, gm.group_id
        FROM ${groupMembersTableName} gm
        LEFT JOIN members m ON m.id = gm.member_id
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
    );    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Get the member details first
    const member = await withRetry(() => 
      db.prepare('SELECT * FROM members WHERE id = ?').get(member_id)
    ) as { id: number; name: string } | undefined;
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');

    // Ensure the member_name column exists for backwards compatibility
    await GroupTableService.ensureMemberNameColumn(id, group.name);
    
    const result = await withRetry(() => 
      db.prepare(`
        INSERT INTO ${groupMembersTableName} (group_id, member_id, member_name, group_member_id, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, member_id, member.name, `GM${id}_${member_id}`, new Date().toISOString())
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
    }    // Get the dynamic table name for group members
    const groupMembersTableName = GroupTableService.getTableName(id, group.name, 'group_members');

    // Ensure the member_name column exists for backwards compatibility
    await GroupTableService.ensureMemberNameColumn(id, group.name);

    // Get member details before the transaction
    const memberDetailsMap = new Map();
    for (const member of members) {
      const memberDetails = await withRetry(() => 
        db.prepare('SELECT name FROM members WHERE id = ?').get(member.id)
      ) as { name: string } | undefined;
      
      if (!memberDetails) {
        return res.status(404).json({ error: `Member with id ${member.id} not found` });
      }
      
      memberDetailsMap.set(member.id, memberDetails.name);
    }

    // Delete existing members and add new ones in a transaction
    await executeTransaction(db, () => {
      // Delete all existing members
      db.prepare(`DELETE FROM ${groupMembersTableName} WHERE group_id = ?`).run(id);

      // Add new members
      for (const member of members) {
        const memberName = memberDetailsMap.get(member.id);
        db.prepare(`
          INSERT INTO ${groupMembersTableName} (group_id, member_id, member_name, group_member_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `).run(id, member.id, memberName, member.groupMemberId, new Date().toISOString());
      }
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
    }    // Get the dynamic table name for monthly subscriptions
    const subscriptionsTableName = GroupTableService.getTableName(id, group.name, 'monthly_subscription');

    // First, get existing export status for all months to preserve them
    const existingExportStatus = await withRetry(() => 
      db.prepare(`
        SELECT month_number, is_exported 
        FROM ${subscriptionsTableName} 
        WHERE group_id = ?
      `).all(id) as { month_number: number, is_exported: number }[]
    );

    // Create a map for quick lookup
    const exportStatusMap = new Map<number, number>();
    existingExportStatus.forEach(row => {
      exportStatusMap.set(row.month_number, row.is_exported);
    });

    // Delete existing subscriptions for this group
    await withRetry(() => 
      db.prepare(`DELETE FROM ${subscriptionsTableName} WHERE group_id = ?`).run(id)
    );

    // Insert new subscriptions while preserving export status
    for (const sub of subscriptions) {
      const preservedExportStatus = exportStatusMap.get(sub.month_number) || 0;
      await withRetry(() => 
        db.prepare(`
          INSERT INTO ${subscriptionsTableName} (group_id, month_number, bid_amount, total_dividend, distributed_dividend, monthly_subscription, is_exported, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, sub.month_number, sub.bid_amount || 0, sub.total_dividend || 0, sub.distributed_dividend || 0, sub.monthly_subscription || 0, preservedExportStatus, new Date().toISOString())
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

// Endpoint to regenerate chit dates for an existing group (admin function)
router.post('/:id/regenerate-chit-dates', async (req, res) => {
  const db = dbPool.getWriteConnection();
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
    
    // Delete existing chit dates
    await withRetry(() => 
      db.prepare(`DELETE FROM ${chitDatesTableName} WHERE group_id = ?`).run(id)
    );
    
    // Generate new chit dates
    await generateInitialChitDates(group);
    
    // Fetch and return the updated chit dates
    const updatedChitDates = await withRetry(() => 
      db.prepare(`
        SELECT * FROM ${chitDatesTableName} WHERE group_id = ? ORDER BY chit_date
      `).all(id)
    );
    
    res.json({
      message: 'Chit dates regenerated successfully',
      count: updatedChitDates.length,
      dates: updatedChitDates
    });
  } catch (error) {
    console.error('Error regenerating chit dates:', error);
    res.status(500).json({ error: 'Failed to regenerate chit dates' });
  }
});

export default router;