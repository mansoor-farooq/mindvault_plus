import { db } from '../db.server';
import crypto from 'crypto';

export interface StockDeductionParams {
  businessId: number;
  actorUserId?: number;
  productId: string; // Product syncId
  quantity: number;
  reason: string;
  locationId?: string;
  variantId?: string;
  lotNumber?: string;
  serialNumber?: string;
  workOrderId?: string;
}

export interface StockMovementResult {
  syncId: string;
  productId: string;
  quantity: number;
  type: 'STOCK_OUT';
  reason: string;
  lotNumber?: string;
  serialNumber?: string;
  workOrderId?: string;
}

/**
 * Authoritative Server-Side Stock Deduction Helper.
 * Reusable across Factory Material Consumption, POS online sales, and direct API actions.
 * Inserts a verified STOCK_OUT row into PostgreSQL stock_movements table.
 */
export async function deductStock(params: StockDeductionParams): Promise<StockMovementResult> {
  const {
    businessId,
    productId,
    quantity,
    reason,
    locationId,
    variantId,
    lotNumber,
    serialNumber,
    workOrderId
  } = params;

  if (quantity <= 0) {
    throw new Error('Deduction quantity must be strictly positive');
  }

  // Verify product exists for this business
  const prodRes = await db.query(
    'SELECT frontend_id, name FROM products WHERE frontend_id = $1 AND user_id = $2 AND is_deleted = false',
    [productId, businessId]
  );
  if (prodRes.rows.length === 0) {
    throw new Error(`Product not found or not owned by business: "${productId}"`);
  }

  const syncId = crypto.randomUUID();
  const now = new Date();

  await db.query(
    `INSERT INTO stock_movements (
       frontend_id, user_id, product_id, type, quantity, reason,
       location_id, variant_id, lot_number, serial_number, work_order_id,
       created_at, updated_at, is_deleted
     )
     VALUES ($1, $2, $3, 'STOCK_OUT', $4, $5, $6, $7, $8, $9, $10, $11, $11, false)`,
    [
      syncId,
      businessId,
      productId,
      quantity,
      reason,
      locationId || null,
      variantId || null,
      lotNumber || null,
      serialNumber || null,
      workOrderId || null,
      now
    ]
  );

  return {
    syncId,
    productId,
    quantity,
    type: 'STOCK_OUT',
    reason,
    lotNumber,
    serialNumber,
    workOrderId
  };
}

/**
 * Calculates current available stock for a product live from stock_movements.
 * Conforms to the codebase invariant: all balances are derived via LIVE QUERIES, never stored mutable fields.
 */
export async function getLiveStockQuantity(businessId: number, productId: string): Promise<number> {
  const res = await db.query(
    `SELECT 
       COALESCE(SUM(CASE WHEN type::text IN ('STOCK_IN', 'IN') THEN quantity ELSE 0 END), 0) -
       COALESCE(SUM(CASE WHEN type::text IN ('STOCK_OUT', 'OUT') THEN quantity ELSE 0 END), 0) +
       COALESCE(SUM(CASE WHEN type::text = 'ADJUSTMENT' THEN quantity ELSE 0 END), 0) AS balance
     FROM stock_movements
     WHERE user_id = $1 AND product_id = $2 AND is_deleted = false`,
    [businessId, productId]
  );
  return Number(res.rows[0]?.balance || 0);
}
