const Database = require('better-sqlite3');
const path = require('path');

// Initialize database connection
const dbPath = path.join(__dirname, 'data', 'chitfund.db');
const db = new Database(dbPath);

console.log('Checking collection table names and data retrieval...');

// Helper function to get table name (same as GroupTableService)
function getTableName(groupId, groupName, tableType) {
  const sanitizedName = groupName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  return `${tableType}_${groupId}_${sanitizedName}`;
}

try {
  // Get all groups
  const groups = db.prepare('SELECT id, name FROM groups ORDER BY id').all();
  console.log(`🔍 Found ${groups.length} groups to check`);

  for (const group of groups) {
    const groupId = group.id;
    const groupName = group.name;
    
    console.log(`\n📊 Checking group: ${groupName} (ID: ${groupId})`);
    
    // Expected table name using consistent naming
    const expectedCollectionTable = getTableName(groupId, groupName, 'collection');
    const expectedSummaryTable = getTableName(groupId, groupName, 'daily_collection_summary');
    
    console.log(`  Expected collection table: ${expectedCollectionTable}`);
    console.log(`  Expected summary table: ${expectedSummaryTable}`);
    
    // Check what collection tables actually exist for this group
    const existingTables = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name LIKE '%collection%${groupId}%'
      ORDER BY name
    `).all();
    
    console.log(`  Existing collection-related tables:`);
    existingTables.forEach(table => {
      console.log(`    - ${table.name}`);
      
      // Check if it has data
      try {
        const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
        console.log(`      Records: ${count.count}`);
        
        // If it's a collection table, show sample dates
        if (table.name.includes('collection_') && !table.name.includes('balance') && !table.name.includes('summary')) {
          const sampleDates = db.prepare(`
            SELECT DISTINCT collection_date 
            FROM ${table.name} 
            ORDER BY collection_date DESC 
            LIMIT 3
          `).all();
          
          if (sampleDates.length > 0) {
            console.log(`      Recent dates: ${sampleDates.map(d => d.collection_date).join(', ')}`);
          }
        }
      } catch (e) {
        console.log(`      Error reading: ${e.message}`);
      }
    });
    
    // Check if expected table exists and matches actual table
    const expectedTableExists = existingTables.some(t => t.name === expectedCollectionTable);
    if (!expectedTableExists && existingTables.length > 0) {
      console.log(`  ⚠️  WARNING: Expected table ${expectedCollectionTable} not found!`);
      console.log(`     This could cause collection retrieval issues.`);
      
      // Check for legacy naming patterns
      const legacyPatterns = [
        `collection_${groupId}_${groupName.toUpperCase()}`,
        `collection_${groupId}_${groupName.toLowerCase()}`,
        `collection_${groupId}_${groupName}`
      ];
      
      const legacyTable = legacyPatterns.find(pattern => 
        existingTables.some(t => t.name === pattern)
      );
      
      if (legacyTable) {
        console.log(`     Found legacy table: ${legacyTable}`);
        console.log(`     Consider migrating to: ${expectedCollectionTable}`);
      }
    } else if (expectedTableExists) {
      console.log(`  ✅ Collection table naming is correct`);
    }
    
    // Test API endpoint path simulation
    console.log(`  🔗 API endpoint would be: /collections/by-date-group/${groupId}/YYYY-MM-DD`);
  }
  
  console.log('\n📋 Summary:');
  console.log('- Check the warnings above for any table naming mismatches');
  console.log('- If legacy tables are found, consider running the migration script');
  console.log('- The API uses GroupTableService.getTableName() which follows the new naming convention');
  
} catch (error) {
  console.error('❌ Check failed:', error);
  process.exit(1);
} finally {
  db.close();
}
