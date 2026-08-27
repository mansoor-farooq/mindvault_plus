// Regression test for legacy CRUD routes ported in Phase C (app/api/notes/*).
// Covers the cross-user isolation "Attack 6" scenario from the original
// cross_user_isolation_regression.test.js: a spoofed :user_id URL param must never
// leak another user's notes, since ownership always comes from the JWT, not the URL.
import assert from 'assert';
import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { db } from '../lib/db.server';
import { POST as createNotePOST } from '../app/api/notes/route';
import { GET as getNotesByUserGET } from '../app/api/notes/user/[user_id]/route';
import { DELETE as deleteNoteDELETE } from '../app/api/notes/[id]/route';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';

function tokenFor(userId: number) {
  return jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: '1h' });
}

function authedRequest(url: string, userId: number, init: { method?: string; body?: string } = {}) {
  return new NextRequest(url, {
    method: init.method,
    body: init.body,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenFor(userId)}` },
  });
}

async function runTest() {
  console.log('--- STARTING LEGACY NOTES ROUTES REGRESSION TEST (Next.js /api/notes) ---');
  let userA: number | undefined, userB: number | undefined;

  try {
    const resA = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Notes User A', 'pass', 'notesa_nextjs_test@test.com', 'PRO') RETURNING id`);
    userA = resA.rows[0].id;
    const resB = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Notes User B', 'pass', 'notesb_nextjs_test@test.com', 'PRO') RETURNING id`);
    userB = resB.rows[0].id;
    console.log(`Created User A (${userA}) and User B (${userB})`);

    // 1. User A creates a note via POST /api/notes
    const createRes = await createNotePOST(
      authedRequest('http://localhost:3000/api/notes', userA!, {
        method: 'POST',
        body: JSON.stringify({ title: 'A Private Note', description: 'secret', type: 'TEXT', category: 'General' }),
      })
    );
    assert.strictEqual(createRes.status, 201, `Note creation failed: ${JSON.stringify(await createRes.clone().json())}`);
    const created = await createRes.json();
    const noteId = created.note.id;
    console.log('✓ User A created a note.');

    // 2. Attack: User B requests GET /api/notes/user/:user_id with A's id spoofed in the URL
    const spoofedRes = await getNotesByUserGET(
      authedRequest(`http://localhost:3000/api/notes/user/${userA}`, userB!)
    );
    assert.strictEqual(spoofedRes.status, 200);
    const spoofedBody = await spoofedRes.json();
    assert.ok(
      !spoofedBody.notes.find((n: { title: string }) => n.title === 'A Private Note'),
      "VULNERABLE: legacy route leaked User A's note to User B via spoofed :user_id param"
    );
    console.log('✅ Attack blocked: getNotesByUser ignores spoofed :user_id param, scoped to JWT owner.');

    // 3. User A's own GET must see the note
    const ownRes = await getNotesByUserGET(authedRequest(`http://localhost:3000/api/notes/user/${userA}`, userA!));
    const ownBody = await ownRes.json();
    assert.ok(ownBody.notes.find((n: { title: string }) => n.title === 'A Private Note'), "User A's own note listing must include it");
    console.log('✓ User A can see their own note.');

    // 4. Attack: User B tries to delete User A's note by id
    const spoofedDeleteRes = await deleteNoteDELETE(authedRequest(`http://localhost:3000/api/notes/${noteId}`, userB!, { method: 'DELETE' }), {
      params: Promise.resolve({ id: noteId }),
    });
    assert.strictEqual(spoofedDeleteRes.status, 404, "VULNERABLE: User B was able to delete/soft-delete User A's note");
    console.log('✅ Attack blocked: cross-user delete rejected (404, ownership check via user_id).');

    // 5. User A deletes their own note - must succeed
    const ownDeleteRes = await deleteNoteDELETE(authedRequest(`http://localhost:3000/api/notes/${noteId}`, userA!, { method: 'DELETE' }), {
      params: Promise.resolve({ id: noteId }),
    });
    assert.strictEqual(ownDeleteRes.status, 200);
    console.log('✓ User A successfully deleted their own note.');

    console.log('--- ALL LEGACY NOTES ROUTE TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [userA, userB].filter(Boolean) as number[]) {
      await db.query('DELETE FROM notes WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
