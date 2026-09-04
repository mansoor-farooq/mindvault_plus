import { NextRequest, NextResponse } from 'next/server';
import { requireModuleAccess } from '@/lib/auth/moduleGate';
import { db } from '@/lib/db.server';
import { getLiveWorkCenterOEE, getBusinessFactoryTier } from '@/lib/services/factoryService';

// GET /api/factory/oee - Live Derived OEE Analytics (Zero Stored Running Totals)
export async function GET(req: NextRequest) {
  const gate = await requireModuleAccess(req, 'factory', 'view');
  if (!gate.ok) return gate.response;

  try {
    const caps = await getBusinessFactoryTier(gate.businessId);
    if (!caps.allowLiveOEE) {
      return NextResponse.json(
        {
          error: 'Live OEE Analytics dashboard is an ULTRA / LIFETIME feature. Upgrade to unlock real-time Availability, Performance, and Quality tracking.'
        },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const workCenterId = url.searchParams.get('workCenterId');
    const startParam = url.searchParams.get('start');
    const endParam = url.searchParams.get('end');

    // Default window: today's shift (from 00:00 today to now)
    const windowEnd = endParam ? new Date(endParam) : new Date();
    const windowStart = startParam
      ? new Date(startParam)
      : new Date(new Date().setHours(0, 0, 0, 0));

    if (workCenterId) {
      const oee = await getLiveWorkCenterOEE(gate.businessId, workCenterId, windowStart, windowEnd);
      return NextResponse.json({ oee });
    }

    // If no workCenterId passed, calculate OEE across all active work centers
    const wcRes = await db.query(
      `SELECT frontend_id FROM work_centers WHERE business_id = $1 AND is_deleted = false`,
      [gate.businessId]
    );

    const results = await Promise.all(
      wcRes.rows.map(async (row) => {
        try {
          return await getLiveWorkCenterOEE(gate.businessId, row.frontend_id, windowStart, windowEnd);
        } catch {
          return null;
        }
      })
    );

    const validResults = results.filter((r): r is NonNullable<typeof r> => r !== null);

    // Compute Plant-wide average OEE
    let avgOEE = 0;
    let avgAvailability = 0;
    let avgPerformance = 0;
    let avgQuality = 0;

    if (validResults.length > 0) {
      avgOEE = Math.round((validResults.reduce((acc, r) => acc + r.oee, 0) / validResults.length) * 10) / 10;
      avgAvailability = Math.round((validResults.reduce((acc, r) => acc + r.availability, 0) / validResults.length) * 10) / 10;
      avgPerformance = Math.round((validResults.reduce((acc, r) => acc + r.performance, 0) / validResults.length) * 10) / 10;
      avgQuality = Math.round((validResults.reduce((acc, r) => acc + r.quality, 0) / validResults.length) * 10) / 10;
    }

    return NextResponse.json({
      plantMetrics: {
        avgOEE,
        avgAvailability,
        avgPerformance,
        avgQuality,
        totalWorkCenters: validResults.length
      },
      workCentersOEE: validResults
    });
  } catch (err: any) {
    console.error('Error computing live OEE:', err);
    return NextResponse.json({ error: err.message || 'Failed to calculate OEE' }, { status: 500 });
  }
}
