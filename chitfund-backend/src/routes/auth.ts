import express from 'express';
import { db } from '../database/setup';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface User {
  id: number;
  name: string;
  email: string;
  password: string;
  role: string;
}

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  if (existingUser) {
    return res.status(400).json({ error: 'User already exists' });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create user
  const result = db.prepare(`
    INSERT INTO users (name, email, password, role)
    VALUES (?, ?, ?, ?)
  `).run(name, email, hashedPassword, role);

  const newUser = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(result.lastInsertRowid) as User;
  res.status(201).json(newUser);
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Find user
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as User | undefined;
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Check password
  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT token
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    }
  });
});

export default router; 