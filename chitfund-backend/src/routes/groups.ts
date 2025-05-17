import express from 'express';
import { db } from '../database/setup';
import { GroupTableService } from '../services/GroupTableService';

const router = express.Router();

// Get all groups
router.get('/', (req, res) => {
  try {
    console.log('Fetching all groups...');
    const groups = db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();
    console.log('Groups found:', groups);
    res.json(groups);
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: 'Failed to fetch groups' });
  }
});

// Get group by ID
router.get('/:id', (req, res) => {
  try {
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }
    res.json(group);
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ message: 'Failed to fetch group' });
  }
});

// Create new group
router.post('/', async (req, res) => {
  try {
    const { name, total_amount, member_count, start_date, end_date, status, number_of_months, commission_percentage } = req.body;
    
    // Start a transaction
    db.prepare('BEGIN').run();

    try {
      // Insert the group
      const result = db.prepare(`
        INSERT INTO groups (name, total_amount, member_count, start_date, end_date, status, number_of_months, commission_percentage)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, total_amount, member_count, start_date, end_date, status, number_of_months, commission_percentage);

      const groupId = result.lastInsertRowid;

      // Create all necessary tables for this group
      const tables = await GroupTableService.createGroupTables(groupId, name);

      // Commit the transaction
      db.prepare('COMMIT').run();

      const newGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
      res.status(201).json({ ...newGroup, tables });
    } catch (error) {
      // Rollback in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// Update group
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, total_amount, member_count, start_date, end_date, status, number_of_months, commission_percentage } = req.body;
    
    // Start a transaction
    db.prepare('BEGIN').run();

    try {
      // Get the old group name
      const oldGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
      if (!oldGroup) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // Update the group
      db.prepare(`
        UPDATE groups 
        SET name = ?, total_amount = ?, member_count = ?, start_date = ?, 
            end_date = ?, status = ?, number_of_months = ?, commission_percentage = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, total_amount, member_count, start_date, end_date, status, number_of_months, commission_percentage, id);

      // If name changed, rename all related tables
      if (oldGroup.name !== name) {
        // Delete old tables
        await GroupTableService.deleteGroupTables(id, oldGroup.name);
        // Create new tables
        await GroupTableService.createGroupTables(id, name);
      }

      // Commit the transaction
      db.prepare('COMMIT').run();

      const updatedGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
      const tables = GroupTableService.getGroupTableNames(id, name);

      res.json({ ...updatedGroup, tables });
    } catch (error) {
      // Rollback in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
});

// Delete group
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get group details before deletion
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Delete all group-related tables
    await GroupTableService.deleteGroupTables(id, group.name);

    // Delete the group (this will cascade delete related records in other tables)
    db.prepare('DELETE FROM groups WHERE id = ?').run(id);

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
});

// Get group members
router.get('/:id/members', (req, res) => {
  try {
    const members = db.prepare(`
      SELECT m.*, gm.group_member_id 
      FROM group_members gm 
      JOIN members m ON gm.member_id = m.id 
      WHERE gm.group_id = ?
      ORDER BY gm.group_member_id
    `).all(req.params.id);
    res.json(members);
  } catch (error) {
    console.error('Error fetching group members:', error);
    res.status(500).json({ message: 'Failed to fetch group members' });
  }
});

// Add member to group
router.post('/:id/members', (req, res) => {
  try {
    const { memberId, groupMemberId } = req.body;
    const result = db.prepare(`
      INSERT INTO group_members (group_id, member_id, group_member_id)
      VALUES (?, ?, ?)
    `).run(req.params.id, memberId, groupMemberId);

    const newMember = db.prepare(`
      SELECT m.*, gm.group_member_id 
      FROM group_members gm 
      JOIN members m ON gm.member_id = m.id 
      WHERE gm.group_id = ? AND gm.member_id = ?
    `).get(req.params.id, memberId);

    res.status(201).json(newMember);
  } catch (error) {
    console.error('Error adding member to group:', error);
    res.status(500).json({ message: 'Failed to add member to group' });
  }
});

