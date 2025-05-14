import express from 'express';
import { db } from '../database/setup';

const router = express.Router();

// Get all members
router.get('/', (req, res) => {
  const members = db.prepare('SELECT * FROM members').all();
  res.json(members);
});

// Get member by ID
router.get('/:id', (req, res) => {
  const member = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }
  res.json(member);
});

// Create new member
router.post('/', (req, res) => {
  const { name, phone, address, email } = req.body;
  
  const result = db.prepare(`
    INSERT INTO members (name, phone, address, email)
    VALUES (?, ?, ?, ?)
  `).run(name, phone, address, email);

  const newMember = db.prepare('SELECT * FROM members WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newMember);
});

// Update member
router.put('/:id', (req, res) => {
  const { name, phone, address, email } = req.body;
  
  const result = db.prepare(`
    UPDATE members 
    SET name = ?, phone = ?, address = ?, email = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name, phone, address, email, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const updatedMember = db.prepare('SELECT * FROM members WHERE id = ?').get(req.params.id);
  res.json(updatedMember);
});

// Delete member
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM members WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Member not found' });
  }
  
  res.status(204).send();
});

export default router; 