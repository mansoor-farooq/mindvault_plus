import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { expandBOMRequirements } from '@/lib/services/factoryService';
import { getLiveStockQuantity } from '@/lib/services/inventoryService';

// GET /api/factory/boms/[id]/expand?quantity=100
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const url = new URL(req.url);
    const quantity = Math.max(0.0001, Number(url.searchParams.get('quantity')) || 1);

    const bomRes = await db.query(
      `SELECT b.*, p.name as product_name
       FROM bill_of_materials b
       JOIN products p ON p.frontend_id = b.finished_product_id
       WHERE b.frontend_id = $1 AND b.business_id = $2 AND b.is_deleted = false`,
      [id, gate.businessId]
    );

    if (bomRes.rows.length === 0) {
      return NextResponse.json({ error: 'BOM not found' }, { status: 404 });
    }

    const bom = bomRes.rows[0];

    // Multi-level recursive tree explosion
    const requirements = await expandBOMRequirements(gate.businessId, bom.finished_product_id, quantity);

    // Enrich each item with live stock in hand and shortage check
    const enriched = await Promise.all(
      requirements.map(async (item) => {
        const inStock = await getLiveStockQuantity(gate.businessId, item.componentProductId);
        const shortage = Math.max(0, item.totalQuantityNeeded - inStock);
        return {
          ...item,
          inStock,
          shortage,
          hasShortage: shortage > 0
        };
      })
    );

    return NextResponse.json({
      bomId: id,
      finishedProductId: bom.finished_product_id,
      productName: bom.product_name,
      quantity,
      requirements: enriched,
      totalComponentsCount: enriched.length,
      hasAnyShortage: enriched.some((r) => r.hasShortage)
    });
  } catch (err: any) {
    console.error('Error expanding BOM:', err);
    return NextResponse.json({ error: err.message || 'Failed to expand BOM' }, { status: 500 });
  }
}
