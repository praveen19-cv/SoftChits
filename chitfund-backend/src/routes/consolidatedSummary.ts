import express from 'express';
import { ConsolidatedDailySummaryService } from '../database/consolidatedDailySummary';

const router = express.Router();

/**
 * GET /api/consolidated-summary/date/:date
 * Get consolidated daily summary for a specific date
 */
router.get('/date/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const summary = await ConsolidatedDailySummaryService.getConsolidatedSummaryByDate(date);
    
    if (!summary) {
      return res.status(404).json({ error: 'No summary found for this date' });
    }

    res.json(summary);
  } catch (error: any) {
    console.error('Error fetching consolidated summary by date:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch consolidated summary' });
  }
});

/**
 * GET /api/consolidated-summary/range
 * Get consolidated daily summaries for a date range
 */
router.get('/range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate query parameters are required' });
    }

    // Validate date formats
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate as string) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate as string)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    const summaries = await ConsolidatedDailySummaryService.getConsolidatedSummaryRange(
      startDate as string, 
      endDate as string
    );

    res.json(summaries);
  } catch (error: any) {
    console.error('Error fetching consolidated summary range:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch consolidated summaries' });
  }
});

/**
 * GET /api/consolidated-summary/top-days
 * Get top collection days
 */
router.get('/top-days', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const limitNum = parseInt(limit as string) || 10;

    if (limitNum < 1 || limitNum > 100) {
      return res.status(400).json({ error: 'Limit must be between 1 and 100' });
    }

    const topDays = await ConsolidatedDailySummaryService.getTopCollectionDays(limitNum);
    res.json(topDays);
  } catch (error: any) {
    console.error('Error fetching top collection days:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch top collection days' });
  }
});

/**
 * GET /api/consolidated-summary/monthly/:year/:month
 * Get monthly consolidated totals
 */
router.get('/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ error: 'Invalid year or month' });
    }

    const monthlyTotals = await ConsolidatedDailySummaryService.getMonthlyTotals(yearNum, monthNum);
    res.json(monthlyTotals);
  } catch (error: any) {
    console.error('Error fetching monthly totals:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch monthly totals' });
  }
});

/**
 * POST /api/consolidated-summary/rebuild
 * Rebuild all consolidated summaries (admin operation)
 */
router.post('/rebuild', async (req, res) => {
  try {
    console.log('Starting manual rebuild of consolidated summaries...');
    await ConsolidatedDailySummaryService.rebuildAllConsolidatedSummaries();
    
    res.json({ 
      message: 'Consolidated summaries rebuilt successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error rebuilding consolidated summaries:', error);
    res.status(500).json({ error: error.message || 'Failed to rebuild consolidated summaries' });
  }
});

/**
 * PUT /api/consolidated-summary/update/:date
 * Update consolidated summary for a specific date
 */
router.put('/update/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    await ConsolidatedDailySummaryService.updateConsolidatedSummary(date);
    
    const updatedSummary = await ConsolidatedDailySummaryService.getConsolidatedSummaryByDate(date);
    
    res.json({ 
      message: 'Consolidated summary updated successfully',
      summary: updatedSummary,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error updating consolidated summary:', error);
    res.status(500).json({ error: error.message || 'Failed to update consolidated summary' });
  }
});

export default router;
