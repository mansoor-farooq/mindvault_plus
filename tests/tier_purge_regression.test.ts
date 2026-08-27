// Regression test for the tier-aware auto-purge cron job, re-pointed at the new
// standalone scripts/cron.ts (ported from backend/cronJobs.js).
import assert from 'assert';
import { db } from '../lib/db.server';
import { purgeDeletedData } from '../scripts/cron';

async function runTest() {
  console.log('--- STARTING TIER PURGE REGRESSION TEST (Next.js scripts/cron.ts) ---');
  let freeUserId: number | undefined, proUserId: number | undefined;

  try {
    // 1. Create FREE and PRO users
    let res = await db.query(`
      INSERT INTO users (full_name, password_hash, email, license_type)
      VALUES ('free user', 'pass', 'free_nextjs_purge@purge.com', 'FREE') RETURNING id
    `);
    freeUserId = res.rows[0].id;

    res = await db.query(`
      INSERT INTO users (full_name, password_hash, email, license_type)
      VALUES ('pro user', 'pass', 'pro_nextjs_purge@purge.com', 'PRO') RETURNING id
    `);
    proUserId = res.rows[0].id;

    // 2. Insert items deleted 45 days ago for both users
    const date45DaysAgo = new Date();
    date45DaysAgo.setDate(date45DaysAgo.getDate() - 45);

    // Notes
    await db.query(
      `
      INSERT INTO notes (frontend_id, user_id, title, description, type, category, is_deleted, deleted_at)
      VALUES
      ('free_note_45_nextjs', $1, 'Test', 'Desc', 'TEXT', 'Cat', true, $3),
      ('pro_note_45_nextjs', $2, 'Test', 'Desc', 'TEXT', 'Cat', true, $3)
    `,
      [freeUserId, proUserId, date45DaysAgo]
    );

    // Khata Customers
    await db.query(
      `
      INSERT INTO khata_customers (frontend_id, user_id, name, is_deleted, deleted_at)
      VALUES
      ('free_cust_45_nextjs', $1, 'Test', true, $3),
      ('pro_cust_45_nextjs', $2, 'Test', true, $3)
    `,
      [freeUserId, proUserId, date45DaysAgo]
    );

    // 3. Run purge
    console.log('Running purge logic...');
    await purgeDeletedData();

    // 4. Verify FREE user items are GONE (since 45 > 30)
    console.log('Verifying FREE user items are purged...');
    const freeNotes = await db.query('SELECT * FROM notes WHERE user_id = $1', [freeUserId]);
    const freeCusts = await db.query('SELECT * FROM khata_customers WHERE user_id = $1', [freeUserId]);

    assert.strictEqual(freeNotes.rows.length, 0, 'FREE user notes should be deleted');
    assert.strictEqual(freeCusts.rows.length, 0, 'FREE user khata_customers should be deleted');
    console.log('✅ FREE user items successfully purged (30 day limit).');

    // 5. Verify PRO user items REMAIN (since 45 < 60)
    console.log('Verifying PRO user items remain...');
    const proNotes = await db.query('SELECT * FROM notes WHERE user_id = $1', [proUserId]);
    const proCusts = await db.query('SELECT * FROM khata_customers WHERE user_id = $1', [proUserId]);

    assert.strictEqual(proNotes.rows.length, 1, 'PRO user notes should NOT be deleted');
    assert.strictEqual(proCusts.rows.length, 1, 'PRO user khata_customers should NOT be deleted');
    console.log('✅ PRO user items successfully retained (60 day limit).');

    console.log('--- ALL TIER PURGE TESTS PASSED ---');
  } catch (err) {
    console.error('❌ TEST FAILED:', err);
    process.exitCode = 1;
  } finally {
    if (freeUserId) {
      await db.query('DELETE FROM khata_customers WHERE user_id = $1', [freeUserId]);
      await db.query('DELETE FROM notes WHERE user_id = $1', [freeUserId]);
      await db.query('DELETE FROM users WHERE id = $1', [freeUserId]);
    }
    if (proUserId) {
      await db.query('DELETE FROM khata_customers WHERE user_id = $1', [proUserId]);
      await db.query('DELETE FROM notes WHERE user_id = $1', [proUserId]);
      await db.query('DELETE FROM users WHERE id = $1', [proUserId]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
