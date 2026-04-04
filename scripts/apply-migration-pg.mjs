import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('❌ Missing DATABASE_URL in .env.local');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString: databaseUrl,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!');

    console.log('📖 Reading migration file...');
    const migrationPath = join(__dirname, '../supabase/migrations/20240523000000_init_schema.sql');
    const sql = readFileSync(migrationPath, 'utf8');

    console.log('🚀 Applying migration...\n');

    await client.query(sql);

    console.log('\n✨ Migration completed successfully!');
    console.log('📊 All tables, indexes, triggers, and RLS policies have been created.');

  } catch (err) {
    console.error('❌ Migration error:', err.message);
    if (err.detail) console.error('Details:', err.detail);
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed.');
  }
}

runMigration();
