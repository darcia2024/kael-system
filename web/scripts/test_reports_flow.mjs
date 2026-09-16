import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const sql = postgres(process.env.POSTGRES_URL || process.env.DATABASE_URL, {
  ssl: { rejectUnauthorized: false },
  max: 1
});

async function main() {
  const bizId = 'e1d8f3fb-40ea-4072-be0e-0119f80b1075';
  
  // 1. Check getBusiness
  const business = (await sql`SELECT * FROM businesses WHERE id = ${bizId}`)[0];
  console.log('Business:', business ? business.name : 'NULL');

  // 2. Check getAllFeedback
  const rawFeedbacks = await sql`
    SELECT f.*, c.name AS customer_name, c.phone AS customer_phone, o.order_no, k.label AS card_label
    FROM member_feedback f
    LEFT JOIN customers c ON c.id = f.customer_id
    LEFT JOIN orders o ON o.id = f.order_id
    LEFT JOIN cards k ON k.id = f.card_id
    WHERE f.business_id = ${bizId}
    ORDER BY f.created_at DESC
    LIMIT 1000
  `;
  console.log('Raw feedbacks length:', rawFeedbacks.length);
  console.log('All feedbacks:', JSON.stringify(rawFeedbacks, null, 2));

  // 3. Check getFeedbackSummary
  const totals = await sql`
    SELECT COUNT(*)::int AS total, COALESCE(AVG(rating), 0)::numeric(10,2) AS avg_rating,
      COUNT(*) FILTER (WHERE rating <= 3)::int AS low_count
    FROM member_feedback
    WHERE business_id = ${bizId}
  `;
  console.log('Totals:', totals);

  // 4. Map feedbacks like in ReviewReportsPage
  const feedbacks = rawFeedbacks.map((f) => ({
    ...f,
    created_at: f.created_at
      ? typeof f.created_at === 'string'
        ? f.created_at
        : new Date(f.created_at).toISOString()
      : new Date().toISOString(),
  }));
  console.log('Mapped feedbacks[0]:', feedbacks[0]);

  // 5. Test Filter logic in review-reports-client
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const startOf7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const startOf30d = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const thisMonthPrefix = now.toISOString().slice(0, 7);

  const filtered = feedbacks.filter((f) => {
    const fIso = f.created_at
      ? typeof f.created_at === 'string'
        ? f.created_at
        : new Date(f.created_at).toISOString()
      : '';
    const fDay = fIso.slice(0, 10);
    return true;
  });
  console.log('Filtered length:', filtered.length);

  await sql.end();
}

main().catch(console.error);
