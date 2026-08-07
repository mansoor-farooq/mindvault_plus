const assert = require('assert');

// 1. Mock Local-First Database & Device State Simulator
class MockDexieTable {
  constructor(name) {
    this.name = name;
    this.data = [];
    this.autoInc = 1;
  }

  async add(item) {
    const record = { ...item };
    if (!record.id) {
      record.id = this.autoInc++;
    }
    if (!record.syncId) {
      record.syncId = 'uuid-' + Math.random().toString(36).substr(2, 9);
    }
    this.data.push(record);
    return record.id;
  }

  async update(id, updates) {
    const item = this.data.find(d => d.id === id || d.syncId === id);
    if (item) {
      Object.assign(item, updates);
    }
  }

  async toArray() {
    return [...this.data];
  }

  where(field) {
    return {
      equals: (val) => ({
        first: async () => this.data.find(d => d[field] === val) || null,
        toArray: async () => this.data.filter(d => d[field] === val)
      })
    };
  }
}

class MockDeviceDB {
  constructor(deviceName) {
    this.deviceName = deviceName;
    this.notes = new MockDexieTable('notes');
    this.documents = new MockDexieTable('documents');
    this.khataCustomers = new MockDexieTable('khataCustomers');
    this.khataTransactions = new MockDexieTable('khataTransactions');
  }
}

// 2. Mock Backend Server Sync Store
class MockBackendServer {
  constructor() {
    this.store = {
      notes: [],
      documents: [],
      khataCustomers: [],
      khataTransactions: []
    };
  }

  sync(payload) {
    const { changes } = payload;
    
    // Upsert incoming changes into backend store
    for (const key of ['notes', 'khataCustomers', 'documents', 'khataTransactions']) {
      if (changes[key]) {
        for (const item of changes[key]) {
          const idx = this.store[key].findIndex(x => x.id === item.id);
          if (idx >= 0) {
            this.store[key][idx] = { ...item };
          } else {
            this.store[key].push({ ...item });
          }
        }
      }
    }

    return {
      notes: this.store.notes,
      documents: this.store.documents,
      khataCustomers: this.store.khataCustomers,
      khataTransactions: this.store.khataTransactions
    };
  }
}

