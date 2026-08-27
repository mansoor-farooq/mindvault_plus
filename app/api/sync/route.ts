import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db.server';
import { gatingService } from '../../../lib/services/gatingService';
import { requireAuth } from '../../../lib/auth/jwtAuth';
import { getUserFeatureAccess } from '../../../lib/services/featureAccessService';

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapToCamel(rows: any[]) {
  return rows.map((row) => {
    const newRow: any = {};
    for (const key in row) {
      const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
      newRow[camelKey] = row[key];
    }
    if (newRow.payments && typeof newRow.payments === 'string') {
      try {
        newRow.payments = JSON.parse(newRow.payments);
      } catch {}
    }
    return newRow;
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  console.log('Received sync request:', body);
  const { lastSyncAt, changes } = body;
  const userId = auth.user.id;

  if (!changes) {
    return NextResponse.json({ error: 'Missing changes payload' }, { status: 400 });
  }

  try {
    // Get user from DB
    const result = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const dbUser = result.rows[0];

    if (dbUser.account_status === 'BANNED' || dbUser.account_status === 'SUSPENDED') {
      return NextResponse.json({ error: `Account is ${dbUser.account_status}. Please contact support.` }, { status: 403 });
    }

    // Fetched once and reused for every gated entity block below - if admin has disabled
    // a feature for this user, that entity's incoming changes are silently skipped (not
    // an error - the rest of the sync still proceeds normally) rather than rejecting the
    // whole request, since other unrelated entities in the same payload should still sync.
    const featureAccess = await getUserFeatureAccess(userId);

    // Upsert Notes
    if (changes.notes && changes.notes.length > 0) {
      for (const note of changes.notes) {
        await db.query(
          `
          INSERT INTO notes (frontend_id, user_id, title, description, type, category, tags, is_favorite, is_deleted, deleted_at, created_at, updated_at, summary)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (frontend_id) DO UPDATE SET
            title = EXCLUDED.title,
            description = EXCLUDED.description,
            is_favorite = EXCLUDED.is_favorite,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at,
            updated_at = EXCLUDED.updated_at,
            summary = EXCLUDED.summary
          WHERE notes.user_id = EXCLUDED.user_id
        `,
          [
            note.id, userId, note.title, note.description, note.type, note.category,
            note.tags || [], note.isFavorite, note.isDeleted, note.deletedAt || null,
            note.createdAt || new Date(), note.updatedAt || new Date(), note.summary || null,
          ]
        );
      }
    }

    // Upsert Ledger
    if (changes.ledger && changes.ledger.length > 0) {
      for (const entry of changes.ledger) {
        await db.query(
          `
          INSERT INTO ledger_entries (frontend_id, user_id, type, amount, category, note, date, is_recurring, created_at, updated_at, is_deleted, deleted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (frontend_id) DO UPDATE SET
            amount = EXCLUDED.amount,
            category = EXCLUDED.category,
            note = EXCLUDED.note,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at
          WHERE ledger_entries.user_id = EXCLUDED.user_id
        `,
          [
            entry.id, userId, entry.type, entry.amount, entry.category, entry.note,
            entry.date, entry.isRecurring, entry.createdAt || new Date(), entry.updatedAt || new Date(),
            entry.isDeleted || false, entry.deletedAt || null,
          ]
        );
      }
    }

    // Upsert Udhaar
    if (changes.udhaar && changes.udhaar.length > 0) {
      for (const udhaar of changes.udhaar) {
        await db.query(
          `
          INSERT INTO udhaar (frontend_id, user_id, person_name, amount, type, due_date, is_settled, payments, note, created_at, updated_at, is_deleted, deleted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (frontend_id) DO UPDATE SET
            is_settled = EXCLUDED.is_settled,
            payments = EXCLUDED.payments,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at
          WHERE udhaar.user_id = EXCLUDED.user_id
        `,
          [
            udhaar.id, userId, udhaar.personName, udhaar.amount, udhaar.type,
            udhaar.dueDate || null, udhaar.isSettled, JSON.stringify(udhaar.payments || []),
            udhaar.note, udhaar.createdAt || new Date(), udhaar.updatedAt || new Date(),
            udhaar.isDeleted || false, udhaar.deletedAt || null,
          ]
        );
      }
    }

    // Upsert Bills
    if (changes.bills && changes.bills.length > 0) {
      for (const bill of changes.bills) {
        await db.query(
          `
          INSERT INTO bills (id, user_id, title, amount, due_date, is_paid, category, note, created_at, updated_at, is_deleted, deleted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            amount = EXCLUDED.amount,
            due_date = EXCLUDED.due_date,
            is_paid = EXCLUDED.is_paid,
            category = EXCLUDED.category,
            note = EXCLUDED.note,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at
          WHERE bills.user_id = EXCLUDED.user_id
        `,
          [
            bill.id, userId, bill.title, bill.amount, bill.dueDate, bill.isPaid,
            bill.category, bill.note, bill.createdAt || new Date(), bill.updatedAt || new Date(),
            bill.isDeleted, bill.deletedAt || null,
          ]
        );
      }
    }

    // Upsert Locations (Parent - must sync before products/stockMovements/khataCustomers reference them)
    if (changes.locations && changes.locations.length > 0 && featureAccess.locations !== false) {
      for (const loc of changes.locations) {
        await db.query(
          `
          INSERT INTO locations (frontend_id, user_id, name, location_type, address, city, is_active, is_default, created_at, updated_at, is_deleted, deleted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (frontend_id) DO UPDATE SET
            name = EXCLUDED.name,
            location_type = EXCLUDED.location_type,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            is_active = EXCLUDED.is_active,
            is_default = EXCLUDED.is_default,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at
          WHERE locations.user_id = EXCLUDED.user_id
        `,
          [
            loc.id, userId, loc.name, loc.locationType || 'BRANCH', loc.address || null, loc.city || null,
            loc.isActive ?? true, loc.isDefault || false,
            loc.createdAt || new Date(), loc.updatedAt || new Date(), loc.isDeleted || false, loc.deletedAt || null,
          ]
        );
      }
    }

    // Upsert Categories (Parent - self-referencing tree, must sync before products reference them)
    if (changes.categories && changes.categories.length > 0 && featureAccess.categories !== false) {
      for (const cat of changes.categories) {
        if (cat.parentId) {
          const ownsParent = await db.query('SELECT 1 FROM categories WHERE frontend_id = $1 AND user_id = $2', [cat.parentId, userId]);
          if (ownsParent.rows.length === 0) {
            console.warn(`[Sync Warning] Parent category ${cat.parentId} not owned by user ${userId}, stripping from category ${cat.id}`);
            cat.parentId = null;
          }
        }
        await db.query(
          `
          INSERT INTO categories (frontend_id, user_id, name, parent_id, icon, is_active, created_at, updated_at, is_deleted, deleted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (frontend_id) DO UPDATE SET
            name = EXCLUDED.name,
            parent_id = EXCLUDED.parent_id,
            icon = EXCLUDED.icon,
            is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at
          WHERE categories.user_id = EXCLUDED.user_id
        `,
          [
            cat.id, userId, cat.name, cat.parentId || null, cat.icon || null,
            cat.isActive ?? true, cat.createdAt || new Date(), cat.updatedAt || new Date(),
            cat.isDeleted || false, cat.deletedAt || null,
          ]
        );
      }
    }

    // Upsert Khata Customers
    if (changes.khataCustomers && changes.khataCustomers.length > 0 && featureAccess.khata !== false) {
      for (const customer of changes.khataCustomers) {
        const existsRes = await db.query('SELECT frontend_id FROM khata_customers WHERE frontend_id = $1', [customer.id]);
        if (existsRes.rows.length === 0) {
          const limitCheck = await gatingService.checkLimit(userId, dbUser.license_type, 'khata_customers', dbUser.license_expiry);
          if (!limitCheck.allowed) {
            return NextResponse.json({ error: 'LIMIT_REACHED', feature: 'khata_customers' }, { status: 403 });
          }
        }
        if (customer.locationId) {
          const ownsLocation = await db.query('SELECT 1 FROM locations WHERE frontend_id = $1 AND user_id = $2', [customer.locationId, userId]);
          if (ownsLocation.rows.length === 0) {
            console.warn(`[Sync Warning] Location ${customer.locationId} not owned by user ${userId}, stripping from khata customer ${customer.id}`);
            customer.locationId = null;
          }
        }
        await db.query(
          `
          INSERT INTO khata_customers (frontend_id, user_id, name, phone, address, opening_balance, created_at, updated_at, is_deleted, deleted_at, customer_type, location_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (frontend_id) DO UPDATE SET
            name = EXCLUDED.name,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            opening_balance = EXCLUDED.opening_balance,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at,
            customer_type = EXCLUDED.customer_type,
            location_id = EXCLUDED.location_id
          WHERE khata_customers.user_id = EXCLUDED.user_id
        `,
          [
            customer.id, userId, customer.name, customer.phone, customer.address,
            customer.openingBalance || 0,
            customer.createdAt || new Date(), customer.updatedAt || new Date(),
            customer.isDeleted || false, customer.deletedAt || null,
            customer.customerType || 'PERSON', customer.locationId || null,
          ]
        );
      }
    }

    // Upsert Khata Transactions
    if (changes.khataTransactions && changes.khataTransactions.length > 0 && featureAccess.khata !== false) {
      for (const txn of changes.khataTransactions) {
        const ownsCustomer = await db.query('SELECT 1 FROM khata_customers WHERE frontend_id = $1 AND user_id = $2', [txn.customerId, userId]);
        if (ownsCustomer.rows.length === 0) {
          console.warn(`[Sync Warning] Customer ${txn.customerId} not owned by user ${userId}, skipping transaction ${txn.id}`);
          continue;
        }
        await db.query(
          `
          INSERT INTO khata_transactions (frontend_id, user_id, customer_id, type, amount, note, date, created_at, updated_at, is_deleted, deleted_at, product_id, quantity)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (frontend_id) DO UPDATE SET
            customer_id = EXCLUDED.customer_id,
            type = EXCLUDED.type,
            amount = EXCLUDED.amount,
            note = EXCLUDED.note,
            date = EXCLUDED.date,
            updated_at = EXCLUDED.updated_at,
            is_deleted = EXCLUDED.is_deleted,
            deleted_at = EXCLUDED.deleted_at,
            product_id = EXCLUDED.product_id,
            quantity = EXCLUDED.quantity
          WHERE khata_transactions.user_id = EXCLUDED.user_id
        `,
          [
            txn.id, userId, txn.customerId, txn.type, txn.amount, txn.note, txn.date,
            txn.createdAt || new Date(), txn.updatedAt || new Date(),
            txn.isDeleted || false, txn.deletedAt || null,
            txn.productId || null, txn.quantity || null,
          ]
        );
      }
    }

    // Upsert Products
    if (changes.products && changes.products.length > 0 && featureAccess.inventory !== false) {
      for (const product of changes.products) {
        const existsRes = await db.query('SELECT frontend_id FROM products WHERE frontend_id = $1', [product.id]);
        if (existsRes.rows.length === 0) {
          const limitCheck = await gatingService.checkLimit(userId, dbUser.license_type, 'products', dbUser.license_expiry);
          if (!limitCheck.allowed) {
            return NextResponse.json({ error: 'LIMIT_REACHED', feature: 'products' }, { status: 403 });
          }
        }
        if (product.locationId) {
          const ownsLocation = await db.query('SELECT 1 FROM locations WHERE frontend_id = $1 AND user_id = $2', [product.locationId, userId]);
          if (ownsLocation.rows.length === 0) {
            console.warn(`[Sync Warning] Location ${product.locationId} not owned by user ${userId}, stripping from product ${product.id}`);
            product.locationId = null;
          }
        }
        if (product.categoryId) {
          const ownsCategory = await db.query('SELECT 1 FROM categories WHERE frontend_id = $1 AND user_id = $2', [product.categoryId, userId]);
          if (ownsCategory.rows.length === 0) {
            console.warn(`[Sync Warning] Category ${product.categoryId} not owned by user ${userId}, stripping from product ${product.id}`);
            product.categoryId = null;
          }
        }
        await db.query(
          `
          INSERT INTO products (frontend_id, user_id, sku, name, description, category, brand, cost_price, selling_price, currency, unit, low_stock_threshold, reorder_point, barcode, image_urls, supplier_name, supplier_contact, warehouse_location, expiry_date, weight, tags, tax_rate, discount_percent, is_active, created_at, updated_at, is_deleted, deleted_at, location_id, category_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
          ON CONFLICT (frontend_id) DO UPDATE SET
            sku = EXCLUDED.sku, name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
            brand = EXCLUDED.brand, cost_price = EXCLUDED.cost_price, selling_price = EXCLUDED.selling_price,
            currency = EXCLUDED.currency, unit = EXCLUDED.unit, low_stock_threshold = EXCLUDED.low_stock_threshold,
            reorder_point = EXCLUDED.reorder_point, barcode = EXCLUDED.barcode, image_urls = EXCLUDED.image_urls,
            supplier_name = EXCLUDED.supplier_name, supplier_contact = EXCLUDED.supplier_contact,
            warehouse_location = EXCLUDED.warehouse_location, expiry_date = EXCLUDED.expiry_date, weight = EXCLUDED.weight,
            tags = EXCLUDED.tags, tax_rate = EXCLUDED.tax_rate, discount_percent = EXCLUDED.discount_percent,
            is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at,
            location_id = EXCLUDED.location_id, category_id = EXCLUDED.category_id
          WHERE products.user_id = EXCLUDED.user_id
        `,
          [
            product.id, userId, product.sku, product.name, product.description, product.category, product.brand,
            product.costPrice, product.sellingPrice, product.currency || 'USD', product.unit, product.lowStockThreshold || 0,
            product.reorderPoint || 0, product.barcode, JSON.stringify(product.imageUrls || []), product.supplierName,
            product.supplierContact, product.warehouseLocation, product.expiryDate || null, product.weight,
            JSON.stringify(product.tags || []), product.taxRate, product.discountPercent, product.isActive ?? true,
            product.createdAt || new Date(), product.updatedAt || new Date(), product.isDeleted || false, product.deletedAt || null,
            product.locationId || null, product.categoryId || null,
          ]
        );
      }
    }

    // Upsert Product Variants (mandatory FK to Product - must sync after Products, before
    // StockMovements, since a movement may reference a variant created in this same request)
    if (changes.productVariants && changes.productVariants.length > 0 && featureAccess.inventory !== false) {
      for (const variant of changes.productVariants) {
        const ownsProduct = await db.query('SELECT 1 FROM products WHERE frontend_id = $1 AND user_id = $2', [variant.productId, userId]);
        if (ownsProduct.rows.length === 0) {
          console.warn(`[Sync Warning] Product ${variant.productId} not owned by user ${userId}, skipping variant ${variant.id}`);
          continue;
        }
        await db.query(
          `
          INSERT INTO product_variants (frontend_id, user_id, product_id, name, sku, price_override, is_active, created_at, updated_at, is_deleted, deleted_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          ON CONFLICT (frontend_id) DO UPDATE SET
            product_id = EXCLUDED.product_id, name = EXCLUDED.name, sku = EXCLUDED.sku,
            price_override = EXCLUDED.price_override, is_active = EXCLUDED.is_active,
            updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
          WHERE product_variants.user_id = EXCLUDED.user_id
        `,
          [
            variant.id, userId, variant.productId, variant.name, variant.sku || null,
            variant.priceOverride ?? null, variant.isActive ?? true,
            variant.createdAt || new Date(), variant.updatedAt || new Date(),
            variant.isDeleted || false, variant.deletedAt || null,
          ]
        );
      }
    }

    // Upsert Stock Movements
    if (changes.stockMovements && changes.stockMovements.length > 0 && featureAccess.inventory !== false) {
      for (const movement of changes.stockMovements) {
        const ownsProduct = await db.query('SELECT 1 FROM products WHERE frontend_id = $1 AND user_id = $2', [movement.productId, userId]);
        if (ownsProduct.rows.length === 0) {
          console.warn(`[Sync Warning] Product ${movement.productId} not owned by user ${userId}, skipping stock movement ${movement.id}`);
          continue;
        }
        if (movement.locationId) {
          const ownsLocation = await db.query('SELECT 1 FROM locations WHERE frontend_id = $1 AND user_id = $2', [movement.locationId, userId]);
          if (ownsLocation.rows.length === 0) {
            console.warn(`[Sync Warning] Location ${movement.locationId} not owned by user ${userId}, stripping from stock movement ${movement.id}`);
            movement.locationId = null;
          }
        }
        if (movement.variantId) {
          const ownsVariant = await db.query('SELECT 1 FROM product_variants WHERE frontend_id = $1 AND user_id = $2', [movement.variantId, userId]);
          if (ownsVariant.rows.length === 0) {
            console.warn(`[Sync Warning] Variant ${movement.variantId} not owned by user ${userId}, stripping from stock movement ${movement.id}`);
            movement.variantId = null;
          }
        }
        await db.query(
          `
          INSERT INTO stock_movements (frontend_id, user_id, product_id, type, quantity, reason, created_at, updated_at, is_deleted, deleted_at, location_id, delivery_cost, delivery_note, variant_id)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          ON CONFLICT (frontend_id) DO UPDATE SET
            product_id = EXCLUDED.product_id, type = EXCLUDED.type, quantity = EXCLUDED.quantity, reason = EXCLUDED.reason,
            updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at,
            location_id = EXCLUDED.location_id, delivery_cost = EXCLUDED.delivery_cost, delivery_note = EXCLUDED.delivery_note,
            variant_id = EXCLUDED.variant_id
          WHERE stock_movements.user_id = EXCLUDED.user_id
        `,
          [
            movement.id, userId, movement.productId, movement.type, movement.quantity, movement.reason,
            movement.createdAt || new Date(), movement.updatedAt || new Date(), movement.isDeleted || false, movement.deletedAt || null,
            movement.locationId || null, movement.deliveryCost || null, movement.deliveryNote || null, movement.variantId || null,
          ]
        );
      }
    }

    // Upsert Documents
    if (changes.documents && changes.documents.length > 0) {
      for (const doc of changes.documents) {
        const parentNoteRes = await db.query('SELECT id FROM notes WHERE frontend_id = $1 AND user_id = $2', [doc.noteId, userId]);
        if (parentNoteRes.rows.length === 0) {
          console.warn(`[Sync Warning] Parent Note ${doc.noteId} not found or not owned by user ${userId}, skipping document ${doc.id}`);
          continue;
        }
        const noteId = parentNoteRes.rows[0].id;

        await db.query(
          `
          INSERT INTO documents (frontend_id, note_id, file_name, file_path, folder, total_pages, last_page_read, read_status, cover_thumbnail)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          ON CONFLICT (frontend_id) DO UPDATE SET
            note_id = EXCLUDED.note_id,
            file_name = EXCLUDED.file_name,
            file_path = EXCLUDED.file_path,
            folder = EXCLUDED.folder,
            total_pages = EXCLUDED.total_pages,
            last_page_read = EXCLUDED.last_page_read,
            read_status = EXCLUDED.read_status,
            cover_thumbnail = EXCLUDED.cover_thumbnail
          WHERE documents.note_id IN (SELECT id FROM notes WHERE user_id = $10)
        `,
          [
            doc.id, noteId, doc.fileName, doc.filePath, doc.folder || 'Root',
            doc.totalPages || 0, doc.lastPageRead || 0, doc.readStatus || 'UNREAD', doc.coverThumbnail || null, userId,
          ]
        );
      }
    }

    // Upsert Annotations
    if (changes.annotations && changes.annotations.length > 0) {
      for (const ann of changes.annotations) {
        const parentDocRes = await db.query(
          `SELECT d.id FROM documents d JOIN notes n ON d.note_id = n.id WHERE d.frontend_id = $1 AND n.user_id = $2`,
          [ann.documentId, userId]
        );
        if (parentDocRes.rows.length === 0) {
          console.warn(`[Sync Warning] Parent Document ${ann.documentId} not found or not owned by user ${userId}, skipping annotation ${ann.id}`);
          continue;
        }
        const docId = parentDocRes.rows[0].id;

        await db.query(
          `
          INSERT INTO annotations (frontend_id, document_id, page_number, highlight_color, note_text, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (frontend_id) DO UPDATE SET
            document_id = EXCLUDED.document_id,
            page_number = EXCLUDED.page_number,
            highlight_color = EXCLUDED.highlight_color,
            note_text = EXCLUDED.note_text
          WHERE annotations.document_id IN (
            SELECT d.id FROM documents d JOIN notes n ON d.note_id = n.id WHERE n.user_id = $7
          )
        `,
          [ann.id, docId, ann.pageNumber, ann.highlightColor, ann.noteText || null, ann.createdAt || new Date(), userId]
        );
      }
    }

    // Upsert Reminders
    if (changes.reminders && changes.reminders.length > 0) {
      for (const rem of changes.reminders) {
        const parentNoteRes = await db.query('SELECT id FROM notes WHERE frontend_id = $1 AND user_id = $2', [rem.noteId, userId]);
        if (parentNoteRes.rows.length === 0) {
          console.warn(`[Sync Warning] Parent Note ${rem.noteId} not found or not owned by user ${userId}, skipping reminder ${rem.id}`);
          continue;
        }
        const noteId = parentNoteRes.rows[0].id;

        await db.query(
          `
          INSERT INTO reminders (frontend_id, note_id, reminder_type, date_time, is_completed)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (frontend_id) DO UPDATE SET
            note_id = EXCLUDED.note_id,
            reminder_type = EXCLUDED.reminder_type,
            date_time = EXCLUDED.date_time,
            is_completed = EXCLUDED.is_completed
          WHERE reminders.note_id IN (SELECT id FROM notes WHERE user_id = $6)
        `,
          [rem.id, noteId, rem.reminderType, rem.dateTime, rem.isCompleted || false, userId]
        );
      }
    }

    // Upsert Chat Messages (mandatory FK to Note - must sync after Notes; a message
    // can't exist without its parent note)
    if (changes.chatMessages && changes.chatMessages.length > 0) {
      for (const msg of changes.chatMessages) {
        const ownsNote = await db.query('SELECT 1 FROM notes WHERE frontend_id = $1 AND user_id = $2', [msg.noteId, userId]);
        if (ownsNote.rows.length === 0) {
          console.warn(`[Sync Warning] Note ${msg.noteId} not owned by user ${userId}, skipping chat message ${msg.id}`);
          continue;
        }
        await db.query(
          `
          INSERT INTO note_chat_messages (frontend_id, user_id, note_id, role, content, created_at)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (frontend_id) DO UPDATE SET
            note_id = EXCLUDED.note_id, role = EXCLUDED.role, content = EXCLUDED.content, created_at = EXCLUDED.created_at
          WHERE note_chat_messages.user_id = EXCLUDED.user_id
        `,
          [msg.id, userId, msg.noteId, msg.role, msg.content, msg.createdAt || new Date()]
        );
      }
    }

    // Fetch changes from server that are newer than lastSyncAt
    let notesResult, docResult, annResult, remResult, chatMessagesResult, ledgerResult, udhaarResult, billsResult, khataCustResult, khataTxnResult, productsResult, productVariantsResult, stockMovementsResult, featureUsageResult, locationsResult, categoriesResult;
    if (lastSyncAt) {
      const syncDate = new Date(lastSyncAt);
      locationsResult = await db.query('SELECT *, frontend_id as id FROM locations WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      categoriesResult = await db.query('SELECT *, frontend_id as id FROM categories WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      notesResult = await db.query('SELECT *, frontend_id as id FROM notes WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      docResult = await db.query('SELECT d.frontend_id as id, n.frontend_id as note_id, d.file_name, d.file_path, d.folder, d.total_pages, d.last_page_read, d.read_status, d.bookmarks, d.time_spent_minutes, d.cover_thumbnail FROM documents d JOIN notes n ON d.note_id = n.id WHERE n.user_id = $1', [userId]);
      annResult = await db.query('SELECT a.frontend_id as id, d.frontend_id as document_id, a.page_number, a.highlight_color, a.note_text, a.created_at FROM annotations a JOIN documents d ON a.document_id = d.id JOIN notes n ON d.note_id = n.id WHERE n.user_id = $1', [userId]);
      remResult = await db.query('SELECT r.frontend_id as id, n.frontend_id as note_id, r.reminder_type, r.date_time, r.is_completed, r.created_at FROM reminders r JOIN notes n ON r.note_id = n.id WHERE n.user_id = $1', [userId]);
      chatMessagesResult = await db.query('SELECT *, frontend_id as id FROM note_chat_messages WHERE user_id = $1 AND created_at > $2', [userId, syncDate]);
      ledgerResult = await db.query('SELECT *, frontend_id as id FROM ledger_entries WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      udhaarResult = await db.query('SELECT *, frontend_id as id FROM udhaar WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      billsResult = await db.query('SELECT * FROM bills WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      khataCustResult = await db.query('SELECT *, frontend_id as id FROM khata_customers WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      khataTxnResult = await db.query('SELECT *, frontend_id as id FROM khata_transactions WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      productsResult = await db.query('SELECT *, frontend_id as id FROM products WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      productVariantsResult = await db.query('SELECT *, frontend_id as id FROM product_variants WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      stockMovementsResult = await db.query('SELECT *, frontend_id as id FROM stock_movements WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
    } else {
      locationsResult = await db.query('SELECT *, frontend_id as id FROM locations WHERE user_id = $1', [userId]);
      categoriesResult = await db.query('SELECT *, frontend_id as id FROM categories WHERE user_id = $1', [userId]);
      notesResult = await db.query('SELECT *, frontend_id as id FROM notes WHERE user_id = $1', [userId]);
      docResult = await db.query('SELECT d.frontend_id as id, n.frontend_id as note_id, d.file_name, d.file_path, d.folder, d.total_pages, d.last_page_read, d.read_status, d.bookmarks, d.time_spent_minutes, d.cover_thumbnail FROM documents d JOIN notes n ON d.note_id = n.id WHERE n.user_id = $1', [userId]);
      annResult = await db.query('SELECT a.frontend_id as id, d.frontend_id as document_id, a.page_number, a.highlight_color, a.note_text, a.created_at FROM annotations a JOIN documents d ON a.document_id = d.id JOIN notes n ON d.note_id = n.id WHERE n.user_id = $1', [userId]);
      remResult = await db.query('SELECT r.frontend_id as id, n.frontend_id as note_id, r.reminder_type, r.date_time, r.is_completed, r.created_at FROM reminders r JOIN notes n ON r.note_id = n.id WHERE n.user_id = $1', [userId]);
      chatMessagesResult = await db.query('SELECT *, frontend_id as id FROM note_chat_messages WHERE user_id = $1', [userId]);
      ledgerResult = await db.query('SELECT *, frontend_id as id FROM ledger_entries WHERE user_id = $1', [userId]);
      udhaarResult = await db.query('SELECT *, frontend_id as id FROM udhaar WHERE user_id = $1', [userId]);
      billsResult = await db.query('SELECT * FROM bills WHERE user_id = $1', [userId]);
      khataCustResult = await db.query('SELECT *, frontend_id as id FROM khata_customers WHERE user_id = $1', [userId]);
      khataTxnResult = await db.query('SELECT *, frontend_id as id FROM khata_transactions WHERE user_id = $1', [userId]);
      productsResult = await db.query('SELECT *, frontend_id as id FROM products WHERE user_id = $1', [userId]);
      productVariantsResult = await db.query('SELECT *, frontend_id as id FROM product_variants WHERE user_id = $1', [userId]);
      stockMovementsResult = await db.query('SELECT *, frontend_id as id FROM stock_movements WHERE user_id = $1', [userId]);
    }
    featureUsageResult = await db.query('SELECT * FROM feature_usage WHERE user_id = $1', [userId]);

    const serverChanges = {
      locations: locationsResult ? mapToCamel(locationsResult.rows) : [],
      categories: categoriesResult ? mapToCamel(categoriesResult.rows) : [],
      notes: mapToCamel(notesResult.rows),
      documents: docResult ? mapToCamel(docResult.rows) : [],
      annotations: annResult ? mapToCamel(annResult.rows) : [],
      chatMessages: chatMessagesResult ? mapToCamel(chatMessagesResult.rows) : [],
      reminders: remResult ? mapToCamel(remResult.rows) : [],
      ledger: mapToCamel(ledgerResult.rows),
      udhaar: mapToCamel(udhaarResult.rows),
      bills: mapToCamel(billsResult.rows),
      khataCustomers: mapToCamel(khataCustResult.rows),
      khataTransactions: mapToCamel(khataTxnResult.rows),
      products: productsResult ? mapToCamel(productsResult.rows) : [],
      productVariants: productVariantsResult ? mapToCamel(productVariantsResult.rows) : [],
      stockMovements: stockMovementsResult ? mapToCamel(stockMovementsResult.rows) : [],
      featureUsage: featureUsageResult ? mapToCamel(featureUsageResult.rows) : [],
      user: {
        status: dbUser.account_status,
        license: dbUser.license_type,
      },
    };

    return NextResponse.json(serverChanges);
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Server error during sync' }, { status: 500 });
  }
}
