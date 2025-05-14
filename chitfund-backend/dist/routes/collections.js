"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const setup_1 = require("../database/setup");
const router = express_1.default.Router();
// Get all collections
router.get('/', (req, res) => {
    const collections = setup_1.db.prepare('SELECT * FROM collections').all();
    res.json(collections);
});
// Get collection by ID
router.get('/:id', (req, res) => {
    const collection = setup_1.db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    if (!collection) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
});
// Create new collection
router.post('/', (req, res) => {
    const { member_id, chit_group_id, amount, collection_date, collected_by, payment_mode, status } = req.body;
    const result = setup_1.db.prepare(`
    INSERT INTO collections (member_id, chit_group_id, amount, collection_date, collected_by, payment_mode, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(member_id, chit_group_id, amount, collection_date, collected_by, payment_mode, status);
    const newCollection = setup_1.db.prepare('SELECT * FROM collections WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(newCollection);
});
// Update collection
router.put('/:id', (req, res) => {
    const { member_id, chit_group_id, amount, collection_date, collected_by, payment_mode, status } = req.body;
    const result = setup_1.db.prepare(`
    UPDATE collections 
    SET member_id = ?, chit_group_id = ?, amount = ?, collection_date = ?, 
        collected_by = ?, payment_mode = ?, status = ?
    WHERE id = ?
  `).run(member_id, chit_group_id, amount, collection_date, collected_by, payment_mode, status, req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    const updatedCollection = setup_1.db.prepare('SELECT * FROM collections WHERE id = ?').get(req.params.id);
    res.json(updatedCollection);
});
// Delete collection
router.delete('/:id', (req, res) => {
    const result = setup_1.db.prepare('DELETE FROM collections WHERE id = ?').run(req.params.id);
    if (result.changes === 0) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    res.status(204).send();
});
exports.default = router;
