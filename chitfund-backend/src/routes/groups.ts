import express from 'express';
import { db } from '../database/setup';

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
router.post('/', (req, res) => {
  try {
    const { name, total_amount, member_count, start_date, end_date, status, number_of_months } = req.body;
    const result = db.prepare(`
      INSERT INTO groups (name, total_amount, member_count, start_date, end_date, status, number_of_months)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, total_amount, member_count, start_date, end_date, status, number_of_months);

    const newGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newGroup);
  } catch (error) {
    console.error('Error creating group:', error);
    res.status(500).json({ message: 'Failed to create group' });
  }
});

// Update group
router.put('/:id', (req, res) => {
  try {
    const { name, total_amount, member_count, start_date, end_date, status, number_of_months } = req.body;
    const result = db.prepare(`
      UPDATE groups 
      SET name = ?, total_amount = ?, member_count = ?, start_date = ?, end_date = ?, status = ?, number_of_months = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, total_amount, member_count, start_date, end_date, status, number_of_months, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const updatedGroup = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
    res.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    res.status(500).json({ message: 'Failed to update group' });
  }
});

// Delete group
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ message: 'Group not found' });
    }
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Error deleting group:', error);
    res.status(500).json({ message: 'Failed to delete group' });
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
    const { chitDates } = req.body;
    
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

      for (const chitDate of chitDates) {
        insertStmt.run(req.params.id, chitDate.chit_date, chitDate.amount);
      }

      // Commit the transaction
      db.prepare('COMMIT').run();

      res.json({ message: 'Chit dates updated successfully' });
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

export default router; 