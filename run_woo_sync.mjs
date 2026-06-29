import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET;
const APP_ID = process.env.VITE_APP_ID || 'r2b-ops';
const TARGET = 'https://r2bclass-94klu95d.manus.space/api/scheduled/woo-sync';

if (!JWT_SECRET) {
  console.error('JWT_SECRET not set');
  process.exit(1);
}

const secret = new TextEncoder().encode(JWT_SECRET);
const now = Math.floor(Date.now() / 1000);

// Mint a short-lived cron session JWT (same shape as sdk.signSession)
const token = await new SignJWT({
  openId: 'cron_r2b_woo_sync',
  appId: APP_ID,
  name: 'Manus Scheduled Task',
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .setExpirationTime(now + 300)
  .sign(secret);

console.log('Calling woo-sync with cron JWT...');

const resp = await fetch(TARGET, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': `app_session_id=${token}`,
  },
});

const body = await resp.text();
console.log(`Status: ${resp.status}`);
console.log(`Response: ${body}`);
