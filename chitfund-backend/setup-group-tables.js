const Database = require('better-sqlite3');
const path = require('path');

// Initialize database connection
const dbPath = path.join(__dirname, 'data', 'chitfund.db');
const db = new Database(dbPath);

console.log('Starting comprehensive group tables setup and migration...');

// Helper function to get sanitized table name
function getTableName(groupId, groupName, tableType) {
  if (!groupId || !groupName || isNaN(Number(groupId))) {
    throw new Error(`Invalid groupId or groupName for table creation: ${groupId}, ${groupName}`);
  }
  const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${tableType}_${groupId}_${sanitizedName}`;
}

// Create all necessary tables for a group
function createGroupTables(groupId, groupName) {
  const tables = [];
  
  try {
    console.log(`\n📁 Setting up tables for group: ${groupName} (ID: ${groupId})`);

    // 1. Create collections table
    const collectionsTableName = getTableName(groupId, groupName, 'collection');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${collectionsTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_date TEXT NOT NULL,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        installment_number INTEGER NOT NULL,
        collection_amount DECIMAL(10,2) NOT NULL,
        remaining_balance DECIMAL(10,2) NOT NULL,
        is_completed BOOLEAN NOT NULL DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_remaining_balance REAL,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (member_id) REFERENCES members(id),
        UNIQUE(group_id, member_id, installment_number, collection_date)
      )
    `).run();
    tables.push(collectionsTableName);
    console.log(`  ✓ Created: ${collectionsTableName}`);

    // 2. Create collection balances table
    const collectionBalancesTableName = getTableName(groupId, groupName, 'collection_balance');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${collectionBalancesTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        installment_number INTEGER NOT NULL,
        total_paid DECIMAL(10,2) DEFAULT 0,
        remaining_balance DECIMAL(10,2) DEFAULT 0,
        is_completed BOOLEAN DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        export_month INTEGER,
        is_exported BOOLEAN DEFAULT 0
      )
    `).run();
    tables.push(collectionBalancesTableName);
    console.log(`  ✓ Created: ${collectionBalancesTableName}`);

    // 3. Create group members table
    const groupMembersTableName = getTableName(groupId, groupName, 'group_members');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${groupMembersTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        member_id INTEGER NOT NULL,
        member_name TEXT NOT NULL,
        group_member_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (member_id) REFERENCES members(id)
      )
    `).run();
    tables.push(groupMembersTableName);
    console.log(`  ✓ Created: ${groupMembersTableName}`);

    // 4. Create chit dates table
    const chitDatesTableName = getTableName(groupId, groupName, 'chit_dates');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${chitDatesTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        chit_date TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id)
      )
    `).run();
    tables.push(chitDatesTableName);
    console.log(`  ✓ Created: ${chitDatesTableName}`);

    // 5. Create monthly subscriptions table
    const monthlySubscriptionsTableName = getTableName(groupId, groupName, 'monthly_subscription');
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ${monthlySubscriptionsTableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        month_number INTEGER NOT NULL,
        bid_amount REAL NOT NULL,
        total_dividend REAL NOT NULL,
        distributed_dividend REAL NOT NULL,
        monthly_subscription REAL NOT NULL,
        is_exported BOOLEAN NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id)
      )
    `).run();
    tables.push(monthlySubscriptionsTableName);
    console.log(`  ✓ Created: ${monthlySubscriptionsTableName}`);

    // 6. Create daily collection summary table
    const dailySummaryTableName = getTableName(groupId, groupName, 'daily_collection_summary');
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
    tables.push(dailySummaryTableName);
    console.log(`  ✓ Created: ${dailySummaryTableName}`);

    return tables;
  } catch (error) {
    console.error(`  ❌ Error creating tables for group ${groupName}:`, error);
    throw error;
  }
}

