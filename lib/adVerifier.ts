import crypto from 'crypto';
import { AD_NONCE_EXPIRY_MS } from './config/gatingConfig';

// Was a hardcoded fallback in the Express backend ('super_secret_ad_key_mindvault_123')
// - rotated to a real secret in .env as part of this merge (see AD_SECRET there).
const AD_SECRET = process.env.AD_SECRET || 'super_secret_ad_key_mindvault_123';

interface NonceData {
  userId: number;
  featureKey: string;
  timestamp: number;
}

class AdVerifier {
  /** Generates a signed nonce for an ad request to prevent user_id tampering. */
  generateNonce(userId: number, featureKey: string): string {
    const timestamp = Date.now();
    const payload = `${userId}:${featureKey}:${timestamp}`;
    const signature = crypto.createHmac('sha256', AD_SECRET).update(payload).digest('hex');
    return `${payload}:${signature}`;
  }

  /** Verifies the custom_data nonce passed back by the ad provider. */
  verifyNonce(nonce: string, expectedUserId: number): NonceData | false {
    if (!nonce) return false;

    const parts = nonce.split(':');
    if (parts.length !== 4) return false;

    const [userIdStr, featureKey, timestampStr, signature] = parts;
    const userId = parseInt(userIdStr, 10);
    const timestamp = parseInt(timestampStr, 10);

    // 1. Check User ID match (Anti-Tamper)
    if (userId !== expectedUserId) return false;

    // 2. Check Expiry
    if (Date.now() - timestamp > AD_NONCE_EXPIRY_MS) return false;

    // 3. Check Signature
    const payload = `${userId}:${featureKey}:${timestamp}`;
    const expectedSignature = crypto.createHmac('sha256', AD_SECRET).update(payload).digest('hex');

    if (signature !== expectedSignature) return false;

    return { userId, featureKey, timestamp };
  }

  /**
   * Simulates/Implements provider signature verification.
   * In a real Google AdMob setup, this would fetch public keys and verify an ECDSA signature.
   * For the sake of this implementation and testing, we use a shared secret HMAC mechanism
   * as a placeholder for the provider signature.
   */
  verifyProviderSignature(payload: unknown, signature: string): boolean {
    const expectedSignature = crypto.createHmac('sha256', AD_SECRET).update(JSON.stringify(payload)).digest('hex');
    return signature === expectedSignature;
  }
}

export const adVerifier = new AdVerifier();
