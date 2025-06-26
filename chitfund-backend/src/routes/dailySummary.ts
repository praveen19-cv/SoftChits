import express from 'express';
import { getReadDb } from '../database/setup';
import { DailyCollectionSummaryService } from '../database/dailyCollectionSummary';
import { withRetry } from '../utils/dbUtils';

const router = express.Router();

interface Group {
  id: number;
  name: string;
}

// Get daily summaries for a group
router.get('/:groupId', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const { date, startDate, endDate } = req.query;
    const db = getReadDb();
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    let summaries;
    
    if (startDate && endDate) {
      // Get summaries for date range
      summaries = await DailyCollectionSummaryService.getSummariesByDateRange(
        groupId, 
        group.name, 
        startDate as string, 
        endDate as string
      );
    } else if (date) {
      // Get summary for specific date
      summaries = await DailyCollectionSummaryService.getSummaries(
        groupId, 
        group.name, 
        date as string
      );
    } else {
      // Get all summaries
      summaries = await DailyCollectionSummaryService.getSummaries(groupId, group.name);
    }

    res.json(summaries);
  } catch (error: any) {
    console.error('Error fetching daily summaries:', error);
    res.status(500).json({ 
      error: 'Failed to fetch daily summaries',
      details: error.message 
    });
  }
});

// Get monthly summary for a group
router.get('/:groupId/monthly/:year/:month', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const db = getReadDb();
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const monthlySummary = await DailyCollectionSummaryService.getMonthlySummary(
      groupId, 
      group.name, 
      year, 
      month
    );

    res.json({
      group_id: groupId,
      group_name: group.name,
      year,
      month,
      ...monthlySummary
    });
  } catch (error: any) {
    console.error('Error fetching monthly summary:', error);
    res.status(500).json({ 
      error: 'Failed to fetch monthly summary',
      details: error.message 
    });
  }
});

// Update/recalculate daily summary for specific date
router.post('/:groupId/update', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const { collection_date } = req.body;
    const db = getReadDb();
    
    if (!collection_date) {
      return res.status(400).json({ error: 'collection_date is required' });
    }
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await DailyCollectionSummaryService.updateSummary(groupId, group.name, collection_date);

    // Get the updated summary
    const updatedSummary = await DailyCollectionSummaryService.getSummaries(
      groupId, 
      group.name, 
      collection_date
    );

    res.json({
      message: 'Daily summary updated successfully',
      summary: updatedSummary[0] || null
    });
  } catch (error: any) {
    console.error('Error updating daily summary:', error);
    res.status(500).json({ 
      error: 'Failed to update daily summary',
      details: error.message 
    });
  }
});

// Rebuild all daily summaries for a group
router.post('/:groupId/rebuild', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const db = getReadDb();
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await DailyCollectionSummaryService.rebuildSummaries(groupId, group.name);

    res.json({
      message: `Daily summaries rebuilt successfully for group: ${group.name}`
    });
  } catch (error: any) {
    console.error('Error rebuilding daily summaries:', error);
    res.status(500).json({ 
      error: 'Failed to rebuild daily summaries',
      details: error.message 
    });
  }
});

// Delete daily summary for specific date
router.delete('/:groupId/:date', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const { date } = req.params;
    const db = getReadDb();
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    await DailyCollectionSummaryService.deleteSummary(groupId, group.name, date);

    res.json({
      message: `Daily summary deleted successfully for ${group.name} on ${date}`
    });
  } catch (error: any) {
    console.error('Error deleting daily summary:', error);
    res.status(500).json({ 
      error: 'Failed to delete daily summary',
      details: error.message 
    });
  }
});

// Get statistics/analytics for a group
router.get('/:groupId/analytics', async (req, res) => {
  try {
    const groupId = Number(req.params.groupId);
    const { period = '30' } = req.query; // Default to last 30 days
    const db = getReadDb();
    
    // Get group details
    const group = await withRetry(() => 
      db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId) as Group | undefined
    );
    
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    // Calculate date range
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - Number(period) * 24 * 60 * 60 * 1000)
      .toISOString().split('T')[0];

    const summaries = await DailyCollectionSummaryService.getSummariesByDateRange(
      groupId, 
      group.name, 
      startDate, 
      endDate
    );

    // Calculate analytics
    const totalAmount = summaries.reduce((sum, s) => sum + s.total_amount, 0);
    const totalMembersPaid = summaries.reduce((sum, s) => sum + s.total_members_paid, 0);
    const collectionDays = summaries.length;
    const averageDailyAmount = collectionDays > 0 ? totalAmount / collectionDays : 0;
    const averageMembersPerDay = collectionDays > 0 ? totalMembersPaid / collectionDays : 0;

    // Find best and worst collection days
    const bestDay = summaries.reduce((max, s) => s.total_amount > max.total_amount ? s : max, 
      summaries[0] || { total_amount: 0, collection_date: '' });
    const worstDay = summaries.reduce((min, s) => s.total_amount < min.total_amount ? s : min, 
      summaries[0] || { total_amount: 0, collection_date: '' });

    res.json({
      group_id: groupId,
      group_name: group.name,
      period_days: Number(period),
      date_range: { start_date: startDate, end_date: endDate },
      analytics: {
        total_amount: totalAmount,
        total_members_paid: totalMembersPaid,
        collection_days: collectionDays,
        average_daily_amount: averageDailyAmount,
        average_members_per_day: averageMembersPerDay,
        best_collection_day: {
          date: bestDay?.collection_date,
          amount: bestDay?.total_amount,
          members_paid: bestDay?.total_members_paid
        },
        worst_collection_day: {
          date: worstDay?.collection_date,
          amount: worstDay?.total_amount,
          members_paid: worstDay?.total_members_paid
        }
      },
      daily_data: summaries
    });
  } catch (error: any) {
    console.error('Error fetching daily analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch daily analytics',
      details: error.message 
    });
  }
});

export default router;