// Remove member from group
router.delete('/:id/members/:memberId', (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM group_members 
      WHERE group_id = ? AND member_id = ?
    `).run(req.params.id, req.params.memberId);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Member not found in group' });
    }

    res.json({ message: 'Member removed from group successfully' });
  } catch (error) {
    console.error('Error removing member from group:', error);
    res.status(500).json({ message: 'Failed to remove member from group' });
  }
});

// Update group members
router.put('/:id/members', (req, res) => {
  try {
    const { members } = req.body;
    
    // Start a transaction
    db.prepare('BEGIN').run();

    try {
      // Delete all existing members
      db.prepare('DELETE FROM group_members WHERE group_id = ?').run(req.params.id);

      // Insert new members
      const insertStmt = db.prepare(`
        INSERT INTO group_members (group_id, member_id, group_member_id)
        VALUES (?, ?, ?)
      `);

      for (const member of members) {
        insertStmt.run(req.params.id, member.id, member.groupMemberId);
      }

      // Update group member count
      db.prepare('UPDATE groups SET member_count = ? WHERE id = ?')
        .run(members.length, req.params.id);

      // Commit the transaction
      db.prepare('COMMIT').run();

      res.json({ message: 'Group members updated successfully' });
    } catch (error) {
      // Rollback in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Error updating group members:', error);
    res.status(500).json({ message: 'Failed to update group members' });
  }
});

// Get chit dates for a group
router.get('/:id/chit-dates', (req, res) => {
  try {
    const chitDates = db.prepare(`
      SELECT * FROM chit_dates 
      WHERE group_id = ? 
      ORDER BY chit_date ASC
    `).all(req.params.id);
    res.json(chitDates);
  } catch (error) {
    console.error('Error fetching chit dates:', error);
    res.status(500).json({ message: 'Failed to fetch chit dates' });
  }
});

// Update chit dates for a group
router.put('/:id/chit-dates', (req, res) => {
  try {
    const { chit_dates } = req.body;
    
    // Start a transaction
    db.prepare('BEGIN').run();

    try {
      // Delete existing chit dates for this group
      db.prepare('DELETE FROM chit_dates WHERE group_id = ?').run(req.params.id);

      // Insert new chit dates
      const insertStmt = db.prepare(`
        INSERT INTO chit_dates (group_id, chit_date, amount)
        VALUES (?, ?, ?)
      `);

      for (const chitDate of chit_dates) {
        insertStmt.run(
          req.params.id,
          chitDate.chit_date,
          chitDate.minimum_amount || 0
        );
      }

      // Commit the transaction
      db.prepare('COMMIT').run();

      // Fetch and return the updated chit dates
      const updatedChitDates = db.prepare(`
        SELECT * FROM chit_dates 
        WHERE group_id = ? 
        ORDER BY chit_date ASC
      `).all(req.params.id);

      res.json(updatedChitDates);
    } catch (error) {
      // Rollback in case of error
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    console.error('Error updating chit dates:', error);
    res.status(500).json({ message: 'Failed to update chit dates' });
  }
});

// Update group commission
router.put('/:id/commission', (req, res) => {
  try {
    const { commission_percentage } = req.body;
    
    // Update the group's commission percentage
    const result = db.prepare(`
      UPDATE groups 
      SET commission_percentage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(commission_percentage, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }

    // Fetch and return the updated group
    const updatedGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group commission:', error);
    res.status(500).json({ message: 'Failed to update group commission' });
  }
});

// Get monthly subscriptions for a group
router.get('/:id/monthly-subscriptions', (req, res) => {
  try {
    const subscriptions = db.prepare(`
      SELECT * FROM monthly_subscriptions 
      WHERE group_id = ? 
      ORDER BY month_number ASC
    `).all(req.params.id);
    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching monthly subscriptions:', error);
    res.status(500).json({ message: 'Failed to fetch monthly subscriptions' });
  }
});

// Update monthly subscriptions for a group
router.put('/:id/monthly-subscriptions', (req, res) => {
  try {
    const { subscriptions } = req.body;
    const groupId = parseInt(req.params.id);
    
    // Validate group exists
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as { id: number; number_of_months: number } | undefined;
    if (!group) {
      console.error('Group not found:', groupId);
      return res.status(404).json({ message: 'Group not found' });
    }

    // Calculate expected months
    const expectedMonths = group.number_of_months + 1;

    // Validate number of months matches group's number_of_months + 1
    if (!Array.isArray(subscriptions) || subscriptions.length !== expectedMonths) {
      console.error('Invalid subscription count:', {
        received: subscriptions?.length,
        expected: expectedMonths
      });
      return res.status(400).json({ 
        message: `Expected ${expectedMonths} months but received ${subscriptions?.length}`
      });
    }

    // Start a transaction
    db.prepare('BEGIN').run();

    try {
      // Delete existing subscriptions for this group
      db.prepare('DELETE FROM monthly_subscriptions WHERE group_id = ?').run(groupId);

      // Insert new subscriptions
      const insertStmt = db.prepare(`
        INSERT INTO monthly_subscriptions (
          group_id, month_number, bid_amount, total_dividend, 
          distributed_dividend, monthly_subscription
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (let i = 0; i < expectedMonths; i++) {
        const sub = subscriptions[i];
        if (!sub) {
          throw new Error(`Missing subscription for month ${i}`);
        }
        const monthNumber = Number(sub.month_number);
        const bidAmount = Number(sub.bid_amount || 0);
        const totalDividend = Number(sub.total_dividend || 0);
        const distributedDividend = Number(sub.distributed_dividend || 0);
        const monthlySubscription = Number(sub.monthly_subscription || 0);
        if (isNaN(monthNumber) || isNaN(bidAmount) || isNaN(totalDividend) || isNaN(distributedDividend) || isNaN(monthlySubscription)) {
          throw new Error(`Invalid numeric values in subscription data for month ${monthNumber}`);
        }
        insertStmt.run(
          groupId,
          monthNumber,
          bidAmount,
          totalDividend,
          distributedDividend,
          monthlySubscription
        );
      }

      // Commit the transaction
      db.prepare('COMMIT').run();

      // Fetch and return the updated subscriptions
      const updatedSubscriptions = db.prepare(`
        SELECT * FROM monthly_subscriptions 
        WHERE group_id = ? 
        ORDER BY month_number ASC
      `).all(groupId);

      res.json(updatedSubscriptions);
    } catch (error) {
      db.prepare('ROLLBACK').run();
      throw error;
    }
  } catch (error) {
    res.status(500).json({ 
      message: 'Failed to update monthly subscriptions',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

// Create tables for existing group
router.post('/:id/create-tables', async (req, res) => {
  try {
    const { id } = req.params;

    // Get group details
    const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(id);
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