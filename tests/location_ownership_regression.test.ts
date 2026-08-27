// Regression test for the new Location/Branch feature's ownership-check pattern in
// app/api/sync/route.ts. Locations are optional FKs on products/stock_movements/
// khata_customers - unlike mandatory FKs (e.g. khataTransactions.customerId, which
// skips the whole record on ownership failure), an invalid/foreign location_id must be
// stripped to NULL while the rest of the record still saves. This proves that behavior,
// plus that a location created by one call is visible to a caller on a later sync (pull).
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
  console.log('--- STARTING LOCATION OWNERSHIP REGRESSION TEST (Next.js /api/sync) ---');
  let userA: number | undefined, userB: number | undefined;
  const locId = `loc_${Date.now()}`;
  const prodId = `prod_${Date.now()}`;
  const custId = `cust_${Date.now()}`;
  const smId = `sm_${Date.now()}`;

  try {
    const resA = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Loc User A', 'pass', 'loca_nextjs_test@test.com', 'PRO') RETURNING id`);
    userA = resA.rows[0].id;
    const resB = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Loc User B', 'pass', 'locb_nextjs_test@test.com', 'PRO') RETURNING id`);
    userB = resB.rows[0].id;
    console.log(`Created User A (${userA}) and User B (${userB})`);

    // 1. User A creates a location
    let res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { locations: [{ id: locId, name: 'Main Warehouse', locationType: 'WAREHOUSE', city: 'Lahore' }] },
    }));
    assert.strictEqual(res.status, 200, `Location create failed: ${JSON.stringify(await res.clone().json())}`);
    const locCheck = await db.query('SELECT name, user_id FROM locations WHERE frontend_id = $1', [locId]);
    assert.strictEqual(locCheck.rows[0].name, 'Main Warehouse');
    assert.strictEqual(locCheck.rows[0].user_id, userA);
    console.log('✅ Location created and persisted correctly.');

    // 2. User A creates a product tagged with their own location - must keep the tag
    res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { products: [{ id: prodId, name: 'Widget', sellingPrice: 100, locationId: locId }] },
    }));
    assert.strictEqual(res.status, 200);
    const prodCheck = await db.query('SELECT location_id FROM products WHERE frontend_id = $1', [prodId]);
    assert.strictEqual(prodCheck.rows[0].location_id, locId, "Own location should be kept on the product");
    console.log('✅ Product correctly tagged with own location.');

    // 3. Attack: User B tries to tag a product with User A's location - must be stripped to NULL, not rejected/crashed
    const prodIdB = `prod_b_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { products: [{ id: prodIdB, name: 'Evil Widget', sellingPrice: 50, locationId: locId }] },
    }));
    assert.strictEqual(res.status, 200, "Record must still save (200), just with the bad FK stripped");
    const prodCheckB = await db.query('SELECT location_id FROM products WHERE frontend_id = $1', [prodIdB]);
    assert.strictEqual(prodCheckB.rows[0].location_id, null, "VULNERABLE: foreign location_id was accepted on a product");
    console.log('✅ Attack blocked: foreign location_id stripped to NULL on product, record still saved.');

    // 4. Same attack via khata_customers
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { khataCustomers: [{ id: custId, name: 'Sneaky Customer', locationId: locId }] },
    }));
    assert.strictEqual(res.status, 200);
    const custCheck = await db.query('SELECT location_id FROM khata_customers WHERE frontend_id = $1', [custId]);
    assert.strictEqual(custCheck.rows[0].location_id, null, "VULNERABLE: foreign location_id was accepted on a khata customer");
    console.log('✅ Attack blocked: foreign location_id stripped to NULL on khata customer.');

    // 5. Same attack via stock_movements (also verify delivery_cost round-trips as a number)
    // First give User B their own product to attach the movement to (movement ownership requires owning the product too)
    const prodIdBOwn = `prod_b_own_${Date.now()}`;
    await syncPOST(makeSyncRequest(userB!, { lastSyncAt: null, changes: { products: [{ id: prodIdBOwn, name: 'B Own Product', sellingPrice: 20 }] } }));
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { stockMovements: [{ id: smId, productId: prodIdBOwn, type: 'STOCK_IN', quantity: 5, locationId: locId, deliveryCost: 123.45, deliveryNote: 'bike fare' }] },
    }));
    assert.strictEqual(res.status, 200);
    const smCheck = await db.query('SELECT location_id, delivery_cost, delivery_note FROM stock_movements WHERE frontend_id = $1', [smId]);
    assert.strictEqual(smCheck.rows[0].location_id, null, "VULNERABLE: foreign location_id was accepted on a stock movement");
    assert.strictEqual(Number(smCheck.rows[0].delivery_cost), 123.45, "delivery_cost should round-trip correctly even when location_id is stripped");
    assert.strictEqual(smCheck.rows[0].delivery_note, 'bike fare');
    console.log('✅ Attack blocked: foreign location_id stripped on stock movement; delivery_cost/delivery_note still saved correctly.');

    // 6. Pull: User A's sync pull must include their own location
    res = await syncPOST(makeSyncRequest(userA!, { lastSyncAt: null, changes: {} }));
    const pullBody = await res.json();
    assert.ok(pullBody.locations.find((l: { id: string }) => l.id === locId), "User A's pull should include their own location");
    console.log('✅ Location correctly appears in sync pull response.');

    // 7. User B's pull must NOT include User A's location
    res = await syncPOST(makeSyncRequest(userB!, { lastSyncAt: null, changes: {} }));
    const pullBodyB = await res.json();
    assert.ok(!pullBodyB.locations.find((l: { id: string }) => l.id === locId), "VULNERABLE: User B's pull included User A's location");
    console.log('✅ Location pull correctly scoped to caller (User B cannot see User A\'s location).');

    console.log('--- ALL LOCATION OWNERSHIP TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [userA, userB].filter(Boolean) as number[]) {
      await db.query('DELETE FROM stock_movements WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM products WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM khata_customers WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM locations WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
