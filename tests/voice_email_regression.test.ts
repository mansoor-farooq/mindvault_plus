// Regression test for the Voice-to-Email feature's strict, ad-free gating. Same pattern
// as the note voice-chat gate: 'voice_email' is a VIP feature key with no ad-bypass path,
// unlocked only by an active PRO/LIFETIME license or an explicit admin grant.
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../lib/db.server';
import { getUserFeatureAccess } from '../lib/services/featureAccessService';
import { POST as voiceEmailPOST } from '../app/api/ai/voice-email/route';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

function tokenFor(userId: number) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function authedRequest(userId: number, body: unknown) {
  return new NextRequest('http://localhost:3000/api/ai/voice-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userId)}` },
    body: JSON.stringify(body),
  });
}

async function runTest() {
  console.log('--- STARTING VOICE EMAIL REGRESSION TEST ---');
  let freeUserId: number | undefined, lifetimeUserId: number | undefined;

  try {
    const freeRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Voice Email Free', 'pass', 'voiceemail_free_nextjs_test@test.com', 'FREE') RETURNING id`);
    freeUserId = freeRes.rows[0].id;
    const lifetimeRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Voice Email Lifetime', 'pass', 'voiceemail_lifetime_nextjs_test@test.com', 'LIFETIME') RETURNING id`);
    lifetimeUserId = lifetimeRes.rows[0].id;
    console.log(`Created FREE user (${freeUserId}) and LIFETIME user (${lifetimeUserId})`);

    // 1. Catalog defaults
    const freeAccess = await getUserFeatureAccess(freeUserId!);
    assert.strictEqual(freeAccess.voice_email, false, 'FREE user should not have voice_email by default');
    const lifetimeAccess = await getUserFeatureAccess(lifetimeUserId!);
    assert.strictEqual(lifetimeAccess.voice_email, true, 'LIFETIME user should have voice_email auto-unlocked');
    console.log('✅ Catalog defaults correct for FREE vs LIFETIME.');

    // 2. Route-level enforcement: FREE user is rejected with 403 before any AI call
    const res = await voiceEmailPOST(authedRequest(freeUserId!, {
      audio: { mimeType: 'audio/webm', base64: 'ZmFrZS1hdWRpby1ieXRlcw==' },
    }));
    assert.strictEqual(res.status, 403, 'FREE user must be rejected');
    const body = await res.json();
    assert.strictEqual(body.error, 'FEATURE_NOT_AVAILABLE');
    assert.strictEqual(body.feature, 'voice_email');
    console.log('✅ Attack blocked: FREE user cannot reach voice-email drafting - no ad-bypass exists.');

    // 3. Missing audio is a 400, not a silent pass-through, for an entitled user
    const missingAudioRes = await voiceEmailPOST(authedRequest(lifetimeUserId!, {}));
    assert.strictEqual(missingAudioRes.status, 400, 'Missing audio should be a validation error for an entitled user');
    console.log('✅ Entitled user still requires an actual audio payload (validation intact).');

    console.log('--- ALL VOICE EMAIL TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [freeUserId, lifetimeUserId].filter(Boolean) as number[]) {
      await db.query('DELETE FROM user_feature_access WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM feature_usage WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
