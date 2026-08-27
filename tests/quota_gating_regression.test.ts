// Regression test for row-count gating (khata_customers free limit), re-pointed at the
// new Next.js /api/sync route handler.
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
  console.log('--- STARTING QUOTA GATING REGRESSION TEST (Next.js /api/sync) ---');
  let userId: number | undefined;
  try {
    // 1. Create a FREE test user
    const userRes = await db.query(`
      INSERT INTO users (full_name, password_hash, email, license_type)
      VALUES ('test quota user', 'pass', 'quota_nextjs_test@test.com', 'FREE')
      RETURNING id
    `);
    userId = userRes.rows[0].id;
    console.log(`Created test user with ID: ${userId}`);

    // 2. Insert 15 grandfathered Khata customers directly via DB (bypassing limits)
    console.log('Inserting 15 grandfathered khata customers...');
    for (let i = 1; i <= 15; i++) {
      await db.query(`
        INSERT INTO khata_customers (frontend_id, user_id, name, phone, address)
        VALUES ($1, $2, $3, $4, $5)
      `, [`cust_${i}_${Date.now()}`, userId, `Customer ${i}`, '1234567890', 'Address']);
    }

    const { rows } = await db.query('SELECT frontend_id FROM khata_customers WHERE user_id = $1 LIMIT 1', [userId]);
    const existingCustId = rows[0].frontend_id;

    // 3. Try to UPDATE an existing customer (must SUCCEED)
    console.log('Attempting to update an existing customer via sync...');
    let res = await syncPOST(makeSyncRequest(userId!, {
      lastSyncAt: null,
      changes: {
        khataCustomers: [
          { id: existingCustId, name: 'Updated Name', phone: '0987654321', address: 'Address' },
        ],
      },
    }));
    assert.strictEqual(res.status, 200, `Expected 200 OK for update, got ${res.status} with body: ${JSON.stringify(await res.clone().json())}`);
    console.log('✅ Update successful! Grandfathered rule verified.');

    // 4. Try to CREATE a new customer (16th customer) (must FAIL because free limit is 10)
    console.log('Attempting to create a 16th new customer via sync...');
    res = await syncPOST(makeSyncRequest(userId!, {
      lastSyncAt: null,
      changes: {
        khataCustomers: [
          { id: `cust_16_${Date.now()}`, name: 'New Customer 16', phone: '5555555555', address: 'New Address' },
        ],
      },
    }));
    const body = await res.json();
    assert.strictEqual(res.status, 403, `Expected 403 Forbidden for limit reached, got ${res.status}`);
    assert.strictEqual(body.error, 'LIMIT_REACHED', 'Expected error to be LIMIT_REACHED');
    console.log('✅ Create blocked successfully! Gating rule verified.');

    console.log('--- ALL QUOTA GATING TESTS PASSED (Next.js /api/sync) ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    if (userId) {
      await db.query('DELETE FROM khata_customers WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM feature_usage WHERE user_id = $1', [userId]);
      await db.query('DELETE FROM users WHERE id = $1', [userId]);
      console.log('Cleaned up test data.');
    }
    process.exit();
  }
}

runTest();
