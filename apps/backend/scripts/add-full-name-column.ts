import { Pool } from 'pg';

async function addFullNameColumn() {
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'si_user',
    password: 'si_password_dev',
    database: 'si_crypto',
  });

  try {
    console.log('Connecting to database...');

    // Add full_name column if it doesn't exist
    const query = `ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);`;

    await pool.query(query);

    console.log('✅ Successfully added full_name column to users table');

    // Verify the column was added
    const verifyQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'full_name';
    `;

    const result = await pool.query(verifyQuery);

    if (result.rows.length > 0) {
      console.log('✅ Column verified:', result.rows[0]);
    } else {
      console.log('⚠️  Column not found after adding');
    }

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding column:', error);
    await pool.end();
    process.exit(1);
  }
}

addFullNameColumn();
