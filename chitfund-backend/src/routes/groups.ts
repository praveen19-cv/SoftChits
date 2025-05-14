import express from 'express';
import { db } from '../database/setup';

const router = express.Router();

// Get all groups
router.get('/', (req, res) => {
  const groups = db.prepare('SELECT * FROM chit_groups').all();
  res.json(groups);
});

// Get group by ID
router.get('/:id', (req, res) => {
  const group = db.prepare('SELECT * FROM chit_groups WHERE id = ?').get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  res.json(group);
});

// Create new group
router.post('/', (req, res) => {
  const { name, total_amount, member_count, start_date, end_date, status } = req.body;
  
  const result = db.prepare(`
    INSERT INTO chit_groups (name, total_amount, member_count, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, total_amount, member_count, start_date, end_date, status);

  const newGroup = db.prepare('SELECT * FROM chit_groups WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(newGroup);
});

// Update group
router.put('/:id', (req, res) => {
  const { name, total_amount, member_count, start_date, end_date, status } = req.body;
  
  const result = db.prepare(`
    UPDATE chit_groups 
    SET name = ?, total_amount = ?, member_count = ?, start_date = ?, end_date = ?, status = ?
    WHERE id = ?
  `).run(name, total_amount, member_count, start_date, end_date, status, req.params.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }

  const updatedGroup = db.prepare('SELECT * FROM chit_groups WHERE id = ?').get(req.params.id);
  res.json(updatedGroup);
});

// Delete group
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM chit_groups WHERE id = ?').run(req.params.id);
  
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Group not found' });
  }
  
  res.status(204).send();
});

export default router; 