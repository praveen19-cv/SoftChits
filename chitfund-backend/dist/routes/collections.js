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
    const collections = setup_1.db.prepare('SELECT * FROM collection_groupid_groupname').all();
    res.json(collections);
});
// Get collection by ID
router.get('/:id', (req, res) => {
    const collection = setup_1.db.prepare('SELECT * FROM collection_groupid_groupname WHERE id = ?').get(req.params.id);
    if (!collection) {
        return res.status(404).json({ error: 'Collection not found' });
    }
    res.json(collection);
});
// Create new collection
router.post('/', (req, res) => {
    const { group_id, member_id, installment_number, collection_amount, collection_date } = req.body;
    // Start a transaction
    setup_1.db.prepare('BEGIN TRANSACTION').run();
    try {
        // Get current balance from collection_balance_groupid_groupname
        const balanceRecord = setup_1.db.prepare(`
            SELECT * FROM collection_balance_groupid_groupname 
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
        `).get(group_id, member_id, installment_number);
        let remaining_balance;
        let total_paid;
        if (!balanceRecord) {
            // If no balance record exists, create one
            remaining_balance = collection_amount; // Initial balance
            total_paid = collection_amount;
            setup_1.db.prepare(`
                INSERT INTO collection_balance_groupid_groupname 
                (group_id, member_id, installment_number, total_paid, remaining_balance, is_completed)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(group_id, member_id, installment_number, total_paid, remaining_balance, 0);
        } else {
            // Update existing balance record
            total_paid = balanceRecord.total_paid + collection_amount;
            remaining_balance = balanceRecord.remaining_balance - collection_amount;
            setup_1.db.prepare(`
                UPDATE collection_balance_groupid_groupname 
                SET total_paid = ?, remaining_balance = ?, is_completed = ?
                WHERE group_id = ? AND member_id = ? AND installment_number = ?
            `).run(
                total_paid,
                remaining_balance,
                remaining_balance <= 0 ? 1 : 0,
                group_id,
                member_id,
                installment_number
            );
        }
        // Insert new collection record
        const result = setup_1.db.prepare(`
            INSERT INTO collection_groupid_groupname 
            (collection_date, group_id, member_id, installment_number, collection_amount, remaining_balance, is_completed)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            collection_date,
            group_id,
            member_id,
            installment_number,
            collection_amount,
            remaining_balance,
            remaining_balance <= 0 ? 1 : 0
        );
        setup_1.db.prepare('COMMIT').run();
        const newCollection = setup_1.db.prepare('SELECT * FROM collection_groupid_groupname WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newCollection);
    } catch (error) {
        setup_1.db.prepare('ROLLBACK').run();
        res.status(500).json({ error: 'Failed to create collection', details: error.message });
    }
});
// Update collection
router.put('/:id', (req, res) => {
    const { group_id, member_id, installment_number, collection_amount, collection_date } = req.body;
    setup_1.db.prepare('BEGIN TRANSACTION').run();
    try {
        // Get the old collection record
        const oldCollection = setup_1.db.prepare('SELECT * FROM collection_groupid_groupname WHERE id = ?').get(req.params.id);
        if (!oldCollection) {
            setup_1.db.prepare('ROLLBACK').run();
            return res.status(404).json({ error: 'Collection not found' });
        }
        // Update balance record
        const balanceRecord = setup_1.db.prepare(`
            SELECT * FROM collection_balance_groupid_groupname 
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
        `).get(group_id, member_id, installment_number);
        if (balanceRecord) {
            const total_paid = balanceRecord.total_paid - oldCollection.collection_amount + collection_amount;
            const remaining_balance = balanceRecord.remaining_balance + oldCollection.collection_amount - collection_amount;
            setup_1.db.prepare(`
                UPDATE collection_balance_groupid_groupname 
                SET total_paid = ?, remaining_balance = ?, is_completed = ?
                WHERE group_id = ? AND member_id = ? AND installment_number = ?
            `).run(
                total_paid,
                remaining_balance,
                remaining_balance <= 0 ? 1 : 0,
                group_id,
                member_id,
                installment_number
            );
        }
        // Update collection record
        const result = setup_1.db.prepare(`
            UPDATE collection_groupid_groupname 
            SET collection_date = ?, group_id = ?, member_id = ?, 
                installment_number = ?, collection_amount = ?, 
                remaining_balance = ?, is_completed = ?
            WHERE id = ?
        `).run(
            collection_date,
            group_id,
            member_id,
            installment_number,
            collection_amount,
            balanceRecord ? balanceRecord.remaining_balance : remaining_balance,
            balanceRecord ? (balanceRecord.remaining_balance <= 0 ? 1 : 0) : 0,
            req.params.id
        );
        setup_1.db.prepare('COMMIT').run();
        const updatedCollection = setup_1.db.prepare('SELECT * FROM collection_groupid_groupname WHERE id = ?').get(req.params.id);
        res.json(updatedCollection);
    } catch (error) {
        setup_1.db.prepare('ROLLBACK').run();
        res.status(500).json({ error: 'Failed to update collection', details: error.message });
    }
});
// Delete collection
router.delete('/:id', (req, res) => {
    setup_1.db.prepare('BEGIN TRANSACTION').run();
    try {
        // Get the collection to be deleted
        const collection = setup_1.db.prepare('SELECT * FROM collection_groupid_groupname WHERE id = ?').get(req.params.id);
        if (!collection) {
            setup_1.db.prepare('ROLLBACK').run();
            return res.status(404).json({ error: 'Collection not found' });
        }
        // Update balance record
        const balanceRecord = setup_1.db.prepare(`
            SELECT * FROM collection_balance_groupid_groupname 
            WHERE group_id = ? AND member_id = ? AND installment_number = ?
        `).get(collection.group_id, collection.member_id, collection.installment_number);
        if (balanceRecord) {
            const total_paid = balanceRecord.total_paid - collection.collection_amount;
            const remaining_balance = balanceRecord.remaining_balance + collection.collection_amount;
            setup_1.db.prepare(`
                UPDATE collection_balance_groupid_groupname 
                SET total_paid = ?, remaining_balance = ?, is_completed = ?
                WHERE group_id = ? AND member_id = ? AND installment_number = ?
            `).run(
                total_paid,
                remaining_balance,
                remaining_balance <= 0 ? 1 : 0,
                collection.group_id,
                collection.member_id,
                collection.installment_number
            );
        }
        // Delete collection record
        setup_1.db.prepare('DELETE FROM collection_groupid_groupname WHERE id = ?').run(req.params.id);
        setup_1.db.prepare('COMMIT').run();
        res.status(204).send();
    } catch (error) {
        setup_1.db.prepare('ROLLBACK').run();
        res.status(500).json({ error: 'Failed to delete collection', details: error.message });
    }
});
exports.default = router;
