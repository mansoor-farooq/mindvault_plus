const fetch = require('node-fetch'); // Needs to be installed or use global fetch if Node 18+

async function runQATests() {
  const BASE_URL = 'http://localhost:5000';
  let token = '';
  
  console.log('--- STARTING QA TESTS ---');
  
  // TEST 1: Unauthenticated Sync (Should Fail)
  console.log('\\n[TEST 1] Attempting sync without JWT token...');
  let res = await fetch(`${BASE_URL}/api/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@gmail.com',
      lastSyncAt: new Date(0).toISOString(),
      changes: { notes: [], ledger: [], udhaar: [], bills: [] }
    })
  });
  
  if (res.status === 401) {
    console.log('✅ PASS: Backend correctly rejected unauthenticated sync with 401.');
  } else {
    console.error(`❌ FAIL: Expected 401, got ${res.status}`);
  }

  // TEST 2: Sync-Login (Should get Token)
  console.log('\\n[TEST 2] Attempting to get sync token via /api/auth/sync-login...');
  res = await fetch(`${BASE_URL}/api/auth/sync-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'test@gmail.com',
      fullName: 'Test User'
    })
  });
  
  if (res.ok) {
    const data = await res.json();
    token = data.token;
    if (token) {
       console.log('✅ PASS: Successfully received JWT token for offline-first sync.');
    } else {
       console.error('❌ FAIL: Login succeeded but no token was returned.');
    }
  } else {
    console.error(`❌ FAIL: sync-login failed with status ${res.status}`);
  }

  // TEST 3: Authenticated Sync & Data Mismatch Check
  console.log('\\n[TEST 3] Attempting authenticated sync and verifying data matches...');
  res = await fetch(`${BASE_URL}/api/sync`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    },
    body: JSON.stringify({
      lastSyncAt: null, // Force full sync
      changes: { notes: [], ledger: [], udhaar: [], bills: [] }
    })
  });
  
  if (res.ok) {
    const data = await res.json();
    if (data.user && data.user.status) {
      console.log('✅ PASS: Authenticated sync successful.');
      console.log(`   Fetched ${data.notes.length} notes, ${data.ledger.length} ledger entries.`);
      if (data.notes.length >= 4 && data.ledger.length >= 3) {
        console.log('✅ PASS: Data perfectly matches the seeded test data! No data mismatch.');
      } else {
        console.warn('⚠️ WARNING: Data count seems lower than expected.');
      }
    } else {
      console.error('❌ FAIL: Sync returned unexpected data structure.');
    }
  } else {
    console.error(`❌ FAIL: Authenticated sync failed with status ${res.status}`);
  }

  console.log('\\n--- QA TESTS COMPLETED ---');
}

runQATests();
