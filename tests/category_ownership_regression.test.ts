// Regression test for the new hierarchical Category feature's ownership-check pattern in
// app/api/sync/route.ts. A category's parentId (self-reference) and a product's categoryId
// are both optional FKs - a foreign/invalid reference must be stripped to NULL while the
// rest of the record still saves (never silently rejected), mirroring the Locations feature's
// established pattern. Also verifies the unlimited-depth tree and pull-side isolation.
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
  console.log('--- STARTING CATEGORY OWNERSHIP REGRESSION TEST (Next.js /api/sync) ---');
  let userA: number | undefined, userB: number | undefined;
  const rootId = `cat_root_${Date.now()}`;
  const childId = `cat_child_${Date.now()}`;
  const prodId = `prod_cat_${Date.now()}`;

  try {
    const resA = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Cat User A', 'pass', 'cata_nextjs_test@test.com', 'PRO') RETURNING id`);
    userA = resA.rows[0].id;
    const resB = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Cat User B', 'pass', 'catb_nextjs_test@test.com', 'PRO') RETURNING id`);
    userB = resB.rows[0].id;
    console.log(`Created User A (${userA}) and User B (${userB})`);

    // 1. User A creates a root category and a child category (unlimited-depth tree)
    let res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: {
        categories: [
          { id: rootId, name: 'Electronics' },
          { id: childId, name: 'Phones', parentId: rootId },
        ],
      },
    }));
    assert.strictEqual(res.status, 200, `Category create failed: ${JSON.stringify(await res.clone().json())}`);
    const rootCheck = await db.query('SELECT name, parent_id, user_id FROM categories WHERE frontend_id = $1', [rootId]);
    const childCheck = await db.query('SELECT name, parent_id, user_id FROM categories WHERE frontend_id = $1', [childId]);
    assert.strictEqual(rootCheck.rows[0].parent_id, null);
    assert.strictEqual(childCheck.rows[0].parent_id, rootId);
    assert.strictEqual(childCheck.rows[0].user_id, userA);
    console.log('✅ Root and child category created correctly, tree structure intact.');

    // 2. User A creates a product tagged with the child category - must keep it
    res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { products: [{ id: prodId, name: 'iPhone', sellingPrice: 1000, category: 'Phones', categoryId: childId }] },
    }));
    assert.strictEqual(res.status, 200);
    const prodCheck = await db.query('SELECT category, category_id FROM products WHERE frontend_id = $1', [prodId]);
    assert.strictEqual(prodCheck.rows[0].category_id, childId);
    assert.strictEqual(prodCheck.rows[0].category, 'Phones');
    console.log('✅ Product correctly tagged with own category.');

    // 3. Attack: User B tries to create a category whose parentId points at User A's category
    const evilCatId = `cat_evil_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { categories: [{ id: evilCatId, name: 'Evil Category', parentId: rootId }] },
    }));
    assert.strictEqual(res.status, 200, "Record must still save (200), just with the bad parentId stripped");
    const evilCatCheck = await db.query('SELECT parent_id FROM categories WHERE frontend_id = $1', [evilCatId]);
    assert.strictEqual(evilCatCheck.rows[0].parent_id, null, "VULNERABLE: foreign parentId was accepted on a category");
    console.log('✅ Attack blocked: foreign parentId stripped to NULL, category still saved as a root node.');

    // 4. Attack: User B tries to tag a product with User A's categoryId
    const evilProdId = `prod_evil_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { products: [{ id: evilProdId, name: 'Evil Product', sellingPrice: 50, category: 'Hacked', categoryId: childId }] },
    }));
    assert.strictEqual(res.status, 200);
    const evilProdCheck = await db.query('SELECT category_id FROM products WHERE frontend_id = $1', [evilProdId]);
    assert.strictEqual(evilProdCheck.rows[0].category_id, null, "VULNERABLE: foreign categoryId was accepted on a product");
    console.log('✅ Attack blocked: foreign categoryId stripped to NULL on product, record still saved.');

    // 5. Pull: User A's sync pull must include their own categories
    res = await syncPOST(makeSyncRequest(userA!, { lastSyncAt: null, changes: {} }));
    const pullBodyA = await res.json();
    assert.ok(pullBodyA.categories.find((c: { id: string }) => c.id === rootId), "User A's pull should include their own root category");
    assert.ok(pullBodyA.categories.find((c: { id: string }) => c.id === childId), "User A's pull should include their own child category");
    console.log('✅ Categories correctly appear in sync pull response.');

    // 6. User B's pull must NOT include User A's categories
    res = await syncPOST(makeSyncRequest(userB!, { lastSyncAt: null, changes: {} }));
    const pullBodyB = await res.json();
    assert.ok(!pullBodyB.categories.find((c: { id: string }) => c.id === rootId), "VULNERABLE: User B's pull included User A's category");
    console.log("✅ Category pull correctly scoped to caller (User B cannot see User A's categories).");

    console.log('--- ALL CATEGORY OWNERSHIP TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [userA, userB].filter(Boolean) as number[]) {
      await db.query('DELETE FROM products WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM categories WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
