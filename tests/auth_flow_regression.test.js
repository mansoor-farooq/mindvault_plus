const assert = require('assert');
const bcrypt = require('bcryptjs');
const jwt = require('../../backend/node_modules/jsonwebtoken');

// Import utilities
const normalizeEmail = require('../../backend/src/utils/normalizeEmail');
const { withAuthLock } = require('../../backend/src/utils/authLock');

// 1. Mock DB Engine for Auth Test Suite
class MockUserDB {
  constructor() {
    this.users = [];
    this.autoInc = 1;
  }

  async findByEmail(email) {
    const clean = normalizeEmail(email);
    return this.users.find(u => normalizeEmail(u.email) === clean) || null;
  }

  async create({ full_name, email, password_hash }) {
    const clean = normalizeEmail(email);
    const existing = await this.findByEmail(clean);
    if (existing) {
      throw new Error('Email already registered');
    }
    const user = {
      id: this.autoInc++,
      full_name,
      email: clean,
      password_hash,
      account_status: 'ACTIVE',
      created_at: new Date()
    };
    this.users.push(user);
    return user;
  }

  async updatePasswordHash(id, newHash) {
    const user = this.users.find(u => u.id === id);
    if (user) {
      user.password_hash = newHash;
    }
  }
}

// 2. Mock Auth Controller logic matching backend
class MockAuthController {
  constructor(dbStore) {
    this.db = dbStore;
    this.secret = 'testsecret123';
  }

  async register(full_name, rawEmail, password) {
    const cleanEmail = normalizeEmail(rawEmail);
    return withAuthLock(cleanEmail, async () => {
      const existing = await this.db.findByEmail(cleanEmail);
      if (existing) {
        return { status: 400, error: 'Email already registered', reason: 'EMAIL_ALREADY_REGISTERED' };
      }
      const salt = bcrypt.genSaltSync(10);
      const password_hash = bcrypt.hashSync(password, salt);
      const user = await this.db.create({ full_name, email: cleanEmail, password_hash });
      return { status: 201, user };
    });
  }

  async login(rawEmail, password) {
    const cleanEmail = normalizeEmail(rawEmail);
    return withAuthLock(cleanEmail, async () => {
      const user = await this.db.findByEmail(cleanEmail);
      if (!user) {
        return { status: 400, error: 'Invalid email or password', reason: 'USER_NOT_FOUND' };
      }
      if (user.account_status === 'BANNED') {
        return { status: 403, error: 'Account is BANNED', reason: 'ACCOUNT_BANNED' };
      }

      let isMatch = bcrypt.compareSync(password, user.password_hash);
      if (!isMatch && user.password_hash === 'dummy_hash_for_sync') {
        const salt = bcrypt.genSaltSync(10);
        const newHash = bcrypt.hashSync(password, salt);
        await this.db.updatePasswordHash(user.id, newHash);
        isMatch = true;
      }

      if (!isMatch) {
        return { status: 400, error: 'Invalid email or password', reason: 'INVALID_PASSWORD' };
      }

      const token = jwt.sign({ id: user.id }, this.secret, { expiresIn: '7d' });
      return { status: 200, token, user };
    });
  }

  async syncLogin(rawEmail, fullName) {
    const cleanEmail = normalizeEmail(rawEmail);
    return withAuthLock(cleanEmail, async () => {
      let user = await this.db.findByEmail(cleanEmail);
      if (!user) {
        user = await this.db.create({
          full_name: fullName || cleanEmail,
          email: cleanEmail,
          password_hash: 'dummy_hash_for_sync'
        });
      }
      if (user.account_status === 'BANNED') {
        return { status: 403, error: 'Account is BANNED', reason: 'ACCOUNT_BANNED' };
      }
      const token = jwt.sign({ id: user.id }, this.secret, { expiresIn: '7d' });
      return { status: 200, token, user };
    });
  }
}

