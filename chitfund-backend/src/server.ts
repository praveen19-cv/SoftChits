import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { setupDatabase } from './database/setup';
import memberRoutes from './routes/members';
import groupRoutes from './routes/groups';
import collectionRoutes from './routes/collections';
import authRoutes from './routes/auth';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
setupDatabase();

// Routes
app.use('/api/members', memberRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/auth', authRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
}); 