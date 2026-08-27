import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const { nonce, userId, rewardAmount } = await req.json();

    const AD_SECRET = process.env.AD_SECRET || 'super_secret_ad_key_mindvault_123';

    const payload = {
      ad_unit_id: 'test-ad-unit',
      reward_type: 'quota',
      reward_amount: rewardAmount,
      user_id: userId,
      timestamp: Date.now(),
      custom_data: nonce
    };

    const signature = crypto
      .createHmac('sha256', AD_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');

    const webhookRes = await fetch(new URL('/api/ads/reward-callback', req.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ad-signature': signature
      },
      body: JSON.stringify(payload)
    });

    if (!webhookRes.ok) {
      const err = await webhookRes.json();
      return NextResponse.json({ error: err.error || 'Webhook failed' }, { status: webhookRes.status });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
