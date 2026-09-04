import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../lib/db.server';
import { gatingService } from '../../../lib/services/gatingService';
import { requireAuth } from '../../../lib/auth/jwtAuth';
import { getUserFeatureAccess } from '../../../lib/services/featureAccessService';
import { resolveUserPermissions } from '../../../lib/services/permissionService';

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
  const userId = auth.user.id as number;
  const actualUserId = (auth.user.actualUserId as number) || userId;

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

    // Resolve caller's Layer 1 x Layer 2 permission matrix
    const callerPerms = await resolveUserPermissions(actualUserId, userId);
    const perms = callerPerms.permissions;
    const rejectedChanges: { entity: string; syncId: string; reason: string; message: string }[] = [];

    const featureAccess = await getUserFeatureAccess(userId);

    // Upsert Notes
    if (changes.notes && changes.notes.length > 0) {
      if (perms.notes_ai !== 'full') {
        for (const note of changes.notes) {
          rejectedChanges.push({ entity: 'notes', syncId: note.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Notes manage karne ka ikhtiyar nahi hai.' });
        }
      } else {
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
    }

    // Upsert Ledger
    if (changes.ledger && changes.ledger.length > 0) {
      if (perms.roznamcha !== 'full') {
        for (const entry of changes.ledger) {
          rejectedChanges.push({ entity: 'ledger', syncId: entry.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Roznamcha ledger edit karne ka ikhtiyar nahi hai.' });
        }
      } else {
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
    }

    // Upsert Udhaar
    if (changes.udhaar && changes.udhaar.length > 0) {
      if (perms.khata !== 'full') {
        for (const udhaar of changes.udhaar) {
          rejectedChanges.push({ entity: 'udhaar', syncId: udhaar.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Khata manage karne ka ikhtiyar nahi hai.' });
        }
      } else {
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
    }

    // Upsert Bills
    if (changes.bills && changes.bills.length > 0) {
      if (perms.roznamcha !== 'full') {
        for (const bill of changes.bills) {
          rejectedChanges.push({ entity: 'bills', syncId: bill.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Bills edit karne ka ikhtiyar nahi hai.' });
        }
      } else {
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
    }

    // Upsert Locations (Parent - must sync before products/stockMovements/khataCustomers reference them)
    if (changes.locations && changes.locations.length > 0 && featureAccess.locations !== false) {
      if (perms.inventory !== 'full') {
        for (const loc of changes.locations) {
          rejectedChanges.push({ entity: 'locations', syncId: loc.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Locations manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Categories (Parent - self-referencing tree, must sync before products reference them)
    if (changes.categories && changes.categories.length > 0 && featureAccess.categories !== false) {
      if (perms.inventory !== 'full') {
        for (const cat of changes.categories) {
          rejectedChanges.push({ entity: 'categories', syncId: cat.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Categories manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Khata Customers
    if (changes.khataCustomers && changes.khataCustomers.length > 0 && featureAccess.khata !== false) {
      if (perms.khata !== 'full') {
        for (const customer of changes.khataCustomers) {
          rejectedChanges.push({ entity: 'khataCustomers', syncId: customer.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Khata Customers manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Khata Transactions
    if (changes.khataTransactions && changes.khataTransactions.length > 0 && featureAccess.khata !== false) {
      if (perms.khata !== 'full') {
        for (const txn of changes.khataTransactions) {
          rejectedChanges.push({ entity: 'khataTransactions', syncId: txn.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Khata entries darj karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Products
    if (changes.products && changes.products.length > 0 && featureAccess.inventory !== false) {
      if (perms.inventory !== 'full') {
        for (const product of changes.products) {
          rejectedChanges.push({ entity: 'products', syncId: product.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Products manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Product Variants (mandatory FK to Product - must sync after Products, before
    // StockMovements, since a movement may reference a variant created in this same request)
    if (changes.productVariants && changes.productVariants.length > 0 && featureAccess.inventory !== false) {
      if (perms.inventory !== 'full') {
        for (const variant of changes.productVariants) {
          rejectedChanges.push({ entity: 'productVariants', syncId: variant.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Products manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Stock Movements
    if (changes.stockMovements && changes.stockMovements.length > 0 && featureAccess.inventory !== false) {
      if (perms.inventory !== 'full') {
        for (const movement of changes.stockMovements) {
          rejectedChanges.push({ entity: 'stockMovements', syncId: movement.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Stock Movements darj karne ka access nahi hai.' });
        }
      } else {
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
            INSERT INTO stock_movements (
              frontend_id, user_id, product_id, type, quantity, reason,
              created_at, updated_at, is_deleted, deleted_at, location_id,
              delivery_cost, delivery_note, variant_id, lot_number, serial_number, work_order_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            ON CONFLICT (frontend_id) DO UPDATE SET
              product_id = EXCLUDED.product_id, type = EXCLUDED.type, quantity = EXCLUDED.quantity, reason = EXCLUDED.reason,
              updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at,
              location_id = EXCLUDED.location_id, delivery_cost = EXCLUDED.delivery_cost, delivery_note = EXCLUDED.delivery_note,
              variant_id = EXCLUDED.variant_id, lot_number = EXCLUDED.lot_number, serial_number = EXCLUDED.serial_number,
              work_order_id = EXCLUDED.work_order_id
            WHERE stock_movements.user_id = EXCLUDED.user_id
          `,
            [
              movement.id, userId, movement.productId, movement.type, movement.quantity, movement.reason,
              movement.createdAt || new Date(), movement.updatedAt || new Date(), movement.isDeleted || false, movement.deletedAt || null,
              movement.locationId || null, movement.deliveryCost || null, movement.deliveryNote || null, movement.variantId || null,
              movement.lotNumber || null, movement.serialNumber || null, movement.workOrderId || null
            ]
          );
        }
      }
    }

    // Upsert Documents
    if (changes.documents && changes.documents.length > 0) {
      if (perms.notes_ai !== 'full') {
        for (const doc of changes.documents) {
          rejectedChanges.push({ entity: 'documents', syncId: doc.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Documents manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Annotations
    if (changes.annotations && changes.annotations.length > 0) {
      if (perms.notes_ai !== 'full') {
        for (const ann of changes.annotations) {
          rejectedChanges.push({ entity: 'annotations', syncId: ann.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Annotations edit karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Reminders
    if (changes.reminders && changes.reminders.length > 0) {
      if (perms.tools !== 'full' && perms.notes_ai !== 'full') {
        for (const rem of changes.reminders) {
          rejectedChanges.push({ entity: 'reminders', syncId: rem.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Reminders manage karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Chat Messages (mandatory FK to Note - must sync after Notes; a message
    // can't exist without its parent note)
    if (changes.chatMessages && changes.chatMessages.length > 0) {
      if (perms.notes_ai !== 'full') {
        for (const msg of changes.chatMessages) {
          rejectedChanges.push({ entity: 'chatMessages', syncId: msg.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Chat Messages edit karne ka access nahi hai.' });
        }
      } else {
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
    }

    // Upsert Service Types
    if (changes.serviceTypes && changes.serviceTypes.length > 0) {
      if (perms.service_tracker !== 'full') {
        for (const st of changes.serviceTypes) {
          rejectedChanges.push({ entity: 'serviceTypes', syncId: st.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Service Types manage karne ka access nahi hai.' });
        }
      } else {
        for (const st of changes.serviceTypes) {
          await db.query(
            `
            INSERT INTO service_types (frontend_id, user_id, company_code, name, unit, default_rate, created_at, updated_at, is_deleted, deleted_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (frontend_id) DO UPDATE SET
              name = EXCLUDED.name,
              unit = EXCLUDED.unit,
              default_rate = EXCLUDED.default_rate,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted,
              deleted_at = EXCLUDED.deleted_at
            WHERE service_types.user_id = EXCLUDED.user_id
          `,
            [
              st.id, userId, st.companyCode || null, st.name, st.unit || 'fixed',
              Number(st.defaultRate) || 0,
              st.createdAt || new Date(), st.updatedAt || new Date(),
              st.isDeleted || false, st.deletedAt || null
            ]
          );
        }
      }
    }

    // Upsert Service Subscriptions
    if (changes.serviceSubscriptions && changes.serviceSubscriptions.length > 0) {
      if (perms.service_tracker !== 'full') {
        for (const sub of changes.serviceSubscriptions) {
          rejectedChanges.push({ entity: 'serviceSubscriptions', syncId: sub.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Subscriptions manage karne ka access nahi hai.' });
        }
      } else {
        for (const sub of changes.serviceSubscriptions) {
          await db.query(
            `
            INSERT INTO service_subscriptions (
              frontend_id, user_id, company_code, customer_id, service_type_id,
              start_date, frequency, custom_days, agreed_rate, default_quantity, status,
              created_at, updated_at, is_deleted, deleted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
            ON CONFLICT (frontend_id) DO UPDATE SET
              customer_id = EXCLUDED.customer_id,
              service_type_id = EXCLUDED.service_type_id,
              start_date = EXCLUDED.start_date,
              frequency = EXCLUDED.frequency,
              custom_days = EXCLUDED.custom_days,
              agreed_rate = EXCLUDED.agreed_rate,
              default_quantity = EXCLUDED.default_quantity,
              status = EXCLUDED.status,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted,
              deleted_at = EXCLUDED.deleted_at
            WHERE service_subscriptions.user_id = EXCLUDED.user_id
          `,
            [
              sub.id, userId, sub.companyCode || null, sub.customerId, sub.serviceTypeId,
              sub.startDate, sub.frequency || 'daily',
              sub.customDays ? JSON.stringify(sub.customDays) : null,
              Number(sub.agreedRate) || 0, Number(sub.defaultQuantity) || 1.0, sub.status || 'active',
              sub.createdAt || new Date(), sub.updatedAt || new Date(),
              sub.isDeleted || false, sub.deletedAt || null
            ]
          );
        }
      }
    }

    // Upsert Delivery Logs
    if (changes.deliveryLogs && changes.deliveryLogs.length > 0) {
      if (perms.service_tracker === 'none') {
        for (const log of changes.deliveryLogs) {
          rejectedChanges.push({ entity: 'deliveryLogs', syncId: log.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Service Tracker ka access nahi hai.' });
        }
      } else {
        for (const log of changes.deliveryLogs) {
          await db.query(
            `
            INSERT INTO delivery_logs (
              frontend_id, user_id, company_code, subscription_id, date, status,
              quantity, marked_by, marked_by_user_id, source, verification_token, confirmed_at,
              created_at, updated_at, is_deleted, deleted_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (subscription_id, date) DO UPDATE SET
              status = EXCLUDED.status,
              quantity = EXCLUDED.quantity,
              marked_by = EXCLUDED.marked_by,
              marked_by_user_id = EXCLUDED.marked_by_user_id,
              source = EXCLUDED.source,
              confirmed_at = EXCLUDED.confirmed_at,
              updated_at = EXCLUDED.updated_at,
              is_deleted = EXCLUDED.is_deleted,
              deleted_at = EXCLUDED.deleted_at
            WHERE delivery_logs.user_id = EXCLUDED.user_id
          `,
            [
              log.id, userId, log.companyCode || null, log.subscriptionId, log.date, log.status || 'received',
              log.quantity !== undefined && log.quantity !== null ? Number(log.quantity) : null,
              log.markedBy || 'owner', log.markedByUserId || null, log.source || 'app',
              log.verificationToken || null, log.confirmedAt || null,
              log.createdAt || new Date(), log.updatedAt || new Date(),
              log.isDeleted || false, log.deletedAt || null
            ]
          );
        }
      }
    }

    // Factory Module Push Upserts
    if (changes.boms && changes.boms.length > 0) {
      if (perms.factory !== 'full') {
        for (const b of changes.boms) {
          rejectedChanges.push({ entity: 'boms', syncId: b.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Factory BOM manage karne ka access nahi hai.' });
        }
      } else {
        for (const b of changes.boms) {
          await db.query(
            `INSERT INTO bill_of_materials (frontend_id, business_id, finished_product_id, version, status, labor_time_estimate_minutes, overhead_rate_per_unit, notes, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (frontend_id) DO UPDATE SET
               version = EXCLUDED.version, status = EXCLUDED.status, labor_time_estimate_minutes = EXCLUDED.labor_time_estimate_minutes,
               overhead_rate_per_unit = EXCLUDED.overhead_rate_per_unit, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at,
               is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE bill_of_materials.business_id = EXCLUDED.business_id`,
            [b.id, userId, b.finishedProductId, b.version || 1, b.status || 'active', b.laborTimeEstimateMinutes || 0, b.overheadRatePerUnit || 0, b.notes || null, b.createdAt || new Date(), b.updatedAt || new Date(), b.isDeleted || false, b.deletedAt || null]
          );
        }
      }
    }

    if (changes.bomLineItems && changes.bomLineItems.length > 0) {
      if (perms.factory !== 'full') {
        for (const bli of changes.bomLineItems) {
          rejectedChanges.push({ entity: 'bomLineItems', syncId: bli.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas BOM items manage karne ka access nahi hai.' });
        }
      } else {
        for (const bli of changes.bomLineItems) {
          await db.query(
            `INSERT INTO bom_line_items (frontend_id, business_id, bom_id, component_product_id, quantity_per_unit, unit, wastage_percent, notes, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (frontend_id) DO UPDATE SET
               quantity_per_unit = EXCLUDED.quantity_per_unit, unit = EXCLUDED.unit, wastage_percent = EXCLUDED.wastage_percent,
               notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE bom_line_items.business_id = EXCLUDED.business_id`,
            [bli.id, userId, bli.bomId, bli.componentProductId, bli.quantityPerUnit, bli.unit || 'pcs', bli.wastagePercent || 0, bli.notes || null, bli.createdAt || new Date(), bli.updatedAt || new Date(), bli.isDeleted || false, bli.deletedAt || null]
          );
        }
      }
    }

    if (changes.workCenters && changes.workCenters.length > 0) {
      if (perms.factory !== 'full') {
        for (const wc of changes.workCenters) {
          rejectedChanges.push({ entity: 'workCenters', syncId: wc.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Work Centers manage karne ka access nahi hai.' });
        }
      } else {
        for (const wc of changes.workCenters) {
          await db.query(
            `INSERT INTO work_centers (frontend_id, business_id, name, type, capacity_per_hour, shift_hours_per_day, status, hourly_cost_rate, notes, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (frontend_id) DO UPDATE SET
               name = EXCLUDED.name, type = EXCLUDED.type, capacity_per_hour = EXCLUDED.capacity_per_hour,
               shift_hours_per_day = EXCLUDED.shift_hours_per_day, status = EXCLUDED.status, hourly_cost_rate = EXCLUDED.hourly_cost_rate,
               notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE work_centers.business_id = EXCLUDED.business_id`,
            [wc.id, userId, wc.name, wc.type || 'MACHINE', wc.capacityPerHour || 10, wc.shiftHoursPerDay || 8, wc.status || 'ACTIVE', wc.hourlyCostRate || 0, wc.notes || null, wc.createdAt || new Date(), wc.updatedAt || new Date(), wc.isDeleted || false, wc.deletedAt || null]
          );
        }
      }
    }

    if (changes.workOrders && changes.workOrders.length > 0) {
      if (perms.factory !== 'full') {
        for (const wo of changes.workOrders) {
          rejectedChanges.push({ entity: 'workOrders', syncId: wo.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Work Orders manage karne ka access nahi hai.' });
        }
      } else {
        for (const wo of changes.workOrders) {
          await db.query(
            `INSERT INTO work_orders (frontend_id, business_id, order_number, product_id, bom_id, bom_version_snapshot, quantity_planned, quantity_produced, status, priority, scheduled_start_date, scheduled_end_date, actual_start_date, actual_end_date, notes, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
             ON CONFLICT (frontend_id) DO UPDATE SET
               quantity_planned = EXCLUDED.quantity_planned, quantity_produced = EXCLUDED.quantity_produced,
               status = EXCLUDED.status, priority = EXCLUDED.priority, scheduled_start_date = EXCLUDED.scheduled_start_date,
               scheduled_end_date = EXCLUDED.scheduled_end_date, actual_start_date = EXCLUDED.actual_start_date,
               actual_end_date = EXCLUDED.actual_end_date, notes = EXCLUDED.notes, updated_at = EXCLUDED.updated_at,
               is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE work_orders.business_id = EXCLUDED.business_id`,
            [wo.id, userId, wo.orderNumber, wo.productId, wo.bomId, wo.bomVersionSnapshot || 1, wo.quantityPlanned, wo.quantityProduced || 0, wo.status || 'planned', wo.priority || 'medium', wo.scheduledStartDate || null, wo.scheduledEndDate || null, wo.actualStartDate || null, wo.actualEndDate || null, wo.notes || null, wo.createdAt || new Date(), wo.updatedAt || new Date(), wo.isDeleted || false, wo.deletedAt || null]
          );
        }
      }
    }

    if (changes.workOrderOperations && changes.workOrderOperations.length > 0) {
      if (perms.factory !== 'full') {
        for (const woo of changes.workOrderOperations) {
          rejectedChanges.push({ entity: 'workOrderOperations', syncId: woo.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Operations manage karne ka access nahi hai.' });
        }
      } else {
        for (const woo of changes.workOrderOperations) {
          await db.query(
            `INSERT INTO work_order_operations (frontend_id, business_id, work_order_id, work_center_id, sequence_number, planned_duration_minutes, actual_start_time, actual_end_time, quantity_completed, status, operator_notes, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
             ON CONFLICT (frontend_id) DO UPDATE SET
               sequence_number = EXCLUDED.sequence_number, planned_duration_minutes = EXCLUDED.planned_duration_minutes,
               actual_start_time = EXCLUDED.actual_start_time, actual_end_time = EXCLUDED.actual_end_time,
               quantity_completed = EXCLUDED.quantity_completed, status = EXCLUDED.status, operator_notes = EXCLUDED.operator_notes,
               updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE work_order_operations.business_id = EXCLUDED.business_id`,
            [woo.id, userId, woo.workOrderId, woo.workCenterId, woo.sequenceNumber || 1, woo.plannedDurationMinutes || 60, woo.actualStartTime || null, woo.actualEndTime || null, woo.quantityCompleted || 0, woo.status || 'pending', woo.operatorNotes || null, woo.createdAt || new Date(), woo.updatedAt || new Date(), woo.isDeleted || false, woo.deletedAt || null]
          );
        }
      }
    }

    if (changes.machineDowntimeLogs && changes.machineDowntimeLogs.length > 0) {
      if (perms.factory !== 'full') {
        for (const mdl of changes.machineDowntimeLogs) {
          rejectedChanges.push({ entity: 'machineDowntimeLogs', syncId: mdl.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Downtime Logs manage karne ka access nahi hai.' });
        }
      } else {
        for (const mdl of changes.machineDowntimeLogs) {
          await db.query(
            `INSERT INTO machine_downtime_logs (frontend_id, business_id, work_center_id, start_time, end_time, duration_minutes, reason_code, notes, logged_by_user_id, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (frontend_id) DO UPDATE SET
               end_time = EXCLUDED.end_time, duration_minutes = EXCLUDED.duration_minutes,
               reason_code = EXCLUDED.reason_code, notes = EXCLUDED.notes,
               updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE machine_downtime_logs.business_id = EXCLUDED.business_id`,
            [mdl.id, userId, mdl.workCenterId, mdl.startTime, mdl.endTime || null, mdl.durationMinutes || null, mdl.reasonCode || 'other', mdl.notes || null, mdl.loggedByUserId || actualUserId, mdl.createdAt || new Date(), mdl.updatedAt || new Date(), mdl.isDeleted || false, mdl.deletedAt || null]
          );
        }
      }
    }

    if (changes.materialConsumptions && changes.materialConsumptions.length > 0) {
      if (perms.factory !== 'full') {
        for (const mc of changes.materialConsumptions) {
          rejectedChanges.push({ entity: 'materialConsumptions', syncId: mc.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Material Consumption manage karne ka access nahi hai.' });
        }
      } else {
        for (const mc of changes.materialConsumptions) {
          await db.query(
            `INSERT INTO material_consumptions (frontend_id, business_id, work_order_id, component_product_id, quantity_reserved, quantity_consumed, lot_number, serial_number, stock_movement_id, notes, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (frontend_id) DO UPDATE SET
               quantity_consumed = EXCLUDED.quantity_consumed, quantity_reserved = EXCLUDED.quantity_reserved,
               lot_number = EXCLUDED.lot_number, serial_number = EXCLUDED.serial_number,
               stock_movement_id = EXCLUDED.stock_movement_id, notes = EXCLUDED.notes,
               updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE material_consumptions.business_id = EXCLUDED.business_id`,
            [mc.id, userId, mc.workOrderId, mc.componentProductId, mc.quantityReserved || 0, mc.quantityConsumed || 0, mc.lotNumber || null, mc.serialNumber || null, mc.stockMovementId || null, mc.notes || null, mc.createdAt || new Date(), mc.updatedAt || new Date(), mc.isDeleted || false, mc.deletedAt || null]
          );
        }
      }
    }

    if (changes.workInstructions && changes.workInstructions.length > 0) {
      if (perms.factory !== 'full') {
        for (const wi of changes.workInstructions) {
          rejectedChanges.push({ entity: 'workInstructions', syncId: wi.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Work Instructions manage karne ka access nahi hai.' });
        }
      } else {
        for (const wi of changes.workInstructions) {
          await db.query(
            `INSERT INTO work_instructions (frontend_id, business_id, bom_id, work_center_id, title, version, content, effective_date, status, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             ON CONFLICT (frontend_id) DO UPDATE SET
               title = EXCLUDED.title, version = EXCLUDED.version, content = EXCLUDED.content,
               effective_date = EXCLUDED.effective_date, status = EXCLUDED.status,
               updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE work_instructions.business_id = EXCLUDED.business_id`,
            [wi.id, userId, wi.bomId || null, wi.workCenterId || null, wi.title, wi.version || 1, wi.content, wi.effectiveDate || null, wi.status || 'active', wi.createdAt || new Date(), wi.updatedAt || new Date(), wi.isDeleted || false, wi.deletedAt || null]
          );
        }
      }
    }

    if (changes.qualityDefectLogs && changes.qualityDefectLogs.length > 0) {
      if (perms.factory !== 'full') {
        for (const qdl of changes.qualityDefectLogs) {
          rejectedChanges.push({ entity: 'qualityDefectLogs', syncId: qdl.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Quality Logs manage karne ka access nahi hai.' });
        }
      } else {
        for (const qdl of changes.qualityDefectLogs) {
          await db.query(
            `INSERT INTO quality_defect_logs (frontend_id, business_id, work_order_id, work_order_operation_id, defect_type, quantity_defective, lot_number, notes, logged_by_user_id, timestamp, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (frontend_id) DO UPDATE SET
               quantity_defective = EXCLUDED.quantity_defective, defect_type = EXCLUDED.defect_type,
               lot_number = EXCLUDED.lot_number, notes = EXCLUDED.notes,
               updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE quality_defect_logs.business_id = EXCLUDED.business_id`,
            [qdl.id, userId, qdl.workOrderId, qdl.workOrderOperationId || null, qdl.defectType || 'other', qdl.quantityDefective || 1, qdl.lotNumber || null, qdl.notes || null, qdl.loggedByUserId || actualUserId, qdl.timestamp || new Date(), qdl.createdAt || new Date(), qdl.updatedAt || new Date(), qdl.isDeleted || false, qdl.deletedAt || null]
          );
        }
      }
    }

    if (changes.workOrderCostPostings && changes.workOrderCostPostings.length > 0) {
      if (perms.factory !== 'full') {
        for (const wocp of changes.workOrderCostPostings) {
          rejectedChanges.push({ entity: 'workOrderCostPostings', syncId: wocp.id, reason: 'PERMISSION_DENIED', message: 'Aap ke role ke paas Cost Postings manage karne ka access nahi hai.' });
        }
      } else {
        for (const wocp of changes.workOrderCostPostings) {
          await db.query(
            `INSERT INTO work_order_cost_postings (frontend_id, business_id, work_order_id, material_cost, labor_cost, overhead_cost, total_cost, ledger_entry_id, posted_at, posted_by_user_id, created_at, updated_at, is_deleted, deleted_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (frontend_id) DO UPDATE SET
               material_cost = EXCLUDED.material_cost, labor_cost = EXCLUDED.labor_cost,
               overhead_cost = EXCLUDED.overhead_cost, total_cost = EXCLUDED.total_cost,
               updated_at = EXCLUDED.updated_at, is_deleted = EXCLUDED.is_deleted, deleted_at = EXCLUDED.deleted_at
             WHERE work_order_cost_postings.business_id = EXCLUDED.business_id`,
            [wocp.id, userId, wocp.workOrderId, wocp.materialCost || 0, wocp.laborCost || 0, wocp.overheadCost || 0, wocp.totalCost || 0, wocp.ledgerEntryId, wocp.postedAt || new Date(), wocp.postedByUserId || actualUserId, wocp.createdAt || new Date(), wocp.updatedAt || new Date(), wocp.isDeleted || false, wocp.deletedAt || null]
          );
        }
      }
    }

    // Fetch changes from server that are newer than lastSyncAt
    let notesResult, docResult, annResult, remResult, chatMessagesResult, ledgerResult, udhaarResult, billsResult, khataCustResult, khataTxnResult, productsResult, productVariantsResult, stockMovementsResult, featureUsageResult, locationsResult, categoriesResult, serviceTypesResult, serviceSubsResult, deliveryLogsResult;
    let bomsResult, bomLineItemsResult, workCentersResult, workOrdersResult, workOrderOperationsResult, machineDowntimeLogsResult, materialConsumptionsResult, workInstructionsResult, qualityDefectLogsResult, workOrderCostPostingsResult;
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
      serviceTypesResult = await db.query('SELECT *, frontend_id as id FROM service_types WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      serviceSubsResult = await db.query('SELECT *, frontend_id as id FROM service_subscriptions WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);
      deliveryLogsResult = await db.query('SELECT *, frontend_id as id FROM delivery_logs WHERE user_id = $1 AND updated_at > $2', [userId, syncDate]);

      bomsResult = await db.query('SELECT *, frontend_id as id FROM bill_of_materials WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      bomLineItemsResult = await db.query('SELECT *, frontend_id as id FROM bom_line_items WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      workCentersResult = await db.query('SELECT *, frontend_id as id FROM work_centers WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      workOrdersResult = await db.query('SELECT *, frontend_id as id FROM work_orders WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      workOrderOperationsResult = await db.query('SELECT *, frontend_id as id FROM work_order_operations WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      machineDowntimeLogsResult = await db.query('SELECT *, frontend_id as id FROM machine_downtime_logs WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      materialConsumptionsResult = await db.query('SELECT *, frontend_id as id FROM material_consumptions WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      workInstructionsResult = await db.query('SELECT *, frontend_id as id FROM work_instructions WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      qualityDefectLogsResult = await db.query('SELECT *, frontend_id as id FROM quality_defect_logs WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
      workOrderCostPostingsResult = await db.query('SELECT *, frontend_id as id FROM work_order_cost_postings WHERE business_id = $1 AND updated_at > $2', [userId, syncDate]);
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
      serviceTypesResult = await db.query('SELECT *, frontend_id as id FROM service_types WHERE user_id = $1', [userId]);
      serviceSubsResult = await db.query('SELECT *, frontend_id as id FROM service_subscriptions WHERE user_id = $1', [userId]);
      deliveryLogsResult = await db.query('SELECT *, frontend_id as id FROM delivery_logs WHERE user_id = $1', [userId]);

      bomsResult = await db.query('SELECT *, frontend_id as id FROM bill_of_materials WHERE business_id = $1', [userId]);
      bomLineItemsResult = await db.query('SELECT *, frontend_id as id FROM bom_line_items WHERE business_id = $1', [userId]);
      workCentersResult = await db.query('SELECT *, frontend_id as id FROM work_centers WHERE business_id = $1', [userId]);
      workOrdersResult = await db.query('SELECT *, frontend_id as id FROM work_orders WHERE business_id = $1', [userId]);
      workOrderOperationsResult = await db.query('SELECT *, frontend_id as id FROM work_order_operations WHERE business_id = $1', [userId]);
      machineDowntimeLogsResult = await db.query('SELECT *, frontend_id as id FROM machine_downtime_logs WHERE business_id = $1', [userId]);
      materialConsumptionsResult = await db.query('SELECT *, frontend_id as id FROM material_consumptions WHERE business_id = $1', [userId]);
      workInstructionsResult = await db.query('SELECT *, frontend_id as id FROM work_instructions WHERE business_id = $1', [userId]);
      qualityDefectLogsResult = await db.query('SELECT *, frontend_id as id FROM quality_defect_logs WHERE business_id = $1', [userId]);
      workOrderCostPostingsResult = await db.query('SELECT *, frontend_id as id FROM work_order_cost_postings WHERE business_id = $1', [userId]);
    }
    featureUsageResult = await db.query('SELECT * FROM feature_usage WHERE user_id = $1', [userId]);

    // Query roles and assignments so client can keep Dexie updated
    const rolesRes = await db.query('SELECT *, frontend_id as id FROM roles WHERE business_id = $1 AND is_deleted = false', [userId]);
    const rolePermsRes = await db.query('SELECT rmp.* FROM role_module_permissions rmp JOIN roles r ON r.frontend_id = rmp.role_id WHERE r.business_id = $1', [userId]);
    const assignmentsRes = await db.query('SELECT *, frontend_id as id FROM user_role_assignments WHERE business_id = $1', [userId]);

    const canViewNotes = perms.notes_ai !== 'none';
    const canViewRoznamcha = perms.roznamcha !== 'none';
    const canViewKhata = perms.khata !== 'none';
    const canViewInventory = perms.inventory !== 'none';
    const canViewServiceTracker = perms.service_tracker !== 'none';
    const canViewTools = perms.tools !== 'none';
    const canViewFactory = perms.factory !== 'none';

    const serverChanges = {
      locations: canViewInventory && locationsResult ? mapToCamel(locationsResult.rows) : [],
      categories: canViewInventory && categoriesResult ? mapToCamel(categoriesResult.rows) : [],
      notes: canViewNotes && notesResult ? mapToCamel(notesResult.rows) : [],
      documents: canViewNotes && docResult ? mapToCamel(docResult.rows) : [],
      annotations: canViewNotes && annResult ? mapToCamel(annResult.rows) : [],
      chatMessages: canViewNotes && chatMessagesResult ? mapToCamel(chatMessagesResult.rows) : [],
      reminders: (canViewNotes || canViewTools) && remResult ? mapToCamel(remResult.rows) : [],
      ledger: canViewRoznamcha && ledgerResult ? mapToCamel(ledgerResult.rows) : [],
      udhaar: canViewKhata && udhaarResult ? mapToCamel(udhaarResult.rows) : [],
      bills: canViewRoznamcha && billsResult ? mapToCamel(billsResult.rows) : [],
      khataCustomers: canViewKhata && khataCustResult ? mapToCamel(khataCustResult.rows) : [],
      khataTransactions: canViewKhata && khataTxnResult ? mapToCamel(khataTxnResult.rows) : [],
      products: canViewInventory && productsResult ? mapToCamel(productsResult.rows) : [],
      productVariants: canViewInventory && productVariantsResult ? mapToCamel(productVariantsResult.rows) : [],
      stockMovements: canViewInventory && stockMovementsResult ? mapToCamel(stockMovementsResult.rows) : [],
      serviceTypes: canViewServiceTracker && serviceTypesResult ? mapToCamel(serviceTypesResult.rows) : [],
      serviceSubscriptions: canViewServiceTracker && serviceSubsResult ? mapToCamel(serviceSubsResult.rows) : [],
      deliveryLogs: canViewServiceTracker && deliveryLogsResult ? mapToCamel(deliveryLogsResult.rows) : [],
      boms: canViewFactory && bomsResult ? mapToCamel(bomsResult.rows) : [],
      bomLineItems: canViewFactory && bomLineItemsResult ? mapToCamel(bomLineItemsResult.rows) : [],
      workCenters: canViewFactory && workCentersResult ? mapToCamel(workCentersResult.rows) : [],
      workOrders: canViewFactory && workOrdersResult ? mapToCamel(workOrdersResult.rows) : [],
      workOrderOperations: canViewFactory && workOrderOperationsResult ? mapToCamel(workOrderOperationsResult.rows) : [],
      machineDowntimeLogs: canViewFactory && machineDowntimeLogsResult ? mapToCamel(machineDowntimeLogsResult.rows) : [],
      materialConsumptions: canViewFactory && materialConsumptionsResult ? mapToCamel(materialConsumptionsResult.rows) : [],
      workInstructions: canViewFactory && workInstructionsResult ? mapToCamel(workInstructionsResult.rows) : [],
      qualityDefectLogs: canViewFactory && qualityDefectLogsResult ? mapToCamel(qualityDefectLogsResult.rows) : [],
      workOrderCostPostings: canViewFactory && workOrderCostPostingsResult ? mapToCamel(workOrderCostPostingsResult.rows) : [],
      roles: mapToCamel(rolesRes.rows),
      roleModulePermissions: mapToCamel(rolePermsRes.rows),
      userRoleAssignments: mapToCamel(assignmentsRes.rows),
      featureUsage: featureUsageResult ? mapToCamel(featureUsageResult.rows) : [],
      user: {
        status: dbUser.account_status,
        license: dbUser.license_type,
        licenseExpiry: dbUser.license_expiry,
      },
      userPermissions: callerPerms,
      rejectedChanges,
    };

    const response = NextResponse.json(serverChanges);
    if (rejectedChanges.length > 0) {
      response.headers.set('X-Sync-Rejected-Count', String(rejectedChanges.length));
    }
    return response;
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Server error during sync' }, { status: 500 });
  }
}