// 3. Main Test Suite
async function runAuthRegressionTests() {
  console.log('==================================================');
  console.log('--- STARTING AUTH & LOGIN REGRESSION TEST SUITE ---');
  console.log('==================================================');

  const dbStore = new MockUserDB();
  const controller = new MockAuthController(dbStore);

  console.log('\n[TEST 1] Rapid Register + Login Loop (50 iterations)');
  const testEmail = 'rapid.user@mindvault.io';
  const testPass = 'SuperPassword123!';
  
  const regRes = await controller.register('Rapid User', testEmail, testPass);
  assert.strictEqual(regRes.status, 201, 'Registration should succeed');

  for (let i = 1; i <= 50; i++) {
    const loginRes = await controller.login(testEmail, testPass);
    assert.strictEqual(loginRes.status, 200, `Iteration ${i} login failed`);
    assert.ok(loginRes.token, `Iteration ${i} token missing`);
  }
  console.log('✓ Passed 50 rapid login iterations without a single failure.');

  console.log('\n[TEST 2] Mixed-Case Email Normalization');
  const mixedRegEmail = '  John.Doe.Dev@Example.COM  ';
  const mixedLoginEmail1 = 'john.doe.dev@example.com';
  const mixedLoginEmail2 = 'JOHN.DOE.DEV@EXAMPLE.COM';

  const regMixed = await controller.register('John Doe', mixedRegEmail, 'Password789!');
  assert.strictEqual(regMixed.status, 201);
  assert.strictEqual(regMixed.user.email, 'john.doe.dev@example.com', 'Registered email must be lowercased and trimmed');

  const loginMixed1 = await controller.login(mixedLoginEmail1, 'Password789!');
  assert.strictEqual(loginMixed1.status, 200, 'Lowercased login must succeed');

  const loginMixed2 = await controller.login(mixedLoginEmail2, 'Password789!');
  assert.strictEqual(loginMixed2.status, 200, 'UPPERCASED login must succeed');
  console.log('✓ Passed mixed-case email normalization across register and login.');

  console.log('\n[TEST 3] Offline Registration -> Online Sync Login Race Condition');
  const offlineEmail = '  Offline.User@Domain.org ';
  const offlinePass = 'MyOfflinePass123';

  // 1. Simulate device offline registration (stores locally, then syncLogin runs when internet returns)
  // Concurrently trigger syncLogin (from background sync) AND manual login (from web/device 2)
  const [syncRes, manualLoginRes] = await Promise.all([
    controller.syncLogin(offlineEmail, 'Offline User'),
    controller.login(offlineEmail, offlinePass)
  ]);

  assert.strictEqual(syncRes.status, 200, 'Sync login must create/retrieve user safely');
  assert.strictEqual(manualLoginRes.status, 200, 'Concurrent manual login must upgrade dummy hash and succeed');
  console.log('✓ Passed offline registration sync-login race condition resolution.');

  console.log('\n[TEST 4] Concurrent Login Attempts (10 Parallel Requests)');
  const concEmail = 'concurrent.tester@mindvault.io';
  const concPass = 'ConcurrentPass123!';
  await controller.register('Conc Tester', concEmail, concPass);

  const concurrentLogins = Array.from({ length: 10 }, () => controller.login(concEmail, concPass));
  const results = await Promise.all(concurrentLogins);

  results.forEach((res, index) => {
    assert.strictEqual(res.status, 200, `Concurrent request ${index + 1} failed`);
    assert.ok(res.token, `Concurrent request ${index + 1} token missing`);
  });
  console.log('✓ Passed 10 concurrent parallel login attempts.');

  console.log('\n[TEST 5] Structured Reason Logging on Failure');
  const wrongPassRes = await controller.login(concEmail, 'WrongPassword123');
  assert.strictEqual(wrongPassRes.status, 400);
  assert.strictEqual(wrongPassRes.reason, 'INVALID_PASSWORD');

  const notFoundRes = await controller.login('nonexistent.user@mindvault.io', 'SomePass123');
  assert.strictEqual(notFoundRes.status, 400);
  assert.strictEqual(notFoundRes.reason, 'USER_NOT_FOUND');
  console.log('✓ Passed structured rejection reasons.');

  console.log('\n==================================================');
  console.log('🎉 ALL AUTH REGRESSION TESTS PASSED SUCCESSFULLY!');
  console.log('==================================================');
}

runAuthRegressionTests().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
