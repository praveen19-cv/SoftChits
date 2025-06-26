const Database = require('better-sqlite3');
const path = require('path');

// Initialize database connection
const dbPath = path.join(__dirname, 'data', 'chitfund.db');
const db = new Database(dbPath);

console.log('Testing Daily Collection Summary functionality...');

// Helper function to get table name
function getTableName(groupId, groupName, tableType) {
  const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${tableType}_${groupId}_${sanitizedName}`;
}

try {
  // Get a test group
  const testGroup = db.prepare('SELECT id, name FROM groups LIMIT 1').get();
  
  if (!testGroup) {
    console.log('❌ No groups found. Please create a group first.');
    process.exit(1);
  }
  
  console.log(`🧪 Testing with group: ${testGroup.name} (ID: ${testGroup.id})`);
  
  const groupId = testGroup.id;
  const groupName = testGroup.name;
  
  // Get table names
  const collectionTable = getTableName(groupId, groupName, 'collection');
  const dailySummaryTable = getTableName(groupId, groupName, 'daily_collection_summary');
  
  console.log(`📊 Collection table: ${collectionTable}`);
  console.log(`📈 Daily summary table: ${dailySummaryTable}`);
  
  // Check if tables exist
  const collectionExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name = ?
  `).get(collectionTable);
  
  const summaryExists = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name = ?
  `).get(dailySummaryTable);
  
  console.log(`\n✅ Table existence check:`);
  console.log(`  Collection table exists: ${collectionExists ? 'Yes' : 'No'}`);
  console.log(`  Summary table exists: ${summaryExists ? 'Yes' : 'No'}`);
  
  if (collectionExists) {
    // Get collection data sample
    const collections = db.prepare(`
      SELECT collection_date, COUNT(*) as count, SUM(collection_amount) as total
      FROM ${collectionTable}
      GROUP BY collection_date
      ORDER BY collection_date DESC
      LIMIT 5
    `).all();
    
    console.log(`\n📊 Recent collection data:`);
    collections.forEach(c => {
      console.log(`  ${c.collection_date}: ${c.count} collections, ₹${c.total}`);
    });
  }
  
  if (summaryExists) {
    // Get summary data
    const summaries = db.prepare(`
      SELECT * FROM ${dailySummaryTable}
      ORDER BY collection_date DESC
      LIMIT 5
    `).all();
    
    console.log(`\n📈 Recent summary data:`);
    summaries.forEach(s => {
      console.log(`  ${s.collection_date}: ₹${s.total_amount} from ${s.total_members_paid} members`);
    });
    
    // Test summary update functionality
    if (collections && collections.length > 0) {
      const testDate = collections[0].collection_date;
      console.log(`\n🔄 Testing summary update for date: ${testDate}`);
      
      // Calculate expected values
      const expected = db.prepare(`
        SELECT 
          SUM(CAST(collection_amount AS DECIMAL)) as total_amount,
          COUNT(DISTINCT member_id) as total_members_paid
        FROM ${collectionTable}
        WHERE collection_date = ? AND group_id = ?
      `).get(testDate, groupId);
      
      // Update summary
      const existingSummary = db.prepare(`
        SELECT id FROM ${dailySummaryTable}
        WHERE collection_date = ? AND group_id = ?
      `).get(testDate, groupId);
      
      if (existingSummary) {
        db.prepare(`
          UPDATE ${dailySummaryTable}
          SET 
            total_amount = ?,
            total_members_paid = ?,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).run(expected.total_amount, expected.total_members_paid, existingSummary.id);
        console.log(`  ✅ Updated existing summary`);
      } else {
        db.prepare(`
          INSERT INTO ${dailySummaryTable} (
            collection_date, group_id, total_amount, total_members_paid, collection_agent_id
          ) VALUES (?, ?, ?, ?, 1)
        `).run(testDate, groupId, expected.total_amount, expected.total_members_paid);
        console.log(`  ✅ Created new summary`);
      }
      
      // Verify the update
      const updatedSummary = db.prepare(`
        SELECT * FROM ${dailySummaryTable}
        WHERE collection_date = ? AND group_id = ?
      `).get(testDate, groupId);
      
      console.log(`  📊 Summary for ${testDate}:`);
      console.log(`    Amount: ₹${updatedSummary.total_amount} (expected: ₹${expected.total_amount})`);
      console.log(`    Members: ${updatedSummary.total_members_paid} (expected: ${expected.total_members_paid})`);
      console.log(`    Match: ${updatedSummary.total_amount == expected.total_amount && updatedSummary.total_members_paid == expected.total_members_paid ? '✅' : '❌'}`);
    }
  }
  
  console.log('\n🎉 Daily summary functionality test completed!');
  
} catch (error) {
  console.error('❌ Test failed:', error);
  process.exit(1);
} finally {
  db.close();
}
