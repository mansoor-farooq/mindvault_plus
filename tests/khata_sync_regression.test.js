const assert = require('assert');

// Mock Dexie IndexedDB Simulator for Device A and Device B
class MockDeviceKhataDB {
  constructor(deviceName) {
    this.deviceName = deviceName;
    this.customers = new Map();
    this.transactions = new Map();
  }

  addCustomer(customerData) {
    const syncId = customerData.syncId || 'cust_' + Math.random().toString(36).substring(2);
    const doc = {
      ...customerData,
      syncId,
      openingBalance: customerData.openingBalance || 0,
      createdAt: customerData.createdAt || new Date(),
      updatedAt: customerData.updatedAt || new Date(),
      isDeleted: false
    };
    this.customers.set(syncId, doc);
    return doc;
  }

  addTransaction(txnData) {
    const syncId = txnData.syncId || 'txn_' + Math.random().toString(36).substring(2);
    const doc = {
      ...txnData,
      syncId,
      amount: Number(txnData.amount),
      date: txnData.date || new Date(),
      createdAt: txnData.createdAt || new Date(),
      updatedAt: txnData.updatedAt || new Date(),
      isDeleted: false
    };
    this.transactions.set(syncId, doc);
    return doc;
  }

  // DERIVED BALANCE CALCULATOR (Client-Side On-The-Fly Algorithm)
  calculateCustomerBalance(customerSyncId) {
    const customer = this.customers.get(customerSyncId);
    if (!customer) return 0;

    let balance = Number(customer.openingBalance || 0);
    for (const txn of this.transactions.values()) {
      if (txn.customerId === customerSyncId && !txn.isDeleted) {
        if (txn.type === 'CREDIT') balance += Number(txn.amount);
        if (txn.type === 'DEBIT') balance -= Number(txn.amount);
      }
    }
    return balance;
  }
}

// Mock PostgreSQL Server Database
class MockPostgreSQLBackend {
  constructor() {
    this.customers = new Map();
    this.transactions = new Map();
  }

  syncPush(changes) {
    // 1. Upsert Customers (Parent)
    if (changes.khataCustomers) {
      for (const c of changes.khataCustomers) {
        const id = c.id || c.syncId;
        this.customers.set(id, { ...c, id });
      }
    }
    // 2. Upsert Transactions (Child - FK verified)
    if (changes.khataTransactions) {
      for (const t of changes.khataTransactions) {
        const id = t.id || t.syncId;
        if (this.customers.has(t.customerId)) {
          this.transactions.set(id, { ...t, id });
        } else {
          console.warn(`[Backend Push Warning] Rejected txn ${id}: parent customer ${t.customerId} not found.`);
        }
      }
    }
  }

  syncPull() {
    return {
      khataCustomers: Array.from(this.customers.values()),
      khataTransactions: Array.from(this.transactions.values())
    };
  }
}

