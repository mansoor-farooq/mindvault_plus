const assert = require('assert');
const path = require('path');
const { Pool } = require('../../backend/node_modules/pg');

// Configure dotenv to find backend .env file
require('../../backend/node_modules/dotenv').config({ path: path.resolve(__dirname, '../../backend/.env') });

// Resolve path to the backend config and controllers
const db = require('../../backend/src/config/db');
const adminController = require('../../backend/src/controllers/adminController');
const syncController = require('../../backend/src/controllers/syncController');

async function runLicenseSyncRegressionTest() {
  console.log('========================================================================');
  console.log('--- STARTING LICENSE SYNC MAPPING REGRESSION TEST ---');
  console.log('========================================================================');

  // 1. Insert a temporary test user in the database
  const email = 'test_license_sync_' + Math.random().toString(36).substring(2) + '@mindvault.io';
  console.log(`[STEP 1] Creating temporary test user with email: ${email}`);
  
  const insertUserResult = await db.query(`
    INSERT INTO users (full_name, email, password_hash, role, account_status, license_type)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, license_type, license_expiry
  `, ['Test License User', email, 'dummy_hash', 'USER', 'ACTIVE', 'FREE']);
  
  const testUser = insertUserResult.rows[0];
  const testUserId = testUser.id;
  console.log(`✓ Test user created with ID ${testUserId}. Initial license is '${testUser.license_type}'.`);

  try {
    // 2. Call adminController.updateUserLicense to upgrade user to PRO for 30 days
    console.log('\n[STEP 2] Assigning user PRO license via adminController.updateUserLicense');
    
    // Set up mock request and response for adminController
    const adminReq = {
      params: { id: testUserId },
      body: { license_type: 'PRO', duration_days: '30' },
      session: { adminId: 2, adminRole: 'SUPER_ADMIN' } // Simulate super admin
    };
    
    let redirectUrl = null;
    const adminRes = {
      redirect: (url) => {
        redirectUrl = url;
      },
      status: function(code) {
        this.statusCode = code;
        return this;
      },
      send: (msg) => {
        throw new Error(`Admin update user license failed: ${msg}`);
      }
    };

    await adminController.updateUserLicense(adminReq, adminRes);
    
    // Verify user was updated in DB
    const checkDbResult = await db.query('SELECT license_type, license_expiry FROM users WHERE id = $1', [testUserId]);
    const updatedUser = checkDbResult.rows[0];
    assert.strictEqual(updatedUser.license_type, 'PRO', 'DB license_type must be updated to PRO');
    assert.ok(updatedUser.license_expiry, 'DB license_expiry must be set');
    console.log(`✓ DB updated: license_type = '${updatedUser.license_type}', license_expiry = ${updatedUser.license_expiry}`);

    // 3. Call syncController.syncData to trigger a sync pull
    console.log('\n[STEP 3] Simulating sync request via syncController.syncData');
    
    const syncReq = {
      body: {
        lastSyncAt: null,
        changes: {
          notes: [],
          ledger: [],
          udhaar: [],
          bills: [],
          khataCustomers: [],
          khataTransactions: []
        }
      },
      user: { id: testUserId }
    };

    let syncResultData = null;
    const syncRes = {
      json: (data) => {
        syncResultData = data;
      },
      status: function(code) {
        this.statusCode = code;
        return this;
      }
    };

    await syncController.syncData(syncReq, syncRes);

    // 4. Assert the response returns license = "PRO" instead of undefined
    console.log('\n[STEP 4] Asserting sync response license mapping');
    assert.ok(syncResultData, 'Sync result data must be returned');
    assert.ok(syncResultData.user, 'Sync result must contain user metadata object');
    console.log('Sync user object returned:', syncResultData.user);
    assert.strictEqual(syncResultData.user.license, 'PRO', 'Sync response license must map correctly to PRO');
    console.log('✓ Success: Sync response license successfully returned "PRO".');

  } finally {
    // 5. Cleanup test user from database
    console.log('\n[STEP 5] Cleaning up temporary test user');
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
    console.log('✓ Cleanup complete.');
  }

  console.log('\n========================================================================');
  console.log('🎉 LICENSE SYNC MAPPING REGRESSION TEST PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

// Set env vars if not set
process.env.DB_NAME = process.env.DB_NAME || 'mindvault';

runLicenseSyncRegressionTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
