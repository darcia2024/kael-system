import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function main() {
  const b1 = 'ab25ae3d-5df7-4143-a429-79d1982ef87f'; // Mochi Cafe n Resto
  const modules = await sql`SELECT * FROM business_modules WHERE business_id = ${b1}`;
  console.log('Business modules for Mochi Cafe n Resto:', modules);

  const allModules = await sql`SELECT bm.*, b.name as b_name FROM business_modules bm LEFT JOIN businesses b ON bm.business_id = b.id`;
  console.log('All business modules:', allModules);
  
  await sql.end();
}

main().catch(console.error);
