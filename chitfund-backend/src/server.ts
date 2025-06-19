import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initializeDatabase } from './database/setup';
import memberRoutes from './routes/members';
import groupRoutes from './routes/groups';
import collectionRoutes from './routes/collections';
import authRoutes from './routes/auth';
import collectionBalanceRoutes from './routes/collection_balance';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Routes
app.use('/api/members', memberRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/collection-balance', collectionBalanceRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    console.log('Database initialized successfully');

    // Start server
    app.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();