import { NextRequest, NextResponse } from 'next/server';
import { adVerifier } from '../../../../lib/adVerifier';
import { requireAuth } from '../../../../lib/auth/jwtAuth';

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const userId = auth.user.id;
    const { feature_key } = await req.json();

    if (!feature_key) {
      return NextResponse.json({ error: 'feature_key is required' }, { status: 400 });
    }

    const nonce = adVerifier.generateNonce(userId, feature_key);
    return NextResponse.json({ nonce });
  } catch (error) {
    console.error('Error in generateNonce:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
