// Regression test for Organization accounts: a member's JWT resolves (via
// lib/auth/jwtAuth.ts's requireAuth) to the organization owner's user id for every data
// operation, so an owner and their member transparently share the same underlying
// products/notes/etc. Also confirms an unrelated third user still sees nothing.
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
  console.log('--- STARTING ORGANIZATION SHARING REGRESSION TEST ---');
  let ownerId: number | undefined, memberId: number | undefined, strangerId: number | undefined, orgId: number | undefined;
  const prodId = `prod_org_${Date.now()}`;

  try {
    const ownerRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Org Owner', 'pass', 'orgowner_nextjs_test@test.com', 'PRO') RETURNING id`);
    ownerId = ownerRes.rows[0].id;

    const orgRes = await db.query(`INSERT INTO organizations (frontend_id, name, owner_user_id) VALUES ($1, 'Test Org', $2) RETURNING id`, [
      `org_${Date.now()}`, ownerId,
    ]);
    orgId = orgRes.rows[0].id;
    await db.query(`UPDATE users SET account_type = 'ORGANIZATION', organization_id = $1, org_role = 'OWNER' WHERE id = $2`, [orgId, ownerId]);

    const memberRes = await db.query(
      `INSERT INTO users (full_name, password_hash, email, license_type, account_type, organization_id, org_role) VALUES ('Org Member', 'pass', 'orgmember_nextjs_test@test.com', 'FREE', 'ORGANIZATION', $1, 'MEMBER') RETURNING id`,
      [orgId]
    );
    memberId = memberRes.rows[0].id;

    const strangerRes = await db.query(`INSERT INTO users (full_name, password_hash, email, license_type) VALUES ('Stranger', 'pass', 'orgstranger_nextjs_test@test.com', 'PRO') RETURNING id`);
    strangerId = strangerRes.rows[0].id;

    console.log(`Created owner (${ownerId}), member (${memberId}), stranger (${strangerId}), org (${orgId})`);

    // 1. Member creates a product - it should be written to the OWNER's data (identity resolution)
    let res = await syncPOST(makeSyncRequest(memberId!, {
      lastSyncAt: null,
      changes: { products: [{ id: prodId, name: 'Shared Widget', sellingPrice: 100, category: 'General' }] },
    }));
    assert.strictEqual(res.status, 200, `Member's product create failed: ${JSON.stringify(await res.clone().json())}`);
    const prodCheck = await db.query('SELECT user_id FROM products WHERE frontend_id = $1', [prodId]);
    assert.strictEqual(prodCheck.rows[0].user_id, ownerId, "Member's write should be attributed to the organization owner's id");
    console.log("✅ Member's product write correctly resolved to the owner's user_id.");

    // 2. Owner's sync pull sees the product the member created
    res = await syncPOST(makeSyncRequest(ownerId!, { lastSyncAt: null, changes: {} }));
    const ownerPull = await res.json();
    assert.ok(ownerPull.products.find((p: { id: string }) => p.id === prodId), "Owner's pull should include the product the member created");
    console.log("✅ Owner sees the product their member created (shared data confirmed).");

    // 3. Member's own sync pull ALSO sees it (they share the same effective data)
    res = await syncPOST(makeSyncRequest(memberId!, { lastSyncAt: null, changes: {} }));
    const memberPull = await res.json();
    assert.ok(memberPull.products.find((p: { id: string }) => p.id === prodId), "Member's own pull should also include the shared product");
    console.log("✅ Member sees the same shared product on their own pull.");

    // 4. An unrelated stranger must NOT see any of this
    res = await syncPOST(makeSyncRequest(strangerId!, { lastSyncAt: null, changes: {} }));
    const strangerPull = await res.json();
    assert.ok(!strangerPull.products.find((p: { id: string }) => p.id === prodId), 'VULNERABLE: unrelated stranger saw organization data');
    console.log('✅ Unrelated stranger correctly sees none of the organization data.');

    console.log('--- ALL ORGANIZATION SHARING TESTS PASSED ---');
  } catch (error) {
    console.error('❌ TEST FAILED:', error);
    process.exitCode = 1;
  } finally {
    for (const uid of [ownerId, memberId, strangerId].filter(Boolean) as number[]) {
      await db.query('DELETE FROM products WHERE user_id = $1', [uid]);
    }
    if (memberId) await db.query('DELETE FROM users WHERE id = $1', [memberId]);
    // The owner's own row also references the org (organization_id) in addition to
    // organizations.owner_user_id referencing the owner - both FKs must be cleared
    // before the organizations row itself can be deleted.
    if (ownerId) await db.query('UPDATE users SET organization_id = NULL WHERE id = $1', [ownerId]);
    if (orgId) await db.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    if (ownerId) await db.query('DELETE FROM users WHERE id = $1', [ownerId]);
    if (strangerId) await db.query('DELETE FROM users WHERE id = $1', [strangerId]);
    console.log('Cleaned up test data.');
    process.exit();
  }
}

runTest();
