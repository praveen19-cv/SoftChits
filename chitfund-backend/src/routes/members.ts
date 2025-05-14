import express from 'express';
import { db } from '../database/setup';

const router = express.Router();

// Get all members
router.get('/', (req, res) => {
  try {
    const members = db.prepare('SELECT * FROM members').all();
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', (req, res) => {
  try {
    const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error) {
    console.error('Error fetching member:', error);
    res.status(500).json({ error: 'Failed to fetch member' });
  }
});

// Create new member
router.post('/', (req, res) => {
  try {
    const { name, phone, address, email, status = 'active' } = req.body;
    const result = db.prepare(`
      INSERT INTO members (name, phone, address, email, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, phone, address, email, status);

    const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newMember);
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/:id', (req, res) => {
  try {
    const { name, phone, address, email, status } = req.body;
    const result = db.prepare(`
      UPDATE members 
      SET name = ?, phone = ?, address = ?, email = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, address, email, status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updatedMember = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
    res.json(updatedMember);
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete member
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

export default router; 