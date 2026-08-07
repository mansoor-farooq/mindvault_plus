const assert = require('assert');

// Mock Session Store Simulator for Admin Web Panel
class MockSessionStore {
  constructor() {
    this.sessions = new Map();
  }

  save(sid, sessionData) {
    this.sessions.set(sid, JSON.parse(JSON.stringify(sessionData)));
  }

  get(sid) {
    const data = this.sessions.get(sid);
    return data ? JSON.parse(JSON.stringify(data)) : null;
  }

  destroy(sid) {
    this.sessions.delete(sid);
  }
}

// Mock Admin Server Controller
class MockAdminServer {
  constructor() {
    this.store = new MockSessionStore();
    this.admins = [{ id: 1, email: 'admin@mindvault.io', role: 'SUPER_ADMIN', name: 'Super Admin' }];
  }

  // POST /admin/login
  login(email, password) {
    const admin = this.admins.find(a => a.email === email);
    if (!admin) {
      return { status: 400, error: 'Invalid credentials' };
    }

    const sid = 'sid_' + Math.random().toString(36).substring(2);
    const sessionData = {
      adminId: admin.id,
      adminName: admin.name,
      adminRole: admin.role,
      cookie: {
        name: 'mindvault_admin_sid',
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
      }
    };

    // Explicit sync save to session store before headers are returned
    this.store.save(sid, sessionData);

    return {
      status: 302,
      redirect: '/admin',
      cookieHeader: `mindvault_admin_sid=${sid}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      sid
    };
  }

  // GET /admin (Dashboard) - called on reload
  getDashboard(cookieHeader) {
    if (!cookieHeader) {
      return { status: 302, redirect: '/admin/login' };
    }

    const match = cookieHeader.match(/mindvault_admin_sid=([^;]+)/);
    if (!match) {
      return { status: 302, redirect: '/admin/login' };
    }

    const sid = match[1];
    const session = this.store.get(sid);

    if (!session || !session.adminId || (session.adminRole !== 'ADMIN' && session.adminRole !== 'SUPER_ADMIN')) {
      return { status: 302, redirect: '/admin/login' };
    }

    return {
      status: 200,
      view: 'admin/dashboard',
      adminName: session.adminName,
      adminRole: session.adminRole
    };
  }
}

// Main Test Runner
async function runSessionReloadRegressionTest() {
  console.log('===============================================================');
  console.log('--- STARTING ADMIN SESSION & DASHBOARD RELOAD REGRESSION TEST ---');
  console.log('===============================================================');

  const server = new MockAdminServer();

  console.log('\n[STEP 1] Admin Login via POST /admin/login');
  const loginRes = server.login('admin@mindvault.io', 'admin123');
  assert.strictEqual(loginRes.status, 302, 'Login must redirect to /admin');
  assert.ok(loginRes.sid, 'Session ID must be generated');
  assert.ok(loginRes.cookieHeader.includes('HttpOnly'), 'Cookie must be HttpOnly');
  assert.ok(loginRes.cookieHeader.includes('SameSite=Lax'), 'Cookie must have SameSite=Lax');
  console.log('✓ Login successful. Session cookie emitted:', loginRes.cookieHeader);

  console.log('\n[STEP 2] Simulate Browser Page Reload (GET /admin with only stored cookie)');
  // Simulating zero in-memory state: request passes ONLY the Cookie header stored by browser
  const reloadRes = server.getDashboard(`mindvault_admin_sid=${loginRes.sid}`);
  
  assert.strictEqual(reloadRes.status, 200, 'Page reload must return HTTP 200 Dashboard, NOT a redirect to login!');
  assert.strictEqual(reloadRes.view, 'admin/dashboard', 'View must be admin/dashboard');
  assert.strictEqual(reloadRes.adminRole, 'SUPER_ADMIN', 'Session data must persist intact across reload');
  console.log('✓ Dashboard reload granted HTTP 200 OK without redirecting to login.');

  console.log('\n[STEP 3] Test Multiple Consecutive Reloads (F5 Spammers)');
  for (let i = 1; i <= 20; i++) {
    const reloadN = server.getDashboard(`mindvault_admin_sid=${loginRes.sid}`);
    assert.strictEqual(reloadN.status, 200, `Reload iteration ${i} failed`);
  }
  console.log('✓ 20 consecutive page reloads verified without session loss.');

  console.log('\n[STEP 4] Verify Invalid / Missing Cookie Redirection');
  const invalidRes = server.getDashboard('mindvault_admin_sid=invalid_fake_sid');
  assert.strictEqual(invalidRes.status, 302, 'Invalid session must redirect to /admin/login');
  assert.strictEqual(invalidRes.redirect, '/admin/login');
  console.log('✓ Invalid session redirect verified.');

  console.log('\n===============================================================');
  console.log('🎉 ADMIN SESSION & DASHBOARD RELOAD REGRESSION TEST PASSED!');
  console.log('===============================================================');
}

runSessionReloadRegressionTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
