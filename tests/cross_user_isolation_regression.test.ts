// Regression test for the cross-user data isolation vulnerability, re-pointed at the
// new Next.js /api/sync route handler (ported from backend/src/controllers/syncController.js).
// Previously (a) /api/notes, /api/ledger, /api/udhaar, /api/reminders trusted a
// client-supplied user_id with no auth at all, and (b) the /api/sync upsert path had no
// ownership check on ON CONFLICT, so a malicious authenticated user could read/overwrite
// another user's rows just by knowing their frontend_id (UUID). This test proves the sync
// upsert/pull half of that is still closed after the merge into Next.js Route Handlers.
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
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenFor(userId)}`,
    },
    body: JSON.stringify(body),
  });
}

async function runTest() {
  console.log('--- STARTING CROSS-USER ISOLATION REGRESSION TEST (Next.js /api/sync) ---');
  let userA: number | undefined, userB: number | undefined;
  const noteId = `note_${Date.now()}`;
  const custId = `cust_${Date.now()}`;
  const prodId = `prod_${Date.now()}`;
  const docId = `doc_${Date.now()}`;

  try {
    const resA = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('User A', 'pass', 'usera_nextjs_test@test.com', 'PRO') RETURNING id`);
    userA = resA.rows[0].id;
    const resB = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('User B', 'pass', 'userb_nextjs_test@test.com', 'PRO') RETURNING id`);
    userB = resB.rows[0].id;
    console.log(`Created User A (${userA}) and User B (${userB})`);

    // User A creates a note, a khata customer, and a product.
    let res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: {
        notes: [{ id: noteId, title: 'A Private Note', description: 'secret', type: 'TEXT', category: 'General' }],
        khataCustomers: [{ id: custId, name: 'A Customer' }],
        products: [{ id: prodId, name: 'A Product', sellingPrice: 100 }],
      },
    }));
    assert.strictEqual(res.status, 200, `Setup push failed: ${JSON.stringify(await res.json())}`);

    // --- Attack 1: User B tries to overwrite User A's note via sync upsert ---
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { notes: [{ id: noteId, title: 'HACKED BY B', description: 'pwned', type: 'TEXT', category: 'General' }] },
    }));
    assert.strictEqual(res.status, 200);
    const noteCheck = await db.query('SELECT title, user_id FROM notes WHERE frontend_id = $1', [noteId]);
    assert.strictEqual(noteCheck.rows[0].title, 'A Private Note', "VULNERABLE: User B overwrote User A's note title");
    assert.strictEqual(noteCheck.rows[0].user_id, userA, 'VULNERABLE: note ownership changed');
    console.log('✅ Attack 1 blocked: cross-user note overwrite via sync rejected.');

    // --- Attack 2: User B tries to attach a document to User A's note ---
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { documents: [{ id: docId, noteId: noteId, fileName: 'evil.pdf', filePath: '/evil.pdf' }] },
    }));
    assert.strictEqual(res.status, 200);
    const docCheck = await db.query('SELECT * FROM documents WHERE frontend_id = $1', [docId]);
    assert.strictEqual(docCheck.rows.length, 0, "VULNERABLE: User B attached a document to User A's note");
    console.log('✅ Attack 2 blocked: cross-user document attach rejected.');

    // --- Attack 3: User B tries to create a khata transaction against User A's customer ---
    const txnId = `txn_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { khataTransactions: [{ id: txnId, customerId: custId, type: 'CREDIT', amount: 5000, date: new Date().toISOString() }] },
    }));
    assert.strictEqual(res.status, 200);
    const txnCheck = await db.query('SELECT * FROM khata_transactions WHERE frontend_id = $1', [txnId]);
    assert.strictEqual(txnCheck.rows.length, 0, "VULNERABLE: User B created a transaction against User A's customer");
    console.log('✅ Attack 3 blocked: cross-user khata transaction rejected.');

    // --- Attack 4: User B tries to log stock movement against User A's product ---
    const smId = `sm_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { stockMovements: [{ id: smId, productId: prodId, type: 'STOCK_OUT', quantity: 999, reason: 'theft' }] },
    }));
    assert.strictEqual(res.status, 200);
    const smCheck = await db.query('SELECT * FROM stock_movements WHERE frontend_id = $1', [smId]);
    assert.strictEqual(smCheck.rows.length, 0, "VULNERABLE: User B logged stock movement against User A's product");
    console.log('✅ Attack 4 blocked: cross-user stock movement rejected.');

    // --- Attack 5: User B pulls sync data - must not see User A's note ---
    res = await syncPOST(makeSyncRequest(userB!, { lastSyncAt: null, changes: {} }));
    assert.strictEqual(res.status, 200);
    const pullBody = await res.json();
    assert.ok(!pullBody.notes.find((n: { id: string }) => n.id === noteId), "VULNERABLE: User B's pull included User A's note");
    console.log('✅ Attack 5 blocked: sync pull correctly scoped to caller.');

    // Attack 6 (legacy /api/notes/user/:user_id spoofed-param leak) is covered separately
    // once app/api/notes/* is ported in Phase C - not yet part of this merge.

    console.log('--- ALL CROSS-USER ISOLATION TESTS PASSED (Next.js /api/sync) ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [userA, userB].filter(Boolean) as number[]) {
      await db.query('DELETE FROM stock_movements WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM products WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM khata_transactions WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM khata_customers WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM notes WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
