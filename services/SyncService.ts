import { db, Note, LedgerEntry, Udhaar } from '@/lib/db';
import { useAuthStore } from '@/store/authStore';
import { normalizeEmail } from '@/lib/utils';

export class SyncService {
  static async sync() {
    const user = useAuthStore.getState().user;
    if (!user) return; // Must be logged in

    const cleanEmail = normalizeEmail(user.email);

    try {
      // 1. Get last sync time
      const syncStatus = await db.syncStatus.toCollection().last();
      const lastSyncAt = syncStatus ? syncStatus.lastSyncAt : new Date(0);
      const syncStartTime = new Date();

      // 2. Fetch locally updated records
      const updatedNotes = await db.notes.where('updatedAt').above(lastSyncAt).toArray();
      const updatedDocuments = await db.documents.toArray(); // docs synced if any
      const updatedAnnotations = await db.annotations.toArray();
      const updatedReminders = await db.reminders.toArray();
      const updatedChatMessages = await db.chatMessages.where('createdAt').above(lastSyncAt).toArray();
      const updatedLedger = await db.ledgerEntries.where('updatedAt').above(lastSyncAt).toArray();
      const updatedUdhaar = await db.udhaar.where('updatedAt').above(lastSyncAt).toArray();
      const updatedBills = await db.bills.where('updatedAt').above(lastSyncAt).toArray();
      const updatedKhataCustomers = await db.khataCustomers.where('updatedAt').above(lastSyncAt).toArray();
      const updatedKhataTxns = await db.khataTransactions.where('updatedAt').above(lastSyncAt).toArray();
      const updatedProducts = await db.products.where('updatedAt').above(lastSyncAt).toArray();
      const updatedProductVariants = await db.productVariants.where('updatedAt').above(lastSyncAt).toArray();
      const updatedStockMovements = await db.stockMovements.where('updatedAt').above(lastSyncAt).toArray();
      const updatedLocations = await db.locations.where('updatedAt').above(lastSyncAt).toArray();
      const updatedCategories = await db.categories.where('updatedAt').above(lastSyncAt).toArray();

      // Prepare payload without blobs
      const payload = {
        userId: user.id,
        email: user.email,
        lastSyncAt: lastSyncAt.toISOString(),
        changes: {
          notes: updatedNotes.map(n => {
            const { audioBlob, id, syncId, ...rest } = n;
            return { ...rest, id: syncId, localId: id };
          }),
          documents: updatedDocuments.map(d => {
            const { fileBlob, id, syncId, ...rest } = d;
            return { ...rest, id: syncId, localId: id };
          }),
          annotations: updatedAnnotations.map(a => {
            const { id, syncId, ...rest } = a;
            return { ...rest, id: syncId, localId: id };
          }),
          reminders: updatedReminders.map(r => {
            const { id, syncId, ...rest } = r;
            return { ...rest, id: syncId, localId: id };
          }),
          chatMessages: updatedChatMessages.map(m => {
            const { id, syncId, ...rest } = m;
            return { ...rest, id: syncId, localId: id };
          }),
          ledger: updatedLedger.map(l => {
            const { attachedPhotoBlob, id, syncId, ...rest } = l;
            return { ...rest, id: syncId, localId: id };
          }),
          udhaar: updatedUdhaar.map(u => {
            const { id, syncId, ...rest } = u;
            return { ...rest, id: syncId, localId: id };
          }),
          bills: updatedBills.map(b => {
            const { id, syncId, ...rest } = b;
            return { ...rest, id: syncId, localId: id };
          }),
          khataCustomers: updatedKhataCustomers.map(kc => {
            const { id, syncId, ...rest } = kc;
            return { ...rest, id: syncId, localId: id };
          }),
          khataTransactions: updatedKhataTxns.map(kt => {
            const { id, syncId, ...rest } = kt;
            return { ...rest, id: syncId, localId: id };
          }),
          products: updatedProducts.map(p => {
            const { id, syncId, ...rest } = p;
            return { ...rest, id: syncId, localId: id };
          }),
          productVariants: updatedProductVariants.map(v => {
            const { id, syncId, ...rest } = v;
            return { ...rest, id: syncId, localId: id };
          }),
          stockMovements: updatedStockMovements.map(sm => {
            const { id, syncId, ...rest } = sm;
            return { ...rest, id: syncId, localId: id };
          }),
          locations: updatedLocations.map(l => {
            const { id, syncId, ...rest } = l;
            return { ...rest, id: syncId, localId: id };
          }),
          categories: updatedCategories.map(c => {
            const { id, syncId, ...rest } = c;
            return { ...rest, id: syncId, localId: id };
          })
        }
      };

      const { token, login } = useAuthStore.getState();

      // Ensure we have a token
      let currentToken = token;
      if (!currentToken) {
        // Try to get token via sync-login
        const authRes = await fetch(`/api/auth/sync-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            fullName: user.fullName || cleanEmail,
            country: user.country,
            city: user.city,
            religion: user.religion,
            namazRemindersEnabled: user.namazRemindersEnabled,
            businessType: user.businessType,
            accountType: user.accountType,
            organizationName: user.organizationName,
          })
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          currentToken = authData.token;
          login(user, currentToken!);
        } else {
          console.warn('Failed to obtain sync token from backend');
          return;
        }
      }

      // 3. Send to backend
      const response = await fetch(`/api/sync`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}` 
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errText = await response.text();
        if (response.status === 403 && errText.includes('BANNED')) {
          if (user.id) {
            await db.users.update(user.id, { status: 'BANNED' });
          }
          useAuthStore.getState().updateUser({ status: 'BANNED' });
          console.warn(`Sync failed (BANNED): ${errText}`);
          return;
        }
        console.warn(`Sync failed with server: ${errText}`);
        return;
      }

      const serverData = await response.json();
      
      // Update local user license/status if provided
      if (serverData.user) {
        if (user.id && (serverData.user.status !== user.status || serverData.user.license !== user.license)) {
          await db.users.update(user.id, { 
            status: serverData.user.status,
            license: serverData.user.license
          });
          useAuthStore.getState().updateUser({
            license: serverData.user.license,
            status: serverData.user.status
          });
        }
      }

      // 4. Upload pending files for new/updated notes
      for (const note of updatedNotes) {
        if (note.audioBlob && !note.voicePath) {
          await this.uploadFile(note.id!, note.audioBlob, 'audio');
        }
        if (note.fileBlob && !note.filePath) {
          await this.uploadFile(note.id!, note.fileBlob, 'document');
        }
      }

      // 5. Apply server changes to local DB matching by syncId (Sync Order: Parents before Children)
      await db.transaction('rw', [db.notes, db.documents, db.annotations, db.reminders, db.chatMessages, db.ledgerEntries, db.udhaar, db.bills, db.khataCustomers, db.khataTransactions, db.products, db.productVariants, db.stockMovements, db.featureUsage, db.locations, db.categories], async () => {
        // 0. Locations (Parent - must exist locally before Products/StockMovements/KhataCustomers reference them)
        if (serverData.locations?.length) {
          for (const sloc of serverData.locations) {
            const existing = await db.locations.where('syncId').equals(sloc.id).first();
            const locData = { ...sloc, syncId: sloc.id, updatedAt: new Date(sloc.updatedAt), createdAt: new Date(sloc.createdAt) };
            delete locData.id;
            if (existing) {
              await db.locations.update(existing.id!, locData);
            } else {
              await db.locations.add(locData);
            }
          }
        }

        // 0b. Categories (Parent - self-referencing tree, must exist locally before Products reference them)
        if (serverData.categories?.length) {
          for (const scat of serverData.categories) {
            const existing = await db.categories.where('syncId').equals(scat.id).first();
            const catData = { ...scat, syncId: scat.id, updatedAt: new Date(scat.updatedAt), createdAt: new Date(scat.createdAt) };
            delete catData.id;
            if (existing) {
              await db.categories.update(existing.id!, catData);
            } else {
              await db.categories.add(catData);
            }
          }
        }

        // 1. Notes (Parent)
        if (serverData.notes?.length) {
          for (const sn of serverData.notes) {
            const existing = await db.notes.where('syncId').equals(sn.id).first();
            const noteData = { ...sn, syncId: sn.id, updatedAt: new Date(sn.updatedAt), createdAt: new Date(sn.createdAt) };
            delete noteData.id;
            if (existing) {
              await db.notes.update(existing.id!, noteData);
            } else {
              await db.notes.add(noteData);
            }
          }
        }

        // 2. Khata Customers (Parent)
        if (serverData.khataCustomers?.length) {
          for (const skc of serverData.khataCustomers) {
            const existing = await db.khataCustomers.where('syncId').equals(skc.id).first();
            const kcData = { ...skc, syncId: skc.id, updatedAt: new Date(skc.updatedAt), createdAt: new Date(skc.createdAt) };
            delete kcData.id;
            if (existing) {
              await db.khataCustomers.update(existing.id!, kcData);
            } else {
              await db.khataCustomers.add(kcData);
            }
          }
        }

        // 3. Documents (Child of Note, Parent of Annotation)
        if (serverData.documents?.length) {
          for (const sdoc of serverData.documents) {
            // FK Validation: Ensure parent Note exists
            const parentNote = await db.notes.where('syncId').equals(sdoc.noteId).first();
            if (!parentNote && sdoc.noteId) {
              console.warn(`Skipping document syncId ${sdoc.id}: parent Note ${sdoc.noteId} not found locally.`);
              continue;
            }
            const existing = await db.documents.where('syncId').equals(sdoc.id).first();
            const docData = { ...sdoc, syncId: sdoc.id };
            delete docData.id;
            if (existing) {
              await db.documents.update(existing.id!, docData);
            } else {
              await db.documents.add(docData);
            }
          }
        }

        // 4. Annotations (Child of Document)
        if (serverData.annotations?.length) {
          for (const sann of serverData.annotations) {
            // FK Validation: Ensure parent Document exists
            const parentDoc = await db.documents.where('syncId').equals(sann.documentId).first();
            if (!parentDoc && sann.documentId) {
              console.warn(`Skipping annotation syncId ${sann.id}: parent Document ${sann.documentId} not found locally.`);
              continue;
            }
            const existing = await db.annotations.where('syncId').equals(sann.id).first();
            const annData = { ...sann, syncId: sann.id, createdAt: new Date(sann.createdAt) };
            delete annData.id;
            if (existing) {
              await db.annotations.update(existing.id!, annData);
            } else {
              await db.annotations.add(annData);
            }
          }
        }

        // 5. Reminders (Child of Note)
        if (serverData.reminders?.length) {
          for (const srem of serverData.reminders) {
            // FK Validation: Ensure parent Note exists
            const parentNote = await db.notes.where('syncId').equals(srem.noteId).first();
            if (!parentNote && srem.noteId) {
              console.warn(`Skipping reminder syncId ${srem.id}: parent Note ${srem.noteId} not found locally.`);
              continue;
            }
            const existing = await db.reminders.where('syncId').equals(srem.id).first();
            const remData = { ...srem, syncId: srem.id, dateTime: new Date(srem.dateTime) };
            delete remData.id;
            if (existing) {
              await db.reminders.update(existing.id!, remData);
            } else {
              await db.reminders.add(remData);
            }
          }
        }

        // 5b. Chat Messages (Child of Note)
        if (serverData.chatMessages?.length) {
          for (const scm of serverData.chatMessages) {
            // FK Validation: Ensure parent Note exists
            const parentNote = await db.notes.where('syncId').equals(scm.noteId).first();
            if (!parentNote && scm.noteId) {
              console.warn(`Skipping chat message syncId ${scm.id}: parent Note ${scm.noteId} not found locally.`);
              continue;
            }
            const existing = await db.chatMessages.where('syncId').equals(scm.id).first();
            const msgData = { ...scm, syncId: scm.id, createdAt: new Date(scm.createdAt) };
            delete msgData.id;
            if (existing) {
              await db.chatMessages.update(existing.id!, msgData);
            } else {
              await db.chatMessages.add(msgData);
            }
          }
        }

        // 6. Ledger Entries
        if (serverData.ledger?.length) {
          for (const sl of serverData.ledger) {
            const existing = await db.ledgerEntries.where('syncId').equals(sl.id).first();
            const ledgerData = { ...sl, syncId: sl.id, date: new Date(sl.date), updatedAt: new Date(sl.updatedAt), createdAt: new Date(sl.createdAt) };
            delete ledgerData.id;
            if (existing) {
              await db.ledgerEntries.update(existing.id!, ledgerData);
            } else {
              await db.ledgerEntries.add(ledgerData);
            }
          }
        }

        // 7. Udhaar
        if (serverData.udhaar?.length) {
          for (const su of serverData.udhaar) {
            const existing = await db.udhaar.where('syncId').equals(su.id).first();
            const udhaarData = { ...su, syncId: su.id, updatedAt: new Date(su.updatedAt), createdAt: new Date(su.createdAt) };
            delete udhaarData.id;
            if (existing) {
              await db.udhaar.update(existing.id!, udhaarData);
            } else {
              await db.udhaar.add(udhaarData);
            }
          }
        }

        // 8. Bills
        if (serverData.bills?.length) {
          for (const sb of serverData.bills) {
            const existing = await db.bills.where('syncId').equals(sb.id).first();
            const billData = { ...sb, syncId: sb.id, updatedAt: new Date(sb.updatedAt), createdAt: new Date(sb.createdAt) };
            delete billData.id;
            if (existing) {
              await db.bills.update(existing.id!, billData as any);
            } else {
              await db.bills.add(billData as any);
            }
          }
        }

        // 9. Khata Transactions (Child of KhataCustomer)
        if (serverData.khataTransactions?.length) {
          for (const skt of serverData.khataTransactions) {
            // FK Validation: Ensure parent KhataCustomer exists
            const parentCustomer = await db.khataCustomers.where('syncId').equals(skt.customerId).first();
            if (!parentCustomer && skt.customerId) {
              console.warn(`Skipping khataTransaction syncId ${skt.id}: parent KhataCustomer ${skt.customerId} not found locally.`);
              continue;
            }
            const existing = await db.khataTransactions.where('syncId').equals(skt.id).first();
            const ktData = { ...skt, syncId: skt.id, date: new Date(skt.date), updatedAt: new Date(skt.updatedAt), createdAt: new Date(skt.createdAt) };
            delete ktData.id;
            if (existing) {
              await db.khataTransactions.update(existing.id!, ktData);
            } else {
              await db.khataTransactions.add(ktData);
            }
          }
        }

        // 10. Products (Parent)
        if (serverData.products?.length) {
          for (const sp of serverData.products) {
            const existing = await db.products.where('syncId').equals(sp.id).first();
            const prodData = { ...sp, syncId: sp.id, updatedAt: new Date(sp.updatedAt), createdAt: new Date(sp.createdAt) };
            delete prodData.id;
            if (existing) {
              await db.products.update(existing.id!, prodData);
            } else {
              await db.products.add(prodData);
            }
          }
        }

        // 10b. Product Variants (Child of Product, Parent of variant-tagged StockMovements)
        if (serverData.productVariants?.length) {
          for (const sv of serverData.productVariants) {
            const parentProduct = await db.products.where('syncId').equals(sv.productId).first();
            if (!parentProduct && sv.productId) {
              console.warn(`Skipping productVariant syncId ${sv.id}: parent Product ${sv.productId} not found locally.`);
              continue;
            }
            const existing = await db.productVariants.where('syncId').equals(sv.id).first();
            const varData = { ...sv, syncId: sv.id, updatedAt: new Date(sv.updatedAt), createdAt: new Date(sv.createdAt) };
            delete varData.id;
            if (existing) {
              await db.productVariants.update(existing.id!, varData);
            } else {
              await db.productVariants.add(varData);
            }
          }
        }

        // 11. Stock Movements (Child of Product)
        if (serverData.stockMovements?.length) {
          for (const ssm of serverData.stockMovements) {
            const parentProduct = await db.products.where('syncId').equals(ssm.productId).first();
            if (!parentProduct && ssm.productId) {
              console.warn(`Skipping stockMovement syncId ${ssm.id}: parent Product ${ssm.productId} not found locally.`);
              continue;
            }
            const existing = await db.stockMovements.where('syncId').equals(ssm.id).first();
            const smData = { ...ssm, syncId: ssm.id, updatedAt: new Date(ssm.updatedAt), createdAt: new Date(ssm.createdAt) };
            delete smData.id;
            if (existing) {
              await db.stockMovements.update(existing.id!, smData);
            } else {
              await db.stockMovements.add(smData);
            }
          }
        }

        // 12. Feature Usage
        if (serverData.featureUsage?.length) {
          await db.featureUsage.clear();
          for (const sfu of serverData.featureUsage) {
            const fuData = { ...sfu };
            delete fuData.id; // let Dexie auto-increment ID
            await db.featureUsage.add(fuData);
          }
        }
      });

      // 6. Update sync status
      await db.syncStatus.add({ lastSyncAt: syncStartTime });
      console.log("Sync completed successfully!");

    } catch (error) {
      console.error('Sync Error:', error);
    }
  }

  static async uploadFile(noteId: number, fileBlob: Blob, type: 'audio' | 'document') {
    const { user, token } = useAuthStore.getState();
    const formData = new FormData();
    formData.append('file', fileBlob);
    formData.append('noteId', noteId.toString());
    formData.append('type', type);
    if (user) formData.append('userId', user.id?.toString() || '');

    try {
      const res = await fetch(`/api/sync/upload`, {
        method: 'POST',
        headers: token ? {
          'Authorization': `Bearer ${token}`
        } : undefined,
        body: formData
      });
      const data = await res.json();
      
      // Update local db with path
      if (res.ok && data.path) {
        if (type === 'audio') {
          await db.notes.update(noteId, { voicePath: data.path });
        } else {
          await db.notes.update(noteId, { filePath: data.path });
        }
      }
    } catch (e) {
      console.error('File upload failed', e);
    }
  }
}
