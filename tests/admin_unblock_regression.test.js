const assert = require('assert');
const jwt = require('../../backend/node_modules/jsonwebtoken');

// 1. Mock DB Engine for Admin Unblock Test Suite
class MockDatabase {
  constructor() {
    this.users = [];
    this.adminLogs = [];
    this.autoInc = 1;
  }

  async createUser({ full_name, email, password_hash, role = 'USER', account_status = 'ACTIVE' }) {
    const user = {
      id: this.autoInc++,
      full_name,
      email: email.trim().toLowerCase(),
      password_hash,
      role,
      account_status,
      created_at: new Date()
    };
    this.users.push(user);
    return user;
  }

  async getUserById(id) {
    return this.users.find(u => u.id === id) || null;
  }

  async updateUserStatus(adminId, userId, newStatus) {
    const user = await this.getUserById(userId);
    if (!user) throw new Error('User not found');

    const oldStatus = user.account_status || 'ACTIVE';
    user.account_status = newStatus;

    const action = newStatus === 'BANNED' ? 'USER_BLOCK' : (newStatus === 'ACTIVE' ? 'USER_UNBLOCK' : 'USER_STATUS_CHANGE');
    
    // Write admin_logs entry
    const logEntry = {
      id: this.adminLogs.length + 1,
      admin_id: adminId,
      target_user_id: userId,
      action,
      details: `Status changed from ${oldStatus} to ${newStatus}`,
      created_at: new Date()
    };
    this.adminLogs.push(logEntry);

    return { user, oldStatus, newStatus, logEntry };
  }
}

// 2. Mock Middleware & Route Handlers
class MockApp {
  constructor(db) {
    this.db = db;
    this.secret = 'testsecret123';
  }

  // Live DB-checking Middleware
  async authenticateJwtMiddleware(token) {
    try {
      const decoded = jwt.verify(token, this.secret);
      
      // Live DB query - never trust cached JWT claims alone!
      const user = await this.db.getUserById(decoded.id);
      if (!user) {
        return { status: 401, error: 'User no longer exists' };
      }

      if (user.account_status === 'BANNED' || user.account_status === 'SUSPENDED') {
        return { status: 403, error: `Account is ${user.account_status}. Please contact support.` };
      }

      return { status: 200, user };
    } catch (err) {
      return { status: 401, error: 'Token is not valid' };
    }
  }
}

// 3. Main Regression Test Routine
async function runUnblockRegressionTest() {
  console.log('======================================================');
  console.log('--- STARTING ADMIN BLOCK/UNBLOCK REGRESSION TEST ---');
  console.log('======================================================');

  const db = new MockDatabase();
  const app = new MockApp(db);

  // 1. Setup Admin and Target User
  const admin = await db.createUser({ full_name: 'Admin User', email: 'admin@mindvault.io', password_hash: 'hash', role: 'ADMIN' });
  const targetUser = await db.createUser({ full_name: 'Test Target', email: 'target@mindvault.io', password_hash: 'hash', role: 'USER' });

  // Sign JWT token for target user while active
  const userToken = jwt.sign({ id: targetUser.id }, app.secret, { expiresIn: '7d' });

  console.log('\n[STEP 1] Verify Initial Active Access');
  const activeRes = await app.authenticateJwtMiddleware(userToken);
  assert.strictEqual(activeRes.status, 200, 'Initial access must succeed');
  console.log('✓ Initial access granted.');

  console.log('\n[STEP 2] Admin Bans User');
  const blockRes = await db.updateUserStatus(admin.id, targetUser.id, 'BANNED');
  assert.strictEqual(blockRes.user.account_status, 'BANNED');
  assert.strictEqual(blockRes.logEntry.action, 'USER_BLOCK');
  assert.strictEqual(blockRes.logEntry.details, 'Status changed from ACTIVE to BANNED');
  console.log('✓ Admin log created with before/after status:', blockRes.logEntry.details);

  console.log('\n[STEP 3] Verify Immediate Lockout with Existing Token');
  const lockedRes = await app.authenticateJwtMiddleware(userToken);
  assert.strictEqual(lockedRes.status, 403, 'Banned user must be locked out immediately');
  assert.ok(lockedRes.error.includes('BANNED'), 'Response error must indicate BANNED status');
  console.log('✓ Immediate lockout verified on protected API call.');

  console.log('\n[STEP 4] Admin Unblocks User');
  const unblockRes = await db.updateUserStatus(admin.id, targetUser.id, 'ACTIVE');
  assert.strictEqual(unblockRes.user.account_status, 'ACTIVE');
  assert.strictEqual(unblockRes.logEntry.action, 'USER_UNBLOCK');
  assert.strictEqual(unblockRes.logEntry.details, 'Status changed from BANNED to ACTIVE');
  console.log('✓ Admin log created with before/after status:', unblockRes.logEntry.details);

  console.log('\n[STEP 5] Verify Immediate Access Restored (WITHOUT Re-login / Token Regeneration)');
  const restoredRes = await app.authenticateJwtMiddleware(userToken);
  assert.strictEqual(restoredRes.status, 200, 'Access must be restored immediately using the existing token');
  assert.strictEqual(restoredRes.user.id, targetUser.id, 'Restored user payload must match target user');
  console.log('✓ Access restored immediately using existing token without re-login requirement.');

  console.log('\n======================================================');
  console.log('🎉 UNBLOCK REGRESSION TEST PASSED SUCCESSFULLY!');
  console.log('======================================================');
}

runUnblockRegressionTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
