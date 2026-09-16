import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function main() {
  const users = await sql`SELECT email, role, business_id, name, (password_hash IS NOT NULL) as has_password FROM users WHERE role IN ('owner', 'kael_admin')`;
  console.log('Admin and owner users:', users);
  
  await sql.end();
}

main().catch(console.error);