// Main Test Runner
async function runKhataSyncRegressionTest() {
  console.log('========================================================================');
  console.log('--- STARTING DUAL-OFFLINE DEVICE KHATA SYNC & BALANCE REGRESSION TEST ---');
  console.log('========================================================================');

  const backend = new MockPostgreSQLBackend();
  const deviceA = new MockDeviceKhataDB('Device A');
  const deviceB = new MockDeviceKhataDB('Device B');

  const customerSyncId = 'cust_shop_ali_101';

  console.log('\n[STEP 1] Create Initial Customer with Opening Balance = 200 on Device A');
  const custA = deviceA.addCustomer({
    syncId: customerSyncId,
    name: 'Ali Khan',
    phone: '03001234567',
    openingBalance: 200
  });

  // Device A syncs initial customer creation to backend
  backend.syncPush({ khataCustomers: [custA] });

  // Device B pulls initial customer from backend
  const pullResB1 = backend.syncPull();
  pullResB1.khataCustomers.forEach(c => deviceB.addCustomer(c));

  assert.strictEqual(deviceA.calculateCustomerBalance(customerSyncId), 200, 'Device A initial balance must equal opening balance (200)');
  assert.strictEqual(deviceB.calculateCustomerBalance(customerSyncId), 200, 'Device B initial balance must equal opening balance (200)');
  console.log('✓ Initial customer opening balance (Rs 200) verified on both devices.');

  console.log('\n[STEP 2] Dual Offline Additions: Device A and Device B add txns OFFLINE');
  // Device A adds +500 CREDIT offline
  const txnA1 = deviceA.addTransaction({
    syncId: 'txn_devA_500',
    customerId: customerSyncId,
    type: 'CREDIT',
    amount: 500,
    note: '2 Grocery Bags'
  });

  // Device B adds +300 CREDIT offline for the same customer
  const txnB1 = deviceB.addTransaction({
    syncId: 'txn_devB_300',
    customerId: customerSyncId,
    type: 'CREDIT',
    amount: 300,
    note: '1 Oil Bottle'
  });

  console.log(`Device A offline derived balance: Rs ${deviceA.calculateCustomerBalance(customerSyncId)}`);
  console.log(`Device B offline derived balance: Rs ${deviceB.calculateCustomerBalance(customerSyncId)}`);

  console.log('\n[STEP 3] Device A and Device B Sync to Backend sequentially');
  // Device A pushes
  backend.syncPush({ khataTransactions: [txnA1] });
  // Device B pushes
  backend.syncPush({ khataTransactions: [txnB1] });

  // Both devices pull full changes from backend
  const pullAll = backend.syncPull();

  pullAll.khataTransactions.forEach(t => {
    deviceA.addTransaction(t);
    deviceB.addTransaction(t);
  });

  console.log('\n[STEP 4] Assert Final Derived Balances Post-Sync');
  const finalBalA = deviceA.calculateCustomerBalance(customerSyncId);
  const finalBalB = deviceB.calculateCustomerBalance(customerSyncId);
  const expectedBalance = 200 + 500 + 300; // 1000

  console.log(`Final Calculated Balance on Device A: Rs ${finalBalA}`);
  console.log(`Final Calculated Balance on Device B: Rs ${finalBalB}`);

  assert.strictEqual(finalBalA, expectedBalance, `Device A balance must equal openingBalance (200) + 500 + 300 = ${expectedBalance}`);
  assert.strictEqual(finalBalB, expectedBalance, `Device B balance must equal openingBalance (200) + 500 + 300 = ${expectedBalance}`);
  assert.strictEqual(finalBalA, finalBalB, 'Device A and Device B balances must match 100% identically');

  console.log('\n[STEP 5] Add Payment Received (DEBIT) and Verify Net Reduction');
  const txnA2 = deviceA.addTransaction({
    syncId: 'txn_devA_debit_400',
    customerId: customerSyncId,
    type: 'DEBIT',
    amount: 400,
    note: 'Cash Payment'
  });

  backend.syncPush({ khataTransactions: [txnA2] });
  const pullAfterDebit = backend.syncPull();
  pullAfterDebit.khataTransactions.forEach(t => deviceB.addTransaction(t));

  const postDebitBal = expectedBalance - 400; // 600
  assert.strictEqual(deviceA.calculateCustomerBalance(customerSyncId), postDebitBal, `Device A balance post DEBIT must equal ${postDebitBal}`);
  assert.strictEqual(deviceB.calculateCustomerBalance(customerSyncId), postDebitBal, `Device B balance post DEBIT must equal ${postDebitBal}`);
  console.log(`✓ Payment received (DEBIT Rs 400) correctly reduced net balance to Rs ${postDebitBal} on both devices.`);

  console.log('\n========================================================================');
  console.log('🎉 DUAL-OFFLINE DEVICE KHATA SYNC & BALANCE REGRESSION TEST PASSED!');
  console.log('========================================================================');
}

runKhataSyncRegressionTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
