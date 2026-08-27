// Regression test for the Product Variants feature's ownership-check pattern in
// app/api/sync/route.ts. ProductVariant.productId is a MANDATORY FK (a variant can't
// exist without its parent product) - a foreign productId must cause the whole variant
// record to be skipped (not saved, but the sync request itself still returns 200), same
// as StockMovement.productId's existing treatment. StockMovement.variantId is an OPTIONAL
// FK - a foreign variantId must be stripped to NULL while the rest of the movement still
// saves, mirroring locationId's existing treatment. Also verifies variant-level stock is
// summed correctly and not double-counted into the parent product's own stock.
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
  console.log('--- STARTING PRODUCT VARIANTS REGRESSION TEST (Next.js /api/sync) ---');
  let userA: number | undefined, userB: number | undefined;
  const prodAId = `prod_var_a_${Date.now()}`;
  const prodBId = `prod_var_b_${Date.now()}`;
  const variantId = `variant_${Date.now()}`;

  try {
    const resA = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Variant User A', 'pass', 'varianta_nextjs_test@test.com', 'PRO') RETURNING id`);
    userA = resA.rows[0].id;
    const resB = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Variant User B', 'pass', 'variantb_nextjs_test@test.com', 'PRO') RETURNING id`);
    userB = resB.rows[0].id;
    console.log(`Created User A (${userA}) and User B (${userB})`);

    // 0. Both users create a product
    let res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { products: [{ id: prodAId, name: 'T-Shirt', sellingPrice: 500, category: 'Clothing' }] },
    }));
    assert.strictEqual(res.status, 200, `User A product create failed: ${JSON.stringify(await res.clone().json())}`);

    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { products: [{ id: prodBId, name: 'Cap', sellingPrice: 200, category: 'Clothing' }] },
    }));
    assert.strictEqual(res.status, 200, `User B product create failed: ${JSON.stringify(await res.clone().json())}`);
    console.log('✅ Both products created.');

    // 1. Happy path: User A creates a variant on their own product
    res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: { productVariants: [{ id: variantId, productId: prodAId, name: 'Small', sku: 'TSH-SM', priceOverride: 550 }] },
    }));
    assert.strictEqual(res.status, 200, `Variant create failed: ${JSON.stringify(await res.clone().json())}`);
    const variantCheck = await db.query('SELECT name, sku, price_override, product_id, user_id FROM product_variants WHERE frontend_id = $1', [variantId]);
    assert.strictEqual(variantCheck.rows.length, 1);
    assert.strictEqual(variantCheck.rows[0].name, 'Small');
    assert.strictEqual(variantCheck.rows[0].product_id, prodAId);
    assert.strictEqual(Number(variantCheck.rows[0].price_override), 550);
    assert.strictEqual(variantCheck.rows[0].user_id, userA);
    console.log('✅ Variant created correctly with product_id/name/sku/price_override.');

    // 2. Attack: User B tries to create a variant whose productId points at User A's product
    // (mandatory FK -> skip-the-record pattern: whole request still 200, but this record is dropped)
    const evilVariantId = `variant_evil_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { productVariants: [{ id: evilVariantId, productId: prodAId, name: 'Evil Variant' }] },
    }));
    assert.strictEqual(res.status, 200, 'Request must still succeed (200) even though the record is dropped');
    const evilVariantCheck = await db.query('SELECT 1 FROM product_variants WHERE frontend_id = $1', [evilVariantId]);
    assert.strictEqual(evilVariantCheck.rows.length, 0, "VULNERABLE: variant with foreign productId was persisted");
    console.log('✅ Attack blocked: variant with foreign productId was skipped entirely, not persisted.');

    // 3. Attack: User B tries to tag a stock movement with User A's real variantId
    // (optional FK -> strip-to-null pattern: movement still saves, variant_id becomes NULL)
    const evilMovementId = `sm_evil_${Date.now()}`;
    res = await syncPOST(makeSyncRequest(userB!, {
      lastSyncAt: null,
      changes: { stockMovements: [{ id: evilMovementId, productId: prodBId, variantId: variantId, type: 'STOCK_IN', quantity: 5 }] },
    }));
    assert.strictEqual(res.status, 200, `Movement create failed: ${JSON.stringify(await res.clone().json())}`);
    const evilMovementCheck = await db.query('SELECT product_id, variant_id FROM stock_movements WHERE frontend_id = $1', [evilMovementId]);
    assert.strictEqual(evilMovementCheck.rows.length, 1, 'Movement should still be saved (own product, foreign variant stripped)');
    assert.strictEqual(evilMovementCheck.rows[0].variant_id, null, "VULNERABLE: foreign variantId was accepted on a stock movement");
    console.log('✅ Attack blocked: foreign variantId stripped to NULL on stock movement, rest of record still saved.');

    // 4. Variant stock correctly summed and NOT double-counted into the parent product's stock
    res = await syncPOST(makeSyncRequest(userA!, {
      lastSyncAt: null,
      changes: {
        stockMovements: [
          { id: `sm_variant_in_${Date.now()}`, productId: prodAId, variantId, type: 'STOCK_IN', quantity: 10 },
          { id: `sm_variant_out_${Date.now()}`, productId: prodAId, variantId, type: 'STOCK_OUT', quantity: 3 },
          { id: `sm_product_in_${Date.now()}`, productId: prodAId, type: 'STOCK_IN', quantity: 5 },
        ],
      },
    }));
    assert.strictEqual(res.status, 200, `Stock movements create failed: ${JSON.stringify(await res.clone().json())}`);

    res = await syncPOST(makeSyncRequest(userA!, { lastSyncAt: null, changes: {} }));
    const pullBodyA = await res.json();
    const productMovements = pullBodyA.stockMovements.filter((sm: { productId: string; variantId?: string }) => sm.productId === prodAId && !sm.variantId);
    const variantMovements = pullBodyA.stockMovements.filter((sm: { variantId?: string }) => sm.variantId === variantId);
    const productStock = productMovements.reduce((acc: number, sm: { type: string; quantity: number }) => acc + (sm.type === 'STOCK_IN' ? Number(sm.quantity) : -Number(sm.quantity)), 0);
    const variantStock = variantMovements.reduce((acc: number, sm: { type: string; quantity: number }) => acc + (sm.type === 'STOCK_IN' ? Number(sm.quantity) : -Number(sm.quantity)), 0);
    assert.strictEqual(productStock, 5, `Product-level stock should exclude variant-tagged movements, got ${productStock}`);
    assert.strictEqual(variantStock, 7, `Variant-level stock should be 10-3=7, got ${variantStock}`);
    console.log('✅ Variant stock (7) correctly excluded from product-level stock (5) - no double-counting.');

    // 5. User A's pull includes their own variant; User B's pull does not
    assert.ok(pullBodyA.productVariants.find((v: { id: string }) => v.id === variantId), "User A's pull should include their own variant");
    res = await syncPOST(makeSyncRequest(userB!, { lastSyncAt: null, changes: {} }));
    const pullBodyB = await res.json();
    assert.ok(!pullBodyB.productVariants.find((v: { id: string }) => v.id === variantId), "VULNERABLE: User B's pull included User A's variant");
    console.log("✅ Variant pull correctly scoped to caller (User B cannot see User A's variant).");

    console.log('--- ALL PRODUCT VARIANTS TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [userA, userB].filter(Boolean) as number[]) {
      await db.query('DELETE FROM stock_movements WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM product_variants WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM products WHERE user_id = $1', [uid]);
      await db.query('DELETE FROM users WHERE id = $1', [uid]);
    }
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
