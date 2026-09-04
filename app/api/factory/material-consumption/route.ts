import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { deductStock } from '@/lib/services/inventoryService';
import { getBusinessFactoryTier } from '@/lib/services/factoryService';
import crypto from 'crypto';

// GET /api/factory/material-consumption?workOrderId=...
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const url = new URL(req.url);
    const workOrderId = url.searchParams.get('workOrderId');

    let query = `
      SELECT mc.*, p.name as component_name, p.sku as component_sku, p.cost_price as component_cost_price
      FROM material_consumptions mc
      JOIN products p ON p.frontend_id = mc.component_product_id
      WHERE mc.business_id = $1 AND mc.is_deleted = false
    `;
    const params: any[] = [gate.businessId];

    if (workOrderId) {
      params.push(workOrderId);
      query += ` AND mc.work_order_id = $${params.length}`;
    }

    query += ` ORDER BY mc.created_at DESC`;

    const res = await db.query(query, params);
    return NextResponse.json({ consumptions: res.rows });
  } catch (err: any) {
    console.error('Error fetching material consumptions:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch consumptions' }, { status: 500 });
  }
}

// POST /api/factory/material-consumption - Consume raw material and deduct from inventory
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const {
      workOrderId,
      componentProductId,
      quantityConsumed,
      lotNumber,
      serialNumber,
      notes
    } = body;

    if (!workOrderId || !componentProductId) {
      return NextResponse.json(
        { error: 'workOrderId and componentProductId are required' },
        { status: 400 }
      );
    }

    const qty = Number(quantityConsumed);
    if (!qty || qty <= 0) {
      return NextResponse.json(
        { error: 'quantityConsumed must be greater than 0' },
        { status: 400 }
      );
    }

    // Tier enforcement: Lot & Serial tracking is ULTRA / LIFETIME only
    if (lotNumber || serialNumber) {
      const caps = await getBusinessFactoryTier(gate.businessId);
      if (!caps.allowLotSerialTracking) {
        return NextResponse.json(
          { error: 'Lot & Serial Number tracking requires an ULTRA or LIFETIME subscription.' },
          { status: 403 }
        );
      }
    }

    // 1. Deduct from inventory via authoritative server helper (creates stock_movement)
    const deduction = await deductStock({
      businessId: gate.businessId,
      actorUserId: gate.actualUserId,
      productId: componentProductId,
      quantity: qty,
      reason: `Factory Production WO Consumption`,
      workOrderId,
      lotNumber: lotNumber || undefined,
      serialNumber: serialNumber || undefined
    });

    // 2. Insert into material_consumptions linked to stock_movement_id
    const syncId = crypto.randomUUID();
    const mcRes = await db.query(
      `INSERT INTO material_consumptions (
         frontend_id, business_id, work_order_id, component_product_id,
         quantity_reserved, quantity_consumed, lot_number, serial_number,
         stock_movement_id, notes, created_at, updated_at, is_deleted
       )
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, NOW(), NOW(), false)
       RETURNING *`,
      [
        syncId,
        gate.businessId,
        workOrderId,
        componentProductId,
        qty,
        lotNumber || null,
        serialNumber || null,
        deduction.syncId,
        notes || null
      ]
    );

    return NextResponse.json(
      {
        consumption: mcRes.rows[0],
        stockMovement: deduction
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('Error logging material consumption:', err);
    return NextResponse.json({ error: err.message || 'Failed to log material consumption' }, { status: 400 });
  }
}
