const postgres = require('postgres');
const { scryptSync, randomBytes } = require('crypto');
require('dotenv').config({ path: 'c:/Users/ASUS/OneDrive/Documents/KAEL System/web/.env.local' });
const sql = postgres(process.env.DATABASE_URL);

function hashPin(pin) {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

async function setup() {
  const businessId = 'ab25ae3d-5df7-4143-a429-79d1982ef87f';
  
  // 1. Staff: Rizka, Nada, Yola
  const staffToCreate = [
    { name: 'Rizka', pin: '0001' },
    { name: 'Nada', pin: '0002' },
    { name: 'Yola', pin: '0003' }
  ];

  for (const s of staffToCreate) {
    const existing = await sql`SELECT id FROM users WHERE business_id = ${businessId} AND name ILIKE ${s.name}`;
    if (existing.length > 0) {
      console.log('Updating PIN for existing user:', s.name);
      await sql`UPDATE users SET pin_hash = ${hashPin(s.pin)}, is_active = true WHERE id = ${existing[0].id}`;
    } else {
      console.log('Creating new staff:', s.name);
      await sql`
        INSERT INTO users (business_id, role, name, pin_hash, failed_pin_attempts, is_active, permissions)
        VALUES (${businessId}, 'staff', ${s.name}, ${hashPin(s.pin)}, 0, true, ARRAY['pos'])
      `;
    }
  }

  // 2. Attendance Site
  const existingSites = await sql`SELECT * FROM attendance_sites WHERE business_id = ${businessId}`;
  let site;
  if (existingSites.length > 0) {
    console.log('Site already exists, updating coordinates and radius...');
    const updated = await sql`
      UPDATE attendance_sites
      SET latitude = -0.4552244,
          longitude = 100.4144805,
          allowed_radius_meters = 100,
          google_place_id = 'ChIJb-e__AUl1S8Re7J-tmJMMnQ',
          is_active = true
      WHERE id = ${existingSites[0].id}
      RETURNING *
    `;
    site = updated[0];
  } else {
    console.log('Creating attendance site for Mochi Cafe...');
    const created = await sql`
      INSERT INTO attendance_sites (
        business_id, name, latitude, longitude, allowed_radius_meters, is_active, google_place_id
      ) VALUES (
        ${businessId}, 'Mochi Cafe n Resto', -0.4552244, 100.4144805, 100, true, 'ChIJb-e__AUl1S8Re7J-tmJMMnQ'
      ) RETURNING *
    `;
    site = created[0];
  }

  const allStaff = await sql`SELECT id, name, role, is_active FROM users WHERE business_id = ${businessId}`;
  console.log('ALL USERS IN MOCHI CAFE:');
  console.table(allStaff);
  console.log('ATTENDANCE SITE:');
  console.log({
    id: site.id,
    name: site.name,
    latitude: site.latitude,
    longitude: site.longitude,
    allowed_radius_meters: site.allowed_radius_meters,
    qr_token: site.qr_token
  });
  process.exit(0);
}

setup().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
