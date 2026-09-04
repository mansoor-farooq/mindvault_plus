import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db.server';
import { requireOwner } from '@/lib/auth/moduleGate';

export async function POST(req: NextRequest) {
  const ownerAuth = await requireOwner(req);
  if (!ownerAuth.ok) {
    return ownerAuth.response;
  }

  const { plan } = await req.json(); // e.g. 'PRO', 'PRO_PLUS', 'LIFETIME'

  try {
    const userId = ownerAuth.businessId;
    let license_type = 'FREE';
    let expiry: Date | null = null;

    if (plan === 'STARTER' || plan === 'STARTER_MONTHLY') {
      license_type = 'STARTER';
      const date = new Date();
      date.setMonth(date.getMonth() + 1); // 1 month starter
      expiry = date;
    } else if (plan === 'STARTER_ANNUAL') {
      license_type = 'STARTER';
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1); // 1 year starter
      expiry = date;
    } else if (plan === 'PRO' || plan === 'PRO_MONTHLY') {
      license_type = 'PRO';
      const date = new Date();
      date.setMonth(date.getMonth() + 1); // 1 month pro
      expiry = date;
    } else if (plan === 'PRO_ANNUAL') {
      license_type = 'PRO';
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1); // 1 year pro
      expiry = date;
    } else if (plan === 'ULTRA' || plan === 'ULTRA_1Y') {
      license_type = 'PRO_PLUS';
      const date = new Date();
      date.setFullYear(date.getFullYear() + 1); // 1 year ULTRA
      expiry = date;
    } else if (plan === 'ULTRA_2Y') {
      license_type = 'PRO_PLUS';
      const date = new Date();
      date.setFullYear(date.getFullYear() + 2); // 2 years ULTRA
      expiry = date;
    } else if (plan === 'LIFETIME') {
      license_type = 'LIFETIME';
      expiry = null;
    } else {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    let updateRes;
    try {
      updateRes = await db.query(
        'UPDATE users SET license_type = $1, license_expiry = $2 WHERE id = $3 RETURNING license_type, license_expiry', 
        [license_type, expiry, userId]
      );
    } catch (dbErr: any) {
      console.warn('Initial update failed, trying fallback license_type:', dbErr.message);
      // Fallback for enum variations
      const fallbackType = license_type === 'PRO_PLUS' ? 'PRO' : 'LIFETIME';
      updateRes = await db.query(
        'UPDATE users SET license_type = $1, license_expiry = $2 WHERE id = $3 RETURNING license_type, license_expiry', 
        [fallbackType, expiry, userId]
      );
    }

    return NextResponse.json({ 
      success: true, 
      license: updateRes.rows[0],
      plan: plan,
      message: `Account upgraded to ${license_type} successfully.`
    });
  } catch (error: any) {
    console.error('Upgrade error:', error);
    return NextResponse.json({ error: error?.message || 'Error upgrading plan' }, { status: 500 });
  }
}
