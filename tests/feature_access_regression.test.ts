// Regression test for the per-user feature access / VIP system: an admin can grant/revoke
// a feature for a specific user, the merged access map reflects it, a disabled feature's
// actual API route rejects the call server-side (not just hidden client-side), and an
// active PRO/LIFETIME license unlocks VIP features automatically (paying for the license IS
// what unlocks VIP - admin overrides are for exceptions on top of that, not the only path in).
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../lib/db.server';
import { getUserFeatureAccess, setUserFeatureAccess } from '../lib/services/featureAccessService';
import { GET as gameStatusGET } from '../app/api/games/status/route';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

function tokenFor(userId: number) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function authedRequest(url: string, userId: number) {
  return new NextRequest(url, { headers: { Authorization: `Bearer ${tokenFor(userId)}` } });
}

async function runTest() {
  console.log('--- STARTING FEATURE ACCESS REGRESSION TEST ---');
  let userId: number | undefined;
  let lifetimeUserId: number | undefined;
  let expiredProUserId: number | undefined;

  try {
    const res = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Feature Access Test', 'pass', 'featureaccess_nextjs_test@test.com', 'FREE') RETURNING id`);
    userId = res.rows[0].id;
    console.log(`Created test user (${userId})`);

    // 1. Defaults for a FREE user: non-VIP enabled, VIP disabled
    let access = await getUserFeatureAccess(userId!);
    assert.strictEqual(access.inventory, true, 'Non-VIP feature should default to enabled');
    assert.strictEqual(access.analytics, false, 'VIP feature should default to disabled');
    console.log('✅ Default access map correct (non-VIP=enabled, VIP=disabled).');

    // 2. Admin grants a VIP feature
    await setUserFeatureAccess(userId!, 'analytics', true);
    access = await getUserFeatureAccess(userId!);
    assert.strictEqual(access.analytics, true, 'VIP feature should be enabled after explicit grant');
    console.log('✅ VIP feature grant persisted correctly.');

    // 3. Admin revokes a normally-free feature
    await setUserFeatureAccess(userId!, 'money_quiz', false);
    access = await getUserFeatureAccess(userId!);
    assert.strictEqual(access.money_quiz, false, 'Feature should be disabled after explicit revoke');
    console.log('✅ Feature revoke persisted correctly.');

    // 4. Server-side enforcement: disabled feature's actual route must reject the call
    const res1 = await gameStatusGET(authedRequest('http://localhost:3000/api/games/status', userId!));
    assert.strictEqual(res1.status, 403, 'Disabled feature route should return 403, not just be hidden client-side');
    const body1 = await res1.json();
    assert.strictEqual(body1.error, 'FEATURE_NOT_AVAILABLE');
    console.log('✅ Server-side enforcement blocks the disabled feature route (403), not just client-side hiding.');

    // 5. Re-enable and confirm it works again
    await setUserFeatureAccess(userId!, 'money_quiz', true);
    const res2 = await gameStatusGET(authedRequest('http://localhost:3000/api/games/status', userId!));
    assert.strictEqual(res2.status, 200, 'Re-enabled feature route should succeed again');
    console.log('✅ Re-enabling a feature immediately restores API access.');

    // 6. LIFETIME license unlocks VIP features automatically, with no admin override needed
    const lifetimeRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Lifetime VIP Test', 'pass', 'featureaccess_lifetime_nextjs_test@test.com', 'LIFETIME') RETURNING id`);
    lifetimeUserId = lifetimeRes.rows[0].id;
    const lifetimeAccess = await getUserFeatureAccess(lifetimeUserId!);
    assert.strictEqual(lifetimeAccess.analytics, true, 'LIFETIME license should unlock VIP features by default');
    assert.strictEqual(lifetimeAccess.notes_ai, true, 'LIFETIME license should unlock all VIP features, not just one');
    console.log('✅ LIFETIME license auto-unlocks VIP features with no admin override needed.');

    // 7. An expired PRO license does NOT get the auto-unlock (must fall back to FREE defaults)
    const expiredProRes = await db.query(
      `INSERT INTO users (full_name, password_hash, email, license_type, license_expiry) VALUES ('Expired PRO Test', 'pass', 'featureaccess_expiredpro_nextjs_test@test.com', 'PRO', NOW() - INTERVAL '1 day') RETURNING id`
    );
    expiredProUserId = expiredProRes.rows[0].id;
    const expiredProAccess = await getUserFeatureAccess(expiredProUserId!);
    assert.strictEqual(expiredProAccess.analytics, false, 'An expired PRO license should NOT auto-unlock VIP features');
    console.log('✅ Expired PRO license correctly falls back to FREE (VIP-gated) defaults.');

    console.log('--- ALL FEATURE ACCESS TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    if (userId) {
      await db.query('DELETE FROM user_feature_access WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (lifetimeUserId) await db.query('DELETE FROM users WHERE id = $1', [lifetimeUserId]);
    if (expiredProUserId) await db.query('DELETE FROM users WHERE id = $1', [expiredProUserId]);
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
