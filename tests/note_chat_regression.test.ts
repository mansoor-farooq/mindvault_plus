// Regression test for the Note Chat feature's sync ownership pattern in
// app/api/sync/route.ts. ChatMessage.noteId is a MANDATORY FK (a message can't exist
// without its parent note) - a foreign/forged noteId must cause the whole message record
// to be skipped (not saved, but the sync request itself still returns 200), same as
// ProductVariant.productId's existing treatment. Also verifies pull-side isolation: User B
// must never receive User A's chat messages.
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../lib/db.server';
import { POST as syncPOST } from '../app/api/sync/route';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

function tokenFor(userId: number) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function makeSyncRequest(userId: number, body: unknown) {
  return new NextRequest('http://localhost:3000/api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userId)}` },
    body: JSON.stringify(body),
  });
}

async function runTest() {
  console.log('--- STARTING NOTE CHAT REGRESSION TEST (Next.js /api/sync) ---');
  let userA: number | undefined, userB: number | undefined;
  const noteAId = `note_chat_a_${Date.now()}`;
  const noteBId = `note_chat_b_${Date.now()}`;
  const msgId = `msg_${Date.now()}`;

  try {
    const resA = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Chat User A', 'pass', 'chata_nextjs_test@test.com', 'PRO') RETURNING id`);
    userA = resA.rows[0].id;
    const resB = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Chat User B', 'pass', 'chatb_nextjs_test@test.com', 'PRO') RETURNING id`);
    userB = resB.rows[0].id;
    console.log(`Created User A (${userA}) and User B (${userB})`);

    // 0. Both users create a note
    let res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { notes: [{ id: noteAId, title: 'Idea A', description: 'A business idea', type: 'TEXT', category: 'Business', tags: [] }] },
    }));
    assert.strictEqual(res.status, 200, `User A note create failed: ${JSON.stringify(await res.clone().json())}`);

    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { notes: [{ id: noteBId, title: 'Idea B', description: 'Another idea', type: 'TEXT', category: 'Business', tags: [] }] },
    }));
    assert.strictEqual(res.status, 200, `User B note create failed: ${JSON.stringify(await res.clone().json())}`);
    console.log('✅ Both notes created.');

    // 1. Happy path: User A creates a chat message on their own note
    res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { chatMessages: [{ id: msgId, noteId: noteAId, role: 'user', content: 'How do I validate this idea?' }] },
    }));
    assert.strictEqual(res.status, 200, `Message create failed: ${JSON.stringify(await res.clone().json())}`);
    const msgCheck = await db.query('SELECT role, content, note_id, user_id FROM note_chat_messages WHERE frontend_id = $1', [msgId]);
    assert.strictEqual(msgCheck.rows.length, 1);
    assert.strictEqual(msgCheck.rows[0].role, 'user');
    assert.strictEqual(msgCheck.rows[0].note_id, noteAId);
    assert.strictEqual(msgCheck.rows[0].user_id, userA);
    console.log('✅ Chat message created correctly with note_id/role/content.');

    // 2. Attack: User B tries to create a chat message whose noteId points at User A's note
    // (mandatory FK -> skip-the-record pattern: whole request still 200, but record is dropped)
    const evilMsgId = `msg_evil_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { chatMessages: [{ id: evilMsgId, noteId: noteAId, role: 'user', content: 'Trying to read User A note' }] },
    }));
    assert.strictEqual(res.status, 200, 'Request must still succeed (200) even though the record is dropped');
    const evilMsgCheck = await db.query('SELECT 1 FROM note_chat_messages WHERE frontend_id = $1', [evilMsgId]);
    assert.strictEqual(evilMsgCheck.rows.length, 0, 'VULNERABLE: chat message with foreign noteId was persisted');
    console.log('✅ Attack blocked: chat message with foreign noteId was skipped entirely, not persisted.');

    // 3. Pull-side isolation: User A's pull includes their own message; User B's pull does not
    res = await syncPOST(makeSyncRequest(userA!, { lastSyncAt: null, changes: {} }));
    const pullBodyA = await res.json();
    assert.ok(pullBodyA.chatMessages.find((m: { id: string }) => m.id === msgId), "User A's pull should include their own chat message");

    res = await syncPOST(makeSyncRequest(userB!, { lastSyncAt: null, changes: {} }));
    const pullBodyB = await res.json();
    assert.ok(!pullBodyB.chatMessages.find((m: { id: string }) => m.id === msgId), "VULNERABLE: User B's pull included User A's chat message");
    console.log("✅ Chat message pull correctly scoped to caller (User B cannot see User A's message).");

    console.log('--- ALL NOTE CHAT TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [userA, userB].filter(Boolean) as number[]) {
      await db.query('DELETE FROM note_chat_messages WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM notes WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
