import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check what times are stored for the imported classes
const [rows] = await conn.execute(
  "SELECT id, title, startDatetime, endDatetime, wooProductId FROM classes ORDER BY startDatetime LIMIT 20"
);

console.log("=== Stored class times ===");
rows.forEach(r => {
  const start = r.startDatetime;
  const end = r.endDatetime;
  const hasWoo = r.wooProductId ? 'WOO' : 'WIX';
  console.log(`[${hasWoo}] ${r.title.substring(0,45).padEnd(45)} | start: ${start} | end: ${end}`);
});

await conn.end();
