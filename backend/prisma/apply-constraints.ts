import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  console.log('🔌 Applying raw SQL constraints, indexes, and triggers using pg client...\n');
  
  // Read database connection string from environment
  const connectionString = process.env.DATABASE_URL || 'postgresql://dentalmarket:dentalmarket_dev@localhost:5432/dentalmarket';
  
  const client = new Client({ connectionString });
  await client.connect();
  
  const sqlPath = path.join(__dirname, 'migrations', '00_constraints_and_triggers.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  try {
    await client.query(sql);
    console.log('✅ Custom check constraints, partial indexes, GIN index, and updated_at triggers applied successfully!');
  } finally {
    await client.end();
  }
}

main()
  .catch((e) => {
    console.error('❌ Failed to apply constraints:', e);
    process.exit(1);
  });