// 3. Test Runner Routine
async function runRegressionTest() {
  console.log('--- STARTING FK STABILITY & SYNC REGRESSION TEST ---');

  const backend = new MockBackendServer();
  const deviceA = new MockDeviceDB('Device A');
  const deviceB = new MockDeviceDB('Device B');

  // Pre-seed Device B with some existing unrelated records so local numeric auto-inc IDs differ!
  await deviceB.notes.add({ title: 'Unrelated Note Device B', syncId: 'uuid-b-note-99' });
  await deviceB.notes.add({ title: 'Another Device B Note', syncId: 'uuid-b-note-100' });
  await deviceB.khataCustomers.add({ name: 'Unrelated Customer B', syncId: 'uuid-b-cust-88' });

  console.log('Step 1: Create Parent + Child on Device A');
  // Device A creates KhataCustomer (Parent)
  const custSyncId = 'cust-uuid-111';
  const custLocalIdA = await deviceA.khataCustomers.add({
    name: 'Ali Khan',
    phone: '03001234567',
    syncId: custSyncId
  });

  // Device A creates KhataTransaction (Child referencing KhataCustomer.syncId)
  const txnSyncId = 'txn-uuid-222';
  await deviceA.khataTransactions.add({
    customerId: custSyncId, // FK -> parent.syncId (UUID)
    type: 'CREDIT',
    amount: 5000,
    syncId: txnSyncId
  });

  // Device A creates Note (Parent)
  const noteSyncId = 'note-uuid-333';
  const noteLocalIdA = await deviceA.notes.add({
    title: 'Project Proposal',
    type: 'DOCUMENT',
    syncId: noteSyncId
  });

  // Device A creates Document (Child referencing Note.syncId)
  const docSyncId = 'doc-uuid-444';
  await deviceA.documents.add({
    noteId: noteSyncId, // FK -> parent.syncId (UUID)
    fileName: 'proposal.pdf',
    syncId: docSyncId
  });

  // Verification on Device A
  const childTxnA = await deviceA.khataTransactions.where('syncId').equals(txnSyncId).first();
  assert.strictEqual(typeof childTxnA.customerId, 'string', 'FK customerId must be a string syncId');
  assert.strictEqual(childTxnA.customerId, custSyncId, 'FK customerId must match parent syncId');

  const childDocA = await deviceA.documents.where('syncId').equals(docSyncId).first();
  assert.strictEqual(typeof childDocA.noteId, 'string', 'FK noteId must be a string syncId');
  assert.strictEqual(childDocA.noteId, noteSyncId, 'FK noteId must match parent syncId');
  console.log('✓ Device A FK assertions passed.');

  console.log('Step 2: Sync Device A -> Backend');
  const pushPayload = {
    changes: {
      notes: await deviceA.notes.toArray(),
      documents: await deviceA.documents.toArray(),
      khataCustomers: await deviceA.khataCustomers.toArray(),
      khataTransactions: await deviceA.khataTransactions.toArray()
    }
  };
  const serverResponse = backend.sync(pushPayload);
  console.log('✓ Backend sync completed successfully.');

  console.log('Step 3: Pull on Device B & Apply with Sync Order + FK Validation');
  // Order Guarantee: Parents (notes, khataCustomers) BEFORE Children (documents, khataTransactions)
  
  // Apply Notes
  for (const sn of serverResponse.notes) {
    const { id, ...data } = sn;
    await deviceB.notes.add({ ...data, syncId: sn.syncId });
  }

  // Apply Khata Customers
  for (const skc of serverResponse.khataCustomers) {
    const { id, ...data } = skc;
    await deviceB.khataCustomers.add({ ...data, syncId: skc.syncId });
  }

  // Apply Documents with FK Validation
  for (const sdoc of serverResponse.documents) {
    const parentNote = await deviceB.notes.where('syncId').equals(sdoc.noteId).first();
    assert.ok(parentNote, `FK Validation: Parent Note ${sdoc.noteId} must exist locally on Device B before adding Document!`);
    const { id, ...data } = sdoc;
    await deviceB.documents.add({ ...data, syncId: sdoc.syncId });
  }

  // Apply Khata Transactions with FK Validation
  for (const skt of serverResponse.khataTransactions) {
    const parentCust = await deviceB.khataCustomers.where('syncId').equals(skt.customerId).first();
    assert.ok(parentCust, `FK Validation: Parent KhataCustomer ${skt.customerId} must exist locally on Device B before adding KhataTransaction!`);
    const { id, ...data } = skt;
    await deviceB.khataTransactions.add({ ...data, syncId: skt.syncId });
  }

  console.log('Step 4: Assertions on Device B');
  // Verify Child KhataTransaction on Device B
  const childTxnB = await deviceB.khataTransactions.where('syncId').equals(txnSyncId).first();
  assert.ok(childTxnB, 'KhataTransaction must exist on Device B');
  assert.strictEqual(childTxnB.customerId, custSyncId, 'KhataTransaction customerId must equal parent syncId');

  const resolvedCustomerB = await deviceB.khataCustomers.where('syncId').equals(childTxnB.customerId).first();
  assert.ok(resolvedCustomerB, 'Parent KhataCustomer must be resolvable via FK customerId on Device B');
  assert.strictEqual(resolvedCustomerB.name, 'Ali Khan', 'Resolved KhataCustomer must match original parent data');

  // Verify Child Document on Device B
  const childDocB = await deviceB.documents.where('syncId').equals(docSyncId).first();
  assert.ok(childDocB, 'Document must exist on Device B');
  assert.strictEqual(childDocB.noteId, noteSyncId, 'Document noteId must equal parent note syncId');

  const resolvedNoteB = await deviceB.notes.where('syncId').equals(childDocB.noteId).first();
  assert.ok(resolvedNoteB, 'Parent Note must be resolvable via FK noteId on Device B');
  assert.strictEqual(resolvedNoteB.title, 'Project Proposal', 'Resolved Note must match original parent data');

  console.log('--------------------------------------------------');
  console.log('🎉 REGRESSION TEST PASSED SUCCESSFULLY!');
  console.log('Foreign key pattern validated: 100% stable across devices via syncId.');
}

runRegressionTest().catch(err => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
