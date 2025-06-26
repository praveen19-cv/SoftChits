const Database = require('better-sqlite3');
const path = require('path');

// Initialize database connection
const dbPath = path.join(__dirname, 'data', 'chitfund.db');
const db = new Database(dbPath);

console.log('Starting migration to add daily_collection_summary tables...');

try {
  // Get all existing groups
  const groups = db.prepare('SELECT id, name FROM groups').all();
  console.log(`Found ${groups.length} groups to migrate`);

  for (const group of groups) {
    const groupId = group.id;
    const groupName = group.name;
    
    // Generate table name using the same logic as GroupTableService
    const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const dailySummaryTableName = `daily_collection_summary_${groupId}_${sanitizedName}`;
    
    console.log(`Creating daily summary table for group: ${groupName} (ID: ${groupId})`);
    console.log(`Table name: ${dailySummaryTableName}`);

    // Create daily_collection_summary table for this group
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${dailySummaryTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_date TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
        total_members_paid INTEGER NOT NULL DEFAULT 0,
        collection_agent_id INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        UNIQUE(group_id, collection_date)
      )
    `).run();

    // Populate historical data if collections exist
    // Try multiple possible naming conventions for collection table
    const possibleTableNames = [
      `collection_${groupId}_${sanitizedName}`,                    // New consistent naming
      `collection_${groupId}_${groupName.toUpperCase()}`,          // Legacy uppercase
      `collection_${groupId}_${groupName.toLowerCase()}`,          // Legacy lowercase
      `collection_${groupId}_${groupName}`                         // Direct name
    ];
    
    let collectionTableName = null;
    let tableExists = false;
    
    // Check which table naming convention exists
    for (const tableName of possibleTableNames) {
      const exists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name = ?
      `).get(tableName);
      
      if (exists) {
        collectionTableName = tableName;
        tableExists = true;
        console.log(`  Found existing collection table: ${collectionTableName}`);
        break;
      }
    }
    
    if (!tableExists) {
      console.log(`  No existing collection table found for group: ${groupName}`);
      console.log(`  Checked possible names: ${possibleTableNames.join(', ')}`);
    }

    if (tableExists && collectionTableName) {
      console.log(`  Processing data from: ${collectionTableName}`);
      
      // Get unique collection dates and calculate totals
      try {
        const dailyTotals = db.prepare(`
          SELECT 
            collection_date,
            SUM(CAST(collection_amount AS DECIMAL)) as total_amount,
            COUNT(DISTINCT member_id) as total_members_paid
          FROM ${collectionTableName}
          WHERE group_id = ?
          GROUP BY collection_date
          ORDER BY collection_date
        `).all(groupId);

        console.log(`  Found ${dailyTotals.length} unique collection dates`);

        // Insert historical daily summaries
        for (const daily of dailyTotals) {
          try {
            db.prepare(`
              INSERT OR REPLACE INTO ${dailySummaryTableName} (
                collection_date, group_id, total_amount, total_members_paid, collection_agent_id
              ) VALUES (?, ?, ?, ?, 1)
            `).run(daily.collection_date, groupId, daily.total_amount, daily.total_members_paid);
            
            console.log(`    Added summary for ${daily.collection_date}: ₹${daily.total_amount} from ${daily.total_members_paid} members`);
          } catch (insertError) {
            console.error(`    Error inserting summary for ${daily.collection_date}:`, insertError.message);
          }
        }
      } catch (queryError) {
        console.error(`  Error querying collection data from ${collectionTableName}:`, queryError.message);
        
        // Try to get table schema to debug
        try {
          const schema = db.prepare(`PRAGMA table_info(${collectionTableName})`).all();
          console.log(`  Table schema for ${collectionTableName}:`, schema.map(col => `${col.name}(${col.type})`).join(', '));
        } catch (schemaError) {
          console.error(`  Could not get table schema:`, schemaError.message);
        }
      }
    }

    console.log(`✓ Completed migration for group: ${groupName}\n`);
  }

  console.log('✅ Migration completed successfully!');
  console.log('\nDaily collection summary tables have been added to all existing groups.');
  console.log('Historical data has been populated where collection records exist.');
  
  // Verification: Count total summary tables created
  const summaryTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name LIKE 'daily_collection_summary_%'
  `).all();
  
  console.log(`\n📊 Verification: Created ${summaryTables.length} daily summary tables:`);
  summaryTables.forEach(table => {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`  - ${table.name}: ${count.count} records`);
  });

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
}
