// Standalone cron process (no HTTP server) - Next.js has no native persistent-background-job
// hook, so this keeps the same pattern the Express backend used: a long-lived Node process
// running the cron loop, started alongside `next dev`/`next start` via `concurrently`.
import cron from 'node-cron';
import { db } from '../lib/db.server';

export const purgeDeletedData = async () => {
  console.log('Running tier-aware auto-purge for soft-deleted items...');

  try {
    const tablesToPurge = ['notes', 'ledger_entries', 'udhaar', 'bills', 'khata_customers', 'khata_transactions', 'products', 'stock_movements'];

    for (const table of tablesToPurge) {
      // We do a self-join/USING approach for Postgres DELETE
      const result = await db.query(`
        DELETE FROM ${table}
        USING users
        WHERE ${table}.user_id = users.id
          AND ${table}.is_deleted = true
          AND (
            (users.license_type = 'FREE' AND ${table}.deleted_at < NOW() - INTERVAL '30 days')
            OR
            (users.license_type IN ('PRO', 'LIFETIME') AND ${table}.deleted_at < NOW() - INTERVAL '60 days')
          )
      `);
      console.log(`Purged ${result.rowCount} entries from ${table}.`);
    }

    console.log('Tier-aware auto-purge completed successfully.');
  } catch (err) {
    console.error('Error during auto-purge:', err);
  }
};

export const downgradeExpiredLicenses = async () => {
  console.log('Checking for expired PRO licenses...');
  try {
    // LIFETIME never has license_expiry set, so it's untouched. gatingService also
    // checks expiry live on every request, so this is a correctness/visibility fix
    // for the admin panel rather than the primary enforcement.
    const result = await db.query(`
      UPDATE users SET license_type = 'FREE', license_expiry = NULL
      WHERE license_type = 'PRO' AND license_expiry IS NOT NULL AND license_expiry < NOW()
    `);
    console.log(`Downgraded ${result.rowCount} expired PRO users to FREE.`);
  } catch (err) {
    console.error('Error during license expiry downgrade:', err);
  }
};

function setupCronJobs() {
  // Run everyday at midnight
  cron.schedule('0 0 * * *', purgeDeletedData);
  cron.schedule('0 0 * * *', downgradeExpiredLicenses);
}

if (require.main === module) {
  console.log('MindVault cron process starting...');
  setupCronJobs();
}
