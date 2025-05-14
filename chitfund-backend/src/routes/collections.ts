import express from 'express';
import { db } from '../database/setup';

const router = express.Router();

// Get all collections
router.get('/', (req, res) => {
  try {
    const collections = db.prepare('SELECT * FROM collections').all();
    res.json(collections);
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Get collection by ID
router.get('/:id', (req, res) => {
  try {
    const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
});

// Create new collection
router.post('/', (req, res) => {
  try {
    const { group_id, member_id, amount, collection_date, status } = req.body;
    const result = db.prepare(`
      INSERT INTO collections (group_id, member_id, amount, collection_date, status)
      VALUES (?, ?, ?, ?, ?)
    `).run(group_id, member_id, amount, collection_date, status);

    const newCollection = db.prepare('SELECT * FROM collections WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newCollection);
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
});

// Update collection
router.put('/:id', (req, res) => {
  try {
    const { group_id, member_id, amount, collection_date, status } = req.body;
    const result = db.prepare(`
      UPDATE collections 
      SET group_id = ?, member_id = ?, amount = ?, collection_date = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(group_id, member_id, amount, collection_date, status, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const updatedCollection = db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    res.json(updatedCollection);
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
});

// Delete collection
router.delete('/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Collection not found' });
    }
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
});

export default router; 