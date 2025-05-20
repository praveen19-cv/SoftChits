import express from 'express';
import { getDb } from '../database/setup';

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
  const db = getDb();
  try {
    const members = await withRetry(() => 
      db.prepare('SELECT * FROM members ORDER BY name').all()
    );
    res.json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});

// Get member by ID
router.get('/:id', async (req, res) => {
  const db = getDb();
  try {
    const member = await withRetry(() => 
      db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.params.id))
    );
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
  const db = getDb();
  try {
    const { name, phone, address, email, status = 'active' } = req.body;
    const now = new Date().toISOString();
    
    const result = await withRetry(() => 
      db.prepare(`
        INSERT INTO members (name, phone, address, email, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(name, phone, address, email, status, now, now)
    );

    const newMember = await withRetry(() => 
      db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid)
    );
    res.status(201).json(newMember);
  } catch (error) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: 'Failed to create member' });
  }
});

// Update member
router.put('/:id', async (req, res) => {
  const db = getDb();
  try {
    const { name, phone, address, email, status } = req.body;
    const member = await withRetry(() => 
      db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.params.id))
    );
    
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const updates = [];
    const values = [];
    if (name) { updates.push('name = ?'); values.push(name); }
    if (phone) { updates.push('phone = ?'); values.push(phone); }
    if (address) { updates.push('address = ?'); values.push(address); }
    if (email) { updates.push('email = ?'); values.push(email); }
    if (status) { updates.push('status = ?'); values.push(status); }
    
    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(Number(req.params.id));

    const query = `UPDATE members SET ${updates.join(', ')} WHERE id = ?`;
    await withRetry(() => db.prepare(query).run(...values));

    const updatedMember = await withRetry(() => 
      db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.params.id))
    );
    res.json(updatedMember);
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: 'Failed to update member' });
  }
});

// Delete member
router.delete('/:id', async (req, res) => {
  const db = getDb();
  try {
    const member = await withRetry(() => 
      db.prepare('SELECT * FROM members WHERE id = ?').get(Number(req.params.id))
    );
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    await withRetry(() => 
      db.prepare('DELETE FROM members WHERE id = ?').run(Number(req.params.id))
    );
    res.json({ message: 'Member deleted successfully' });
  } catch (error) {
    console.error('Error deleting member:', error);
    res.status(500).json({ error: 'Failed to delete member' });
  }
});

export default router; 