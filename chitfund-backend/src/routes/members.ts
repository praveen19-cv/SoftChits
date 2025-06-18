import express from 'express';
import { getReadDb, getWriteDb } from '../database/setup';

const router = express.Router();

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

// Get all members
router.get('/', async (req, res) => {
  const db = getReadDb();
  try {
    const members = db.prepare('SELECT * FROM members').all();
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', async (req, res) => {
  const db = getReadDb();
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
router.post('/', async (req, res) => {
  const db = getWriteDb();
  try {
    const { name, phone, email, address } = req.body;
    
    const result = db.prepare(`
      INSERT INTO members (name, phone, email, address)
      VALUES (?, ?, ?, ?)
    `).run(name, phone, email, address);

    const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newMember);
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/:id', async (req, res) => {
  const db = getWriteDb();
  try {
    const { name, phone, email, address } = req.body;
    
    const result = db.prepare(`
      UPDATE members
      SET name = ?, phone = ?, email = ?, address = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, phone, email, address, req.params.id);

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
router.delete('/:id', async (req, res) => {
  const db = getWriteDb();
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