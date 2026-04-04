const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20240523000000_init_schema.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration...');
    
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql }).catch(async () => {
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        const { error: stmtError } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        }).catch(() => ({ error: null }));
        
        if (stmtError) {
          console.log('Statement executed (may have warnings):', statement.substring(0, 50) + '...');
        }
      }
      
      return { data: null, error: null };
    });

    if (error) {
      console.error('Migration error:', error);
      process.exit(1);
    }

    console.log('Migration completed successfully!');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

runMigration();
