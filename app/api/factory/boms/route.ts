import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { createBOM, getBusinessFactoryTier } from '@/lib/services/factoryService';

// GET /api/factory/boms - List all BOMs for the business
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const bomsRes = await db.query(
      `SELECT b.*, p.name as product_name, p.sku as product_sku, p.selling_price as product_price,
              (SELECT COUNT(*) FROM bom_line_items bli WHERE bli.bom_id = b.frontend_id AND bli.is_deleted = false) as line_items_count
       FROM bill_of_materials b
       JOIN products p ON p.frontend_id = b.finished_product_id
       WHERE b.business_id = $1 AND b.is_deleted = false
       ORDER BY b.created_at DESC`,
      [gate.businessId]
    );

    // Also fetch line items for each BOM
    const bomIds = bomsRes.rows.map((b: any) => b.frontend_id);
    let lineItemsByBomId: Record<string, any[]> = {};

    if (bomIds.length > 0) {
      const linesRes = await db.query(
        `SELECT bli.*, p.name as component_name, p.sku as component_sku, p.cost_price as component_cost_price
         FROM bom_line_items bli
         JOIN products p ON p.frontend_id = bli.component_product_id
         WHERE bli.bom_id = ANY($1) AND bli.is_deleted = false
         ORDER BY bli.created_at ASC`,
        [bomIds]
      );

      for (const line of linesRes.rows) {
        if (!lineItemsByBomId[line.bom_id]) {
          lineItemsByBomId[line.bom_id] = [];
        }
        lineItemsByBomId[line.bom_id].push(line);
      }
    }

    const bomsWithItems = bomsRes.rows.map((b: any) => ({
      ...b,
      line_items: lineItemsByBomId[b.frontend_id] || []
    }));

    return NextResponse.json({ boms: bomsWithItems });
  } catch (err: any) {
    console.error('Error fetching BOMs:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch BOMs' }, { status: 500 });
  }
}

// POST /api/factory/boms - Create a new BOM with circular reference protection
export async function POST(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'full');
  if (!gate.ok) return gate.response;

  try {
    const body = await req.json();
    const { finishedProductId, laborTimeEstimateMinutes, overheadRatePerUnit, notes, lineItems } = body;

    if (!finishedProductId) {
      return NextResponse.json({ error: 'finishedProductId is required' }, { status: 400 });
    }
    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json({ error: 'lineItems must be a non-empty array' }, { status: 400 });
    }

    // Check tier capabilities
    const caps = await getBusinessFactoryTier(gate.businessId);
    if (!caps.allowMultiLevelBOM) {
      // PRO tier only allows single level BOM. Check if any component has an active BOM
      for (const item of lineItems) {
        const subBomCheck = await db.query(
          `SELECT 1 FROM bill_of_materials WHERE finished_product_id = $1 AND business_id = $2 AND status = 'active' AND is_deleted = false LIMIT 1`,
          [item.componentProductId, gate.businessId]
        );
        if (subBomCheck.rows.length > 0) {
          return NextResponse.json(
            { error: 'Multi-level nested BOMs with sub-assemblies require an ULTRA or LIFETIME subscription.' },
            { status: 403 }
          );
        }
      }
    }

    const result = await createBOM({
      businessId: gate.businessId,
      actorUserId: gate.actualUserId,
      finishedProductId,
      laborTimeEstimateMinutes: Number(laborTimeEstimateMinutes) || 0,
      overheadRatePerUnit: Number(overheadRatePerUnit) || 0,
      notes,
      lineItems
    });

    return NextResponse.json(result, { status: 201 });
  } catch (err: any) {
    console.error('Error creating BOM:', err);
    const status = err.message?.includes('CIRCULAR_BOM_DEPENDENCY') ? 422 : 400;
    return NextResponse.json({ error: err.message || 'Failed to create BOM' }, { status });
  }
}
