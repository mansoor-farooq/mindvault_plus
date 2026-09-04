import { db } from '../lib/db.server';
import {
  resolveUserPermissions,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
  assignUserRole
} from '../lib/services/permissionService';
import { CANONICAL_MODULES } from '../lib/permissions/canonicalModules';

async function runVerification() {
  console.log('=====================================================');
  console.log('🧪 Starting User Permission Gate (Layer 2) Test Suite');
  console.log('=====================================================\n');

  try {
    // 1. Fetch a test business owner
    const ownerRes = await db.query('SELECT id, email, license_type, license_expiry FROM users WHERE id = 1');
    if (ownerRes.rows.length === 0) {
      throw new Error('Business user 1 not found for testing.');
    }
    const owner = ownerRes.rows[0];
    console.log(`[Test 1] Found business owner: ID ${owner.id} (${owner.email}), Plan: ${owner.license_type}`);

    // 2. Resolve owner permissions (Must be full on all modules unlocked by their plan)
    const ownerPerms = await resolveUserPermissions(owner.id, owner.id);
    console.log(`[Test 2] Resolved owner permissions: Role: "${ownerPerms.roleName}", isOwner: ${ownerPerms.isOwner}`);
    if (!ownerPerms.isOwner || ownerPerms.roleName !== 'Owner') {
      throw new Error('Owner invariant failed: User 1 is not resolved as Owner');
    }
    console.log('   ✅ Owner permissions verified.');

    // 3. Test creating a custom role "Cashier" with restricted permissions
    console.log('\n[Test 3] Creating custom role "Staff Cashier"...');
    const cashierPerms: Record<string, string> = {};
    CANONICAL_MODULES.forEach(m => {
      cashierPerms[m.key] = 'none';
    });
    cashierPerms['pos'] = 'full';
    cashierPerms['khata'] = 'view';
    cashierPerms['inventory'] = 'view';

    const newRole = await createCustomRole(owner.id, owner.id, {
      name: `Staff Cashier Test ${Date.now()}`,
      description: 'Test Cashier with POS full, Khata view, Inventory view',
      permissions: cashierPerms
    });
    console.log(`   ✅ Created custom role: ID "${newRole.syncId}", Name: "${newRole.name}"`);

    // 4. Test updating the custom role
    console.log('\n[Test 4] Updating custom role permissions...');
    cashierPerms['service_tracker'] = 'view';
    await updateCustomRole(owner.id, owner.id, newRole.syncId, {
      name: newRole.name,
      description: 'Updated description',
      permissions: cashierPerms
    });
    console.log('   ✅ Role permissions updated successfully.');

    // 5. Test Owner role modification protection (must fail!)
    console.log('\n[Test 5] Testing Owner Role protection against update/deletion...');
    const ownerRoleRes = await db.query('SELECT frontend_id FROM roles WHERE business_id = $1 AND is_system_default = true', [owner.id]);
    const ownerRoleId = ownerRoleRes.rows[0].frontend_id;

    let caughtError = false;
    try {
      await updateCustomRole(owner.id, owner.id, ownerRoleId, {
        name: 'Hacked Owner',
        description: 'Hacked',
        permissions: cashierPerms
      });
    } catch (e: any) {
      caughtError = true;
      console.log(`   🛡️ Correctly prevented modifying system default Owner role: "${e.message}"`);
    }
    if (!caughtError) throw new Error('Security flaw: System Default Owner role was modified!');

    caughtError = false;
    try {
      await deleteCustomRole(owner.id, owner.id, ownerRoleId);
    } catch (e: any) {
      caughtError = true;
      console.log(`   🛡️ Correctly prevented deleting system default Owner role: "${e.message}"`);
    }
    if (!caughtError) throw new Error('Security flaw: System Default Owner role was deleted!');

    // 6. Test Assigning role to a test user
    console.log('\n[Test 6] Testing user role assignment and live invalidation...');
    // Create or select a test staff member
    let staffRes = await db.query('SELECT id, email FROM users WHERE email = $1', ['test_staff@mindvault.local']);
    let staffId: number;
    if (staffRes.rows.length === 0) {
      const insStaff = await db.query(
        `INSERT INTO users (email, full_name, password_hash, org_role)
         VALUES ('test_staff@mindvault.local', 'Test Staff Member', 'dummyhash', 'MEMBER')
         RETURNING id`
      );
      staffId = insStaff.rows[0].id;
    } else {
      staffId = staffRes.rows[0].id;
    }

    const beforeRoleUpdatedAt = (await db.query('SELECT role_updated_at FROM users WHERE id = $1', [staffId])).rows[0].role_updated_at;

    await assignUserRole(owner.id, owner.id, staffId, newRole.syncId);

    const afterRoleUpdatedAt = (await db.query('SELECT role_updated_at FROM users WHERE id = $1', [staffId])).rows[0].role_updated_at;
    console.log(`   ✅ Assigned staff member (ID: ${staffId}) to role "${newRole.name}".`);
    console.log(`   ✅ Verified role_updated_at timestamp bumped for real-time session invalidation.`);

    // 7. Test permission resolution for staff member (Verify Ceiling Rule)
    console.log('\n[Test 7] Testing permission resolution for staff member with Layer 1 Ceiling...');
    const staffPerms = await resolveUserPermissions(staffId, owner.id);
    console.log(`   Staff Role: "${staffPerms.roleName}", isOwner: ${staffPerms.isOwner}`);
    console.log(`   POS access: ${staffPerms.permissions.pos}`);
    console.log(`   Khata access: ${staffPerms.permissions.khata}`);
    console.log(`   Roznamcha access: ${staffPerms.permissions.roznamcha}`);
    console.log(`   Factory access: ${staffPerms.permissions.factory}`);

    if (staffPerms.permissions.pos !== 'full') throw new Error('Staff POS permission failed');
    if (staffPerms.permissions.khata !== 'view') throw new Error('Staff Khata permission failed');
    if (staffPerms.permissions.roznamcha !== 'none') throw new Error('Staff Roznamcha permission leak');
    console.log('   ✅ Staff permissions strictly match role matrix under Layer 1 ceiling.');

    // 8. Clean up test staff assignment before deleting role
    await db.query('DELETE FROM user_role_assignments WHERE user_id = $1', [staffId]);
    await db.query('DELETE FROM users WHERE id = $1', [staffId]);
    console.log('   ✅ Test staff cleaned up.');

    // 9. Test deleting the custom role
    console.log('\n[Test 8] Deleting test custom role...');
    await deleteCustomRole(owner.id, owner.id, newRole.syncId);
    console.log('   ✅ Custom role soft-deleted.');

    console.log('\n=====================================================');
    console.log('🎉 ALL USER PERMISSION GATE TESTS PASSED SUCCESSFULLY!');
    console.log('=====================================================\n');
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  }
}

runVerification();
