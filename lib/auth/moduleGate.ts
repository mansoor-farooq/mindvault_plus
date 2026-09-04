import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, AuthResult, AuthError } from './jwtAuth';
import {
  ModuleKey,
  AccessLevel,
  isValidModuleKey,
  isAccessSufficient,
} from '../permissions/canonicalModules';
import { resolveUserPermissions, ResolvedPermissions } from '../services/permissionService';

export interface ModuleAccessSuccess {
  ok: true;
  auth: AuthResult;
  user: AuthResult['user'];
  permissions: Record<ModuleKey, AccessLevel>;
  userPermissions: ResolvedPermissions;
  businessId: number;
  actualUserId: number;
  roleName: string;
  isOwner: boolean;
}

export interface ModuleAccessError {
  ok: false;
  status: number;
  error: string;
  reason?: string;
  response: NextResponse;
}

export type ModuleAccessResult = ModuleAccessSuccess | ModuleAccessError;

/**
 * Canonical Tenant Identity Resolver.
 * Resolves the primary business scope, the human physical actor, and deterministic ownership.
 * Acts as the Single Source of Truth for tenant isolation across MindVault Plus.
 */
export function getTenantIdentity(auth: AuthResult) {
  const businessId = auth.user.id as number;
  const actualUserId = (auth.user.actualUserId as number) || businessId;
  const isOwner = actualUserId === businessId || auth.user.org_role === 'OWNER';

  return {
    businessId,
    actualUserId,
    isOwner,
    roleVersion: (auth.user.roleVersion as number) || 1,
  };
}

/**
 * Executive guard: restricts route execution strictly to the primary business owner.
 * Used for executive operations like inviting/removing staff, tier upgrades, and billing accounts.
 */
export async function requireOwner(req: NextRequest): Promise<
  | { ok: true; auth: AuthResult; user: AuthResult['user']; businessId: number; actualUserId: number }
  | { ok: false; status: number; error: string; response: NextResponse }
> {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.error,
      response: NextResponse.json({ error: auth.error }, { status: auth.status }),
    };
  }

  const { businessId, actualUserId, isOwner } = getTenantIdentity(auth);

  if (!isOwner) {
    return {
      ok: false,
      status: 403,
      error: 'Executive authorization required. This operation is restricted to the business owner.',
      response: NextResponse.json(
        {
          error: 'Executive authorization required. This operation is restricted to the business owner.',
          reason: 'OWNER_REQUIRED',
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, auth, user: auth.user, businessId, actualUserId };
}

/**
 * Unified Layer 1 + Layer 2 Route Guard Middleware.
 * Validates canonical moduleKey, verifies subscription ceiling (Layer 1),
 * and verifies caller's role-based access level (Layer 2).
 */
export async function requireModuleAccess(
  req: NextRequest,
  moduleKey: string,
  minLevel: AccessLevel = 'view'
): Promise<ModuleAccessResult> {
  // 1. Authenticate caller via JWT
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      error: auth.error,
      response: NextResponse.json({ error: auth.error }, { status: auth.status }),
    };
  }

  // 2. Validate module key against canonical catalog
  if (!isValidModuleKey(moduleKey)) {
    return {
      ok: false,
      status: 400,
      error: `Invalid canonical module key: "${moduleKey}"`,
      response: NextResponse.json(
        { error: `Invalid canonical module key: "${moduleKey}"` },
        { status: 400 }
      ),
    };
  }

  const { businessId, actualUserId } = getTenantIdentity(auth);

  // 3. Resolve unified Layer 1 x Layer 2 permissions
  const userPerms = await resolveUserPermissions(actualUserId, businessId);
  const grantedLevel = userPerms.permissions[moduleKey as ModuleKey] || 'none';

  // 4. Check if access is denied completely
  if (grantedLevel === 'none') {
    const errorMsg = `Access denied to module "${moduleKey}". Your role does not have permission, or your business subscription tier does not include this module.`;
    return {
      ok: false,
      status: 403,
      error: errorMsg,
      reason: 'MODULE_ACCESS_DENIED',
      response: NextResponse.json(
        {
          error: errorMsg,
          reason: 'MODULE_ACCESS_DENIED',
          moduleKey,
          grantedLevel,
          requiredLevel: minLevel,
        },
        { status: 403 }
      ),
    };
  }

  // 5. Check if caller meets minimum required level ('full' >= 'view')
  if (!isAccessSufficient(grantedLevel, minLevel)) {
    const errorMsg = `Insufficient permission for module "${moduleKey}". You have view-only access, but this action requires full management permission.`;
    return {
      ok: false,
      status: 403,
      error: errorMsg,
      reason: 'INSUFFICIENT_ACCESS_LEVEL',
      response: NextResponse.json(
        {
          error: errorMsg,
          reason: 'INSUFFICIENT_ACCESS_LEVEL',
          moduleKey,
          grantedLevel,
          requiredLevel: minLevel,
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    auth,
    user: auth.user,
    permissions: userPerms.permissions,
    userPermissions: userPerms,
    businessId,
    actualUserId,
    roleName: userPerms.roleName,
    isOwner: userPerms.isOwner,
  };
}