// Migrate historical data to daily summary
function migrateHistoricalData(groupId, groupName) {
  const dailySummaryTableName = getTableName(groupId, groupName, 'daily_collection_summary');
  
  // Try multiple possible naming conventions for collection table
  const possibleTableNames = [
    getTableName(groupId, groupName, 'collection'),                // New consistent naming
    `collection_${groupId}_${groupName.toUpperCase()}`,            // Legacy uppercase
    `collection_${groupId}_${groupName.toLowerCase()}`,            // Legacy lowercase
    `collection_${groupId}_${groupName}`                           // Direct name
  ];
  
  let collectionTableName = null;
  
  // Check which table naming convention exists
  for (const tableName of possibleTableNames) {
    const exists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name = ?
    `).get(tableName);
    
    if (exists) {
      collectionTableName = tableName;
      console.log(`  📊 Found collection data in: ${collectionTableName}`);
      break;
    }
  }
  
  if (!collectionTableName) {
    console.log(`  ℹ️  No existing collection data found for group: ${groupName}`);
    return;
  }
  
  try {
    // Get unique collection dates and calculate totals
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

    console.log(`  📈 Migrating ${dailyTotals.length} daily summaries`);

    // Insert historical daily summaries
    let successCount = 0;
    for (const daily of dailyTotals) {
      try {
        db.prepare(`
          INSERT OR REPLACE INTO ${dailySummaryTableName} (
            collection_date, group_id, total_amount, total_members_paid, collection_agent_id
          ) VALUES (?, ?, ?, ?, 1)
        `).run(daily.collection_date, groupId, daily.total_amount, daily.total_members_paid);
        
        successCount++;
        if (successCount <= 5) {
          console.log(`    ✓ ${daily.collection_date}: ₹${daily.total_amount} from ${daily.total_members_paid} members`);
        } else if (successCount === 6) {
          console.log(`    ... (${dailyTotals.length - 5} more entries)`);
        }
      } catch (insertError) {
        console.error(`    ❌ Error inserting summary for ${daily.collection_date}:`, insertError.message);
      }
    }
    
    console.log(`  ✅ Successfully migrated ${successCount}/${dailyTotals.length} daily summaries`);
    
  } catch (queryError) {
    console.error(`  ❌ Error querying collection data from ${collectionTableName}:`, queryError.message);
    
    // Try to get table schema to debug
    try {
      const schema = db.prepare(`PRAGMA table_info(${collectionTableName})`).all();
      console.log(`  🔍 Table schema for ${collectionTableName}:`, schema.map(col => `${col.name}(${col.type})`).join(', '));
    } catch (schemaError) {
      console.error(`  Could not get table schema:`, schemaError.message);
    }
  }
}

try {
  // Get all existing groups
  const groups = db.prepare('SELECT id, name FROM groups ORDER BY id').all();
  console.log(`🎯 Found ${groups.length} groups to process`);

  if (groups.length === 0) {
    console.log('ℹ️  No groups found in the database. Please create groups first.');
    process.exit(0);
  }

  for (const group of groups) {
    const groupId = group.id;
    const groupName = group.name;
    
    try {
      // Create all necessary tables for this group
      const createdTables = createGroupTables(groupId, groupName);
      
      // Migrate historical data to daily summary table
      migrateHistoricalData(groupId, groupName);
      
      console.log(`✅ Completed setup for group: ${groupName}`);
      
    } catch (groupError) {
      console.error(`❌ Failed to process group ${groupName} (ID: ${groupId}):`, groupError.message);
      // Continue with other groups
    }
  }

  console.log('\n🎉 Migration completed successfully!');
  console.log('All necessary tables have been created for existing groups.');
  console.log('Historical data has been migrated to daily summary tables.');
  
  // Verification: Count total tables created
  const allTables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND (
      name LIKE 'collection_%' OR 
      name LIKE 'collection_balance_%' OR 
      name LIKE 'group_members_%' OR 
      name LIKE 'chit_dates_%' OR 
      name LIKE 'monthly_subscription_%' OR 
      name LIKE 'daily_collection_summary_%'
    )
    ORDER BY name
  `).all();
  
  console.log(`\n📊 Verification: Total group-specific tables: ${allTables.length}`);
  
  // Count by table type
  const tableTypes = ['collection', 'collection_balance', 'group_members', 'chit_dates', 'monthly_subscription', 'daily_collection_summary'];
  tableTypes.forEach(type => {
    const count = allTables.filter(t => t.name.includes(type)).length;
    console.log(`  - ${type} tables: ${count}`);
  });
  
  // Show summary tables and their record counts
  const summaryTables = allTables.filter(t => t.name.includes('daily_collection_summary'));
  console.log(`\n📈 Daily Summary Tables:`);
  summaryTables.forEach(table => {
    try {
      const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
      console.log(`  - ${table.name}: ${count.count} records`);
    } catch (e) {
      console.log(`  - ${table.name}: Error reading records`);
    }
  });

} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
} finally {
  db.close();
  console.log('\n🔒 Database connection closed.');
}
