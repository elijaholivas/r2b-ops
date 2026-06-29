/**
 * Runs the WooCommerce sync directly against the live database,
 * bypassing HTTP auth (used by the scheduled cron agent).
 */
import 'dotenv/config';
import { runWooSync } from './server/wooSync.ts';

try {
  console.log('[WooSync] Starting direct sync...');
  const result = await runWooSync();
  console.log('[WooSync] Complete:', JSON.stringify(result, null, 2));
  process.exit(0);
} catch (err) {
  console.error('[WooSync] Error:', err.message);
  process.exit(1);
}
