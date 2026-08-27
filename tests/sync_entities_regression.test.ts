// Regression test verifying notes/documents/annotations/reminders/bills round-trip
// through the sync push/pull cycle, re-pointed at the new Next.js /api/sync route handler.
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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function runSyncEntitiesRegressionTest() {
  console.log('========================================================================');
  console.log('--- STARTING SYNC ENTITIES REGRESSION TEST (Next.js /api/sync) ---');
  console.log('========================================================================');

  // 1. Setup temporary test user
  const email = 'test_entity_sync_nextjs_' + Math.random().toString(36).substring(2) + '@mindvault.io';
  console.log(`[STEP 1] Creating temporary test user: ${email}`);

  const insertUserResult = await db.query(
    `
    INSERT INTO users (full_name, email, password_hash, role, account_status, license_type)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
  `,
    ['Test Entity User', email, 'dummy_hash', 'USER', 'ACTIVE', 'FREE']
  );

  const userId: number = insertUserResult.rows[0].id;
  console.log(`✓ Test user created with ID ${userId}.`);

  const noteSyncId = generateUUID();
  const docSyncId = generateUUID();
  const annSyncId = generateUUID();
  const remSyncId = generateUUID();
  const billId = generateUUID();

  try {
    // 2. Simulate Device A Pushing changes: Note, Document, Annotation, Reminder, and Bill
    console.log('\n[STEP 2] Simulating Device A Sync Push payload');

    const pushBody = {
      lastSyncAt: null,
      changes: {
        notes: [
          {
            id: noteSyncId,
            title: 'Test Note Title',
            description: 'Test Note Description',
            type: 'TEXT',
            category: 'Work',
            isFavorite: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        documents: [
          {
            id: docSyncId,
            noteId: noteSyncId,
            fileName: 'test.pdf',
            filePath: '/docs/test.pdf',
            folder: 'Research',
            totalPages: 10,
            lastPageRead: 2,
            readStatus: 'IN_PROGRESS',
            coverThumbnail: 'thumb_data',
          },
        ],
        annotations: [
          {
            id: annSyncId,
            documentId: docSyncId,
            pageNumber: 3,
            highlightColor: '#ff0000',
            noteText: 'Annotation highlight note text',
            createdAt: new Date().toISOString(),
          },
        ],
        reminders: [
          {
            id: remSyncId,
            noteId: noteSyncId,
            reminderType: 'WORK',
            dateTime: new Date(Date.now() + 600000).toISOString(),
            isCompleted: false,
          },
        ],
        bills: [
          {
            id: billId,
            title: 'Water Bill',
            amount: 1500.0,
            dueDate: new Date(Date.now() + 86400000).toISOString(),
            isPaid: false,
            category: 'Utilities',
            note: 'Pay before due date',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isDeleted: false,
          },
        ],
        ledger: [],
        udhaar: [],
        khataCustomers: [],
        khataTransactions: [],
      },
    };

    const pushRes = await syncPOST(makeSyncRequest(userId, pushBody));
    if (pushRes.status !== 200) {
      throw new Error(`Sync Push failed with status ${pushRes.status}: ${JSON.stringify(await pushRes.clone().json())}`);
    }
    console.log('✓ Device A push successfully accepted by sync server.');

    // 3. Simulate Device B Pulling changes (lastSyncAt = null pulls everything)
    console.log('\n[STEP 3] Simulating Device B Sync Pull payload');

    const pullBody = {
      lastSyncAt: null,
      changes: {
        notes: [],
        documents: [],
        annotations: [],
        reminders: [],
        bills: [],
        ledger: [],
        udhaar: [],
        khataCustomers: [],
        khataTransactions: [],
      },
    };

    const pullRes = await syncPOST(makeSyncRequest(userId, pullBody));
    const pullResponse = await pullRes.json();

    // 4. Assert the pulled entities match the pushed entities
    console.log('\n[STEP 4] Asserting synced data matches exactly on Device B pull');

    assert.ok(pullResponse, 'Pull response must exist');

    // Assert Note
    assert.strictEqual(pullResponse.notes.length, 1, 'Notes must contain 1 item');
    const pulledNote = pullResponse.notes[0];
    assert.strictEqual(pulledNote.id, noteSyncId);
    assert.strictEqual(pulledNote.title, 'Test Note Title');
    console.log('✓ Note successfully verified.');

    // Assert Document
    assert.strictEqual(pullResponse.documents.length, 1, 'Documents must contain 1 item');
    const pulledDoc = pullResponse.documents[0];
    assert.strictEqual(pulledDoc.id, docSyncId);
    assert.strictEqual(pulledDoc.noteId, noteSyncId);
    assert.strictEqual(pulledDoc.fileName, 'test.pdf');
    console.log('✓ Document successfully verified.');

    // Assert Annotation
    assert.strictEqual(pullResponse.annotations.length, 1, 'Annotations must contain 1 item');
    const pulledAnn = pullResponse.annotations[0];
    assert.strictEqual(pulledAnn.id, annSyncId);
    assert.strictEqual(pulledAnn.documentId, docSyncId);
    assert.strictEqual(pulledAnn.noteText, 'Annotation highlight note text');
    console.log('✓ Annotation successfully verified.');

    // Assert Reminder
    assert.strictEqual(pullResponse.reminders.length, 1, 'Reminders must contain 1 item');
    const pulledRem = pullResponse.reminders[0];
    assert.strictEqual(pulledRem.id, remSyncId);
    assert.strictEqual(pulledRem.noteId, noteSyncId);
    assert.strictEqual(pulledRem.reminderType, 'WORK');
    console.log('✓ Reminder successfully verified.');

    // Assert Bill
    assert.strictEqual(pullResponse.bills.length, 1, 'Bills must contain 1 item');
    const pulledBill = pullResponse.bills[0];
    assert.strictEqual(pulledBill.id, billId);
    assert.strictEqual(pulledBill.title, 'Water Bill');
    console.log('✓ Bill successfully verified.');
  } finally {
    // 5. Cleanup test user (cascades deletes notes, documents, annotations, reminders, bills)
    console.log('\n[STEP 5] Cleaning up temporary test user and synced records');
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    console.log('✓ Cleanup complete.');
  }

  console.log('\n========================================================================');
  console.log('🎉 SYNC ENTITIES REGRESSION TEST PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

runSyncEntitiesRegressionTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ TEST FAILED:', err);
    process.exit(1);
  });
