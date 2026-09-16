import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function main() {
  const biz = await sql`SELECT id, name FROM businesses`;
  console.log('Businesses:', biz);
  const users = await sql`SELECT id, email, role, business_id, name, is_active FROM users`;
  console.log('Users:', users);
  
  await sql.end();
}

main().catch(console.error);
