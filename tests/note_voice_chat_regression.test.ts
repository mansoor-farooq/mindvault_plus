// Regression test for the note voice-chat feature's strict, ad-free gating. Unlike text
// chat (gated on 'notes_ai', quota boostable by watching ads), voice messaging is gated on
// a SEPARATE 'notes_voice_chat' feature key with no ad-bypass path at all - it must only be
// reachable via an active PRO/LIFETIME license or an explicit admin grant. This test proves:
// (1) the catalog defaults are correct for FREE vs LIFETIME users, (2) an admin grant on
// 'notes_ai' alone does NOT also unlock voice chat, (3) the actual API route rejects a FREE
// user's audio message with a 403 before ever calling the AI (no real Gemini call needed to
// prove the gate holds), (4) text chat for that same FREE user is unaffected by any of this.
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../lib/db.server';
import { getUserFeatureAccess, setUserFeatureAccess } from '../lib/services/featureAccessService';
import { POST as chatPOST } from '../app/api/ai/notes/chat/route';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

function tokenFor(userId: number) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function authedRequest(userId: number, body: unknown) {
  return new NextRequest('http://localhost:3000/api/ai/notes/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userId)}` },
    body: JSON.stringify(body),
  });
}

async function runTest() {
  console.log('--- STARTING NOTE VOICE CHAT REGRESSION TEST ---');
  let freeUserId: number | undefined, lifetimeUserId: number | undefined;

  try {
    const freeRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Voice Chat Free', 'pass', 'voicechat_free_nextjs_test@test.com', 'FREE') RETURNING id`);
    freeUserId = freeRes.rows[0].id;
    const lifetimeRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Voice Chat Lifetime', 'pass', 'voicechat_lifetime_nextjs_test@test.com', 'LIFETIME') RETURNING id`);
    lifetimeUserId = lifetimeRes.rows[0].id;
    console.log(`Created FREE user (${freeUserId}) and LIFETIME user (${lifetimeUserId})`);

    // 1. Catalog defaults: FREE user has neither text nor voice chat by default
    let freeAccess = await getUserFeatureAccess(freeUserId!);
    assert.strictEqual(freeAccess.notes_ai, false, 'FREE user should not have text chat by default');
    assert.strictEqual(freeAccess.notes_voice_chat, false, 'FREE user should not have voice chat by default');
    console.log('✅ FREE user has neither text nor voice chat by default.');

    // 2. LIFETIME auto-unlocks BOTH (paid status unlocks every VIP feature, including this one)
    const lifetimeAccess = await getUserFeatureAccess(lifetimeUserId!);
    assert.strictEqual(lifetimeAccess.notes_ai, true, 'LIFETIME user should have text chat');
    assert.strictEqual(lifetimeAccess.notes_voice_chat, true, 'LIFETIME user should have voice chat');
    console.log('✅ LIFETIME user has both text and voice chat auto-unlocked.');

    // 3. Critical: an admin granting 'notes_ai' alone to a FREE user must NOT also unlock
    // voice chat - the two keys are intentionally independent.
    await setUserFeatureAccess(freeUserId!, 'notes_ai', true);
    freeAccess = await getUserFeatureAccess(freeUserId!);
    assert.strictEqual(freeAccess.notes_ai, true, 'Admin grant of notes_ai should enable text chat');
    assert.strictEqual(freeAccess.notes_voice_chat, false, 'VULNERABLE: granting notes_ai alone also unlocked voice chat');
    console.log('✅ Admin grant of notes_ai does not leak into notes_voice_chat.');

    // 4. Route-level enforcement: this FREE user (now with notes_ai=true, notes_voice_chat
    // still false) sends an audio message - must be rejected with 403 FEATURE_NOT_AVAILABLE
    // for 'notes_voice_chat', BEFORE any real AI call is made.
    const audioRes = await chatPOST(authedRequest(freeUserId!, {
      note: { title: 'Test idea' },
      history: [],
      audio: { mimeType: 'audio/webm', base64: 'ZmFrZS1hdWRpby1ieXRlcw==' },
    }));
    assert.strictEqual(audioRes.status, 403, 'Voice message from a non-voice-chat-entitled user must be rejected');
    const audioBody = await audioRes.json();
    assert.strictEqual(audioBody.error, 'FEATURE_NOT_AVAILABLE');
    assert.strictEqual(audioBody.feature, 'notes_voice_chat', 'Rejection must be attributed to the voice-chat key specifically');
    console.log('✅ Attack blocked: FREE user (with notes_ai granted) still cannot send a voice message - no ad-bypass exists for this gate.');

    // 5. Same user's TEXT message must still work (notes_ai grant is unaffected by any of
    // the above) - proves the two gates are independent in both directions.
    const textRes = await chatPOST(authedRequest(freeUserId!, {
      note: { title: 'Test idea' },
      history: [],
      message: '', // intentionally empty to fail fast on the 400 check, before any AI call
    }));
    assert.strictEqual(textRes.status, 400, 'Empty text message should hit the validation error, not a feature-access 403');
    const textBody = await textRes.json();
    assert.notStrictEqual(textBody.error, 'FEATURE_NOT_AVAILABLE', 'Text chat must not be blocked by the voice-chat gate');
    console.log("✅ Text chat path is unaffected - reaches normal validation, not the voice-chat gate.");

    console.log('--- ALL NOTE VOICE CHAT TESTS PASSED ---');
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
