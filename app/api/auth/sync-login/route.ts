import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserModel } from '../../../../lib/models/userModel';
import { normalizeEmail } from '../../../../lib/utils';
import { withAuthLock } from '../../../../lib/authLock';
import { logAuthEvent } from '../../../../lib/auth/authLog';
import { db } from '../../../../lib/db.server';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretmindvault';
const VALID_RELIGIONS = ['muslim', 'other', 'prefer_not_to_say'];
const VALID_BUSINESS_TYPES = ['RETAIL_SHOP', 'MANUFACTURING', 'RESTAURANT', 'WHOLESALE', 'OTHER'];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const cleanEmail = normalizeEmail(body.email);
  const { fullName, country, city, religion, namazRemindersEnabled, businessType, accountType, organizationName } = body;
  const cleanReligion = VALID_RELIGIONS.includes(religion) ? religion : null;
  const cleanBusinessType = VALID_BUSINESS_TYPES.includes(businessType) ? businessType : null;

  if (!cleanEmail) {
    logAuthEvent('WARN', 'SYNC_LOGIN_FAILED', cleanEmail, 'INVALID_INPUT');
    return NextResponse.json({ error: 'Email is required', reason: 'INVALID_INPUT' }, { status: 400 });
  }

  return withAuthLock(cleanEmail, async () => {
    try {
      let user = await UserModel.findByEmail(cleanEmail);

      if (!user) {
        // Also backfills profile fields on every sync-login (not just first creation)
        // via ON CONFLICT, since a backend row can pre-date the user filling these in.
        const result = await db.query(
          `
          INSERT INTO users (full_name, email, password_hash, country, city, religion, namaz_reminders_enabled, business_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (email) DO UPDATE SET
            full_name = EXCLUDED.full_name,
            country = COALESCE(EXCLUDED.country, users.country),
            city = COALESCE(EXCLUDED.city, users.city),
            religion = COALESCE(EXCLUDED.religion, users.religion),
            namaz_reminders_enabled = EXCLUDED.namaz_reminders_enabled,
            business_type = COALESCE(EXCLUDED.business_type, users.business_type)
          RETURNING *
        `,
          [fullName || cleanEmail, cleanEmail, 'dummy_hash_for_sync', country || null, city || null, cleanReligion, !!namazRemindersEnabled, cleanBusinessType]
        );
        user = result.rows[0];
        logAuthEvent('INFO', 'SYNC_LOGIN_CREATED_USER', cleanEmail, 'CREATED_OFFLINE_USER');

        // Organization creation only happens once, at the moment a brand-new user is
        // created here - it's a one-time registration decision, not something re-applied
        // on every later sync-login (unlike the profile fields backfilled above).
        if (accountType === 'ORGANIZATION' && typeof organizationName === 'string' && organizationName.trim()) {
          const orgResult = await db.query(
            `INSERT INTO organizations (frontend_id, name, owner_user_id) VALUES ($1, $2, $3) RETURNING id`,
            [crypto.randomUUID(), organizationName.trim(), user!.id]
          );
          const orgId = orgResult.rows[0].id;
          const updatedUser = await db.query(
            `UPDATE users SET account_type = 'ORGANIZATION', organization_id = $1, org_role = 'OWNER' WHERE id = $2 RETURNING *`,
            [orgId, user!.id]
          );
          user = updatedUser.rows[0];
          logAuthEvent('INFO', 'ORGANIZATION_CREATED', cleanEmail, 'SUCCESS', { organizationId: orgId });
        }
      } else if (country || city || cleanReligion || cleanBusinessType) {
        // Existing user re-syncing with newly-filled profile fields.
        const result = await db.query(
          `
          UPDATE users SET
            country = COALESCE($1, country),
            city = COALESCE($2, city),
            religion = COALESCE($3, religion),
            namaz_reminders_enabled = $4,
            business_type = COALESCE($5, business_type)
          WHERE id = $6
          RETURNING *
        `,
          [country || null, city || null, cleanReligion, !!namazRemindersEnabled, cleanBusinessType, user.id]
        );
        user = result.rows[0];
      }

      if (user!.account_status === 'BANNED' || user!.account_status === 'SUSPENDED') {
        logAuthEvent('WARN', 'SYNC_LOGIN_FAILED', cleanEmail, `ACCOUNT_${user!.account_status}`);
        return NextResponse.json(
          { error: `Account is ${user!.account_status}. Please contact support.`, reason: `ACCOUNT_${user!.account_status}` },
          { status: 403 }
        );
      }

      const token = jwt.sign({ id: user!.id }, JWT_SECRET, { expiresIn: '7d' });
      logAuthEvent('INFO', 'SYNC_LOGIN_SUCCESS', cleanEmail, 'SUCCESS', { userId: user!.id });

      return NextResponse.json({ token, user: { id: user!.id, full_name: user!.full_name, email: user!.email, status: user!.account_status } });
    } catch (error) {
      logAuthEvent('ERROR', 'SYNC_LOGIN_ERROR', cleanEmail, 'SERVER_ERROR', { error: error instanceof Error ? error.message : String(error) });
      return NextResponse.json({ error: 'Server error during sync login', reason: 'SERVER_ERROR' }, { status: 500 });
    }
  });
}
