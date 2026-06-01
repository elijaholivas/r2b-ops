import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute('SELECT wooBaseUrl, wooConsumerKey, wooConsumerSecret FROM integrationSettings LIMIT 1');
await conn.end();

if (!rows.length) { console.log('No settings found'); process.exit(1); }
const { wooBaseUrl, wooConsumerKey, wooConsumerSecret } = rows[0];
console.log('Store URL:', wooBaseUrl);
console.log('Key prefix:', wooConsumerKey?.substring(0, 8));

// Fetch product 1466 with full meta_data
const url = wooBaseUrl.replace(/\/$/, '') + '/wp-json/wc/v3/products/1466';
const auth = Buffer.from(wooConsumerKey + ':' + wooConsumerSecret).toString('base64');
const res = await fetch(url, { headers: { Authorization: 'Basic ' + auth } });
const data = await res.json();
console.log('HTTP Status:', res.status);
console.log('\n=== meta_data ===');
console.log(JSON.stringify(data.meta_data, null, 2));
console.log('\n=== class_date entries ===');
const classDateEntries = (data.meta_data || []).filter(m => m.key === 'class_date' || m.key?.includes('class'));
console.log(JSON.stringify(classDateEntries, null, 2));
