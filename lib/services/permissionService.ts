import { db } from '../db.server';
import crypto from 'crypto';
import {
  CANONICAL_MODULES,
  ModuleKey,
  AccessLevel,
  isValidModuleKey,
  isValidAccessLevel,
} from '../permissions/canonicalModules';
import { getUserFeatureAccess } from './featureAccessService';

export interface ResolvedPermissions {
  version: number;
  userId: number;
  businessId: number;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  permissions: Record<ModuleKey, AccessLevel>;
  resolvedAt: number;
}

/**
 * Checks if a specific module is unlocked at Layer 1 (Tenant Subscription Tier).
 */
export async function isModuleUnlockedBySubscription(businessId: number, moduleKey: ModuleKey): Promise<boolean> {
  const userRes = await db.query(
    'SELECT license_type, license_expiry FROM users WHERE id = $1',
    [businessId]
  );
  if (userRes.rows.length === 0) return false;

  const licenseType = userRes.rows[0].license_type || 'FREE';
  const licenseExpiry = userRes.rows[0].license_expiry;
  const isExpired = (licenseType === 'STARTER' || licenseType === 'PRO' || licenseType === 'PRO_PLUS') &&
    licenseExpiry && new Date(licenseExpiry) < new Date();

  const activeTier = isExpired ? 'FREE' : licenseType;

  // Tier module gates:
  // PRO, PRO_PLUS, LIFETIME, UNLIMITED unlock all business modules
  if (activeTier === 'PRO' || activeTier === 'PRO_PLUS' || activeTier === 'LIFETIME' || activeTier === 'UNLIMITED') {
    return true;
  }

  // Modules requiring PRO or above:
  if (moduleKey === 'factory' || moduleKey === 'payroll' || moduleKey === 'vendors') {
    return false;
  }

  // Analytics & Reports require PRO or explicit VIP grant
  if (moduleKey === 'reports') {
    const featureAccess = await getUserFeatureAccess(businessId);
    return featureAccess.analytics !== false;
  }

  // AI Notes requires notes_ai permission
  if (moduleKey === 'notes_ai') {
    const featureAccess = await getUserFeatureAccess(businessId);
    return featureAccess.notes_ai !== false;
  }

  // STARTER and FREE have pos, khata, inventory, roznamcha, budget, service_tracker, tools, team_management
  return true;
}

/**
 * Resolves the complete Layer 1 x Layer 2 permission matrix for a user within a business.
 * Layer 1 Ceiling Rule: If Layer 1 locks the module, accessLevel is strictly 'none'.
 */
export async function resolveUserPermissions(
  userId: number,
  businessId: number
): Promise<ResolvedPermissions> {
  // 1. Check if user is the primary business owner
  const userRes = await db.query(
    'SELECT id, role, org_role, organization_id FROM users WHERE id = $1',
    [userId]
  );
  const isOwner = userId === businessId || userRes.rows[0]?.org_role === 'OWNER';

  // Find or create Owner role for this business
  let ownerRoleRes = await db.query(
    `SELECT frontend_id, name FROM roles WHERE business_id = $1 AND is_system_default = true`,
    [businessId]
  );

  let ownerRoleId = ownerRoleRes.rows[0]?.frontend_id;
  if (!ownerRoleId) {
    ownerRoleId = crypto.randomUUID();
    await db.query(`
      INSERT INTO roles (frontend_id, business_id, name, description, is_system_default)
      VALUES ($1, $2, 'Owner', 'Full immutable access to all unlocked modules', true)
      ON CONFLICT (business_id, name) DO NOTHING
    `, [ownerRoleId, businessId]);
  }

  // If user is owner, they always get 'full' on every Layer 1 unlocked module
  if (isOwner) {
    const permissions: Record<ModuleKey, AccessLevel> = {} as Record<ModuleKey, AccessLevel>;
    for (const mod of CANONICAL_MODULES) {
      const unlocked = await isModuleUnlockedBySubscription(businessId, mod.moduleKey);
      permissions[mod.moduleKey] = unlocked ? 'full' : 'none';
    }

    return {
      version: 1,
      userId,
      businessId,
      roleId: ownerRoleId,
      roleName: 'Owner',
      isOwner: true,
      permissions,
      resolvedAt: Date.now(),
    };
  }

  // 2. Non-owner staff member: look up assigned role
  const assignmentRes = await db.query(
    `SELECT ura.role_id, r.name, r.is_system_default
     FROM user_role_assignments ura
     JOIN roles r ON r.frontend_id = ura.role_id
     WHERE ura.user_id = $1 AND ura.business_id = $2 AND r.is_deleted = false`,
    [userId, businessId]
  );

  if (assignmentRes.rows.length === 0) {
    // Unassigned staff: default to 'none' on all modules (closed by default)
    const permissions: Record<ModuleKey, AccessLevel> = {} as Record<ModuleKey, AccessLevel>;
    for (const mod of CANONICAL_MODULES) {
      permissions[mod.moduleKey] = 'none';
    }

    return {
      version: 1,
      userId,
      businessId,
      roleId: '',
      roleName: 'Unassigned',
      isOwner: false,
      permissions,
      resolvedAt: Date.now(),
    };
  }

  const role = assignmentRes.rows[0];
  const roleId = role.role_id;
  const roleName = role.name;

  // 3. Fetch role_module_permissions
  const permRes = await db.query(
    `SELECT module_key, access_level FROM role_module_permissions WHERE role_id = $1`,
    [roleId]
  );

  const rolePermMap = new Map<string, AccessLevel>();
  for (const row of permRes.rows) {
    rolePermMap.set(row.module_key, row.access_level as AccessLevel);
  }

  // 4. Combine with Layer 1 (Ceiling Rule)
  const permissions: Record<ModuleKey, AccessLevel> = {} as Record<ModuleKey, AccessLevel>;
  for (const mod of CANONICAL_MODULES) {
    const isUnlocked = await isModuleUnlockedBySubscription(businessId, mod.moduleKey);
    if (!isUnlocked) {
      // Layer 1 locks it -> strictly none
      permissions[mod.moduleKey] = 'none';
    } else if (role.is_system_default) {
      // System default owner role -> full
      permissions[mod.moduleKey] = 'full';
    } else {
      // Custom role level or default none
      const granted = rolePermMap.get(mod.moduleKey);
      permissions[mod.moduleKey] = (granted && isValidAccessLevel(granted)) ? granted : 'none';
    }
  }

  return {
    version: 1,
    userId,
    businessId,
    roleId,
    roleName,
    isOwner: false,
    permissions,
    resolvedAt: Date.now(),
  };
}

/**
 * List all roles for a business with their permissions and assigned member count.
 */
export async function listRolesForBusiness(businessId: number) {
  const rolesRes = await db.query(
    `SELECT r.id, r.frontend_id, r.name, r.description, r.is_system_default, r.created_at, r.updated_at,
            (SELECT COUNT(*) FROM user_role_assignments ura WHERE ura.role_id = r.frontend_id) as member_count
     FROM roles r
     WHERE r.business_id = $1 AND r.is_deleted = false
     ORDER BY r.is_system_default DESC, r.created_at ASC`,
    [businessId]
  );

  const roles = [];
  for (const row of rolesRes.rows) {
    const permsRes = await db.query(
      `SELECT module_key, access_level FROM role_module_permissions WHERE role_id = $1`,
      [row.frontend_id]
    );

    const permissions: Record<string, AccessLevel> = {};
    for (const p of permsRes.rows) {
      permissions[p.module_key] = p.access_level as AccessLevel;
    }

    roles.push({
      id: row.id,
      syncId: row.frontend_id,
      name: row.name,
      description: row.description,
      isSystemDefault: row.is_system_default,
      memberCount: parseInt(row.member_count, 10),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      permissions,
    });
  }

  return roles;
}

/**
 * Create a new custom role with validated module permissions.
 */
export async function createCustomRole(
  businessId: number,
  actorUserId: number,
  data: {
    name: string;
    description?: string;
    permissions: Record<string, string>;
  }
) {
  const cleanName = data.name?.trim();
  if (!cleanName) throw new Error('Role name is required');
  if (cleanName.toLowerCase() === 'owner') throw new Error('Role name "Owner" is reserved for the system default role');

  // Check unique name
  const existing = await db.query(
    `SELECT id FROM roles WHERE business_id = $1 AND LOWER(name) = LOWER($2) AND is_deleted = false`,
    [businessId, cleanName]
  );
  if (existing.rows.length > 0) {
    throw new Error(`A role named "${cleanName}" already exists for this business`);
  }

  const roleSyncId = crypto.randomUUID();

  await db.query(
    `INSERT INTO roles (frontend_id, business_id, name, description, is_system_default)
     VALUES ($1, $2, $3, $4, false)`,
    [roleSyncId, businessId, cleanName, data.description || null]
  );

  // Seed permissions with validation against canonical catalog
  for (const mod of CANONICAL_MODULES) {
    const rawLevel = data.permissions?.[mod.moduleKey] || 'none';
    if (!isValidAccessLevel(rawLevel)) {
      throw new Error(`Invalid access level "${rawLevel}" for module "${mod.moduleKey}"`);
    }

    await db.query(
      `INSERT INTO role_module_permissions (role_id, module_key, access_level)
       VALUES ($1, $2, $3)`,
      [roleSyncId, mod.moduleKey, rawLevel]
    );
  }

  // Audit log
  await logPermissionAudit(businessId, actorUserId, 'ROLE_CREATED', 'ROLE', roleSyncId, {
    name: cleanName,
    permissions: data.permissions,
  });

  return { syncId: roleSyncId, name: cleanName };
}

/**
 * Update a custom role and its permissions.
 * Prevents editing the immutable system default Owner role.
 */
export async function updateCustomRole(
  businessId: number,
  actorUserId: number,
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissions?: Record<string, string>;
  }
) {
  const roleRes = await db.query(
    `SELECT id, frontend_id, name, is_system_default FROM roles WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
    [roleId, businessId]
  );
  if (roleRes.rows.length === 0) throw new Error('Role not found');

  const role = roleRes.rows[0];
  if (role.is_system_default) {
    throw new Error('System default "Owner" role is immutable and cannot be edited');
  }

  if (data.name && data.name.trim().toLowerCase() === 'owner') {
    throw new Error('Cannot rename role to "Owner"');
  }

  if (data.name) {
    await db.query(
      `UPDATE roles SET name = $1, description = $2, updated_at = NOW() WHERE frontend_id = $3`,
      [data.name.trim(), data.description !== undefined ? data.description : null, roleId]
    );
  }

  if (data.permissions) {
    for (const mod of CANONICAL_MODULES) {
      if (data.permissions[mod.moduleKey] !== undefined) {
        const level = data.permissions[mod.moduleKey];
        if (!isValidAccessLevel(level)) {
          throw new Error(`Invalid access level "${level}" for module "${mod.moduleKey}"`);
        }

        await db.query(
          `INSERT INTO role_module_permissions (role_id, module_key, access_level, updated_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (role_id, module_key) DO UPDATE SET
             access_level = EXCLUDED.access_level,
             updated_at = NOW()`,
          [roleId, mod.moduleKey, level]
        );
      }
    }
  }

  // Session Invalidation: Update role_updated_at & monotonic role_version for all users assigned to this role
  await db.query(
    `UPDATE users SET role_updated_at = NOW(), role_version = COALESCE(role_version, 1) + 1
     WHERE id IN (SELECT user_id FROM user_role_assignments WHERE role_id = $1 AND business_id = $2)`,
    [roleId, businessId]
  );

  await logPermissionAudit(businessId, actorUserId, 'ROLE_UPDATED', 'ROLE', roleId, {
    updatedFields: data,
  });

  return { success: true };
}

/**
 * Soft-delete a custom role.
 * Prevents deleting the immutable system default Owner role.
 */
export async function deleteCustomRole(
  businessId: number,
  actorUserId: number,
  roleId: string
) {
  const roleRes = await db.query(
    `SELECT id, name, is_system_default FROM roles WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
    [roleId, businessId]
  );
  if (roleRes.rows.length === 0) throw new Error('Role not found');

  const role = roleRes.rows[0];
  if (role.is_system_default) {
    throw new Error('System default "Owner" role cannot be deleted');
  }

  // Check if any users are assigned
  const assignedRes = await db.query(
    `SELECT COUNT(*) FROM user_role_assignments WHERE role_id = $1 AND business_id = $2`,
    [roleId, businessId]
  );
  if (parseInt(assignedRes.rows[0].count, 10) > 0) {
    throw new Error('Cannot delete role while members are assigned to it. Please reassign members first.');
  }

  await db.query(
    `UPDATE roles SET is_deleted = true, deleted_at = NOW(), updated_at = NOW() WHERE frontend_id = $1`,
    [roleId]
  );

  await logPermissionAudit(businessId, actorUserId, 'ROLE_DELETED', 'ROLE', roleId, {
    name: role.name,
  });

  return { success: true };
}

/**
 * Assign a user to a dynamic role.
 * Exactly one active role per user per business.
 */
export async function assignUserRole(
  businessId: number,
  actorUserId: number,
  targetUserId: number,
  roleId: string
) {
  // Prevent changing the business owner's role
  if (targetUserId === businessId) {
    throw new Error('The primary business owner must always retain the Owner role');
  }

  const roleRes = await db.query(
    `SELECT frontend_id, name, is_system_default FROM roles WHERE frontend_id = $1 AND business_id = $2 AND is_deleted = false`,
    [roleId, businessId]
  );
  if (roleRes.rows.length === 0) throw new Error('Role not found');

  const role = roleRes.rows[0];
  if (role.is_system_default && targetUserId !== businessId) {
    throw new Error('System default Owner role can only be held by the business owner');
  }

  const assignmentSyncId = crypto.randomUUID();
  await db.query(
    `INSERT INTO user_role_assignments (frontend_id, user_id, role_id, business_id, assigned_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW())
     ON CONFLICT (user_id, business_id) DO UPDATE SET
       role_id = EXCLUDED.role_id,
       assigned_by = EXCLUDED.assigned_by,
       updated_at = NOW()`,
    [assignmentSyncId, targetUserId, roleId, businessId, actorUserId]
  );

  // Session Invalidation: Update target user's role_updated_at & monotonic role_version for immediate mid-session refresh
  await db.query(
    `UPDATE users SET role_updated_at = NOW(), role_version = COALESCE(role_version, 1) + 1 WHERE id = $1`,
    [targetUserId]
  );

  await logPermissionAudit(businessId, actorUserId, 'USER_ROLE_ASSIGNED', 'USER_ASSIGNMENT', String(targetUserId), {
    targetUserId,
    roleId,
    roleName: role.name,
  });

  return { success: true, roleName: role.name };
}

/**
 * List all users in a business with their active role assignment.
 */
export async function listUserAssignments(businessId: number) {
  const usersRes = await db.query(
    `SELECT u.id, u.full_name, u.email, u.account_status, u.role as legacy_role, u.org_role,
            ura.role_id, r.name as role_name, r.is_system_default
     FROM users u
     LEFT JOIN user_role_assignments ura ON ura.user_id = u.id AND ura.business_id = $1
     LEFT JOIN roles r ON r.frontend_id = ura.role_id
     WHERE u.id = $1 OR u.organization_id = (SELECT organization_id FROM users WHERE id = $1 AND organization_id IS NOT NULL)
     ORDER BY (u.id = $1) DESC, u.full_name ASC`,
    [businessId]
  );

  return usersRes.rows.map(row => ({
    userId: row.id,
    fullName: row.full_name,
    email: row.email,
    status: row.account_status,
    isOwner: row.id === businessId || row.org_role === 'OWNER',
    roleId: row.role_id || null,
    roleName: (row.id === businessId || row.org_role === 'OWNER') ? 'Owner' : (row.role_name || 'Unassigned'),
    isSystemDefault: (row.id === businessId || row.org_role === 'OWNER') ? true : !!row.is_system_default,
  }));
}

/**
 * Log an audit event for role and permission changes.
 */
export async function logPermissionAudit(
  businessId: number,
  actorUserId: number,
  action: string,
  targetType: string,
  targetId: string,
  details?: Record<string, unknown>
) {
  const syncId = crypto.randomUUID();
  await db.query(
    `INSERT INTO permission_audit_logs (frontend_id, business_id, actor_user_id, action, target_type, target_id, details)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [syncId, businessId, actorUserId, action, targetType, targetId, details ? JSON.stringify(details) : null]
  );
}

/**
 * List recent audit logs for a business.
 */
export async function getPermissionAuditLogs(businessId: number, limit = 50) {
  const res = await db.query(
    `SELECT pal.id, pal.frontend_id, pal.action, pal.target_type, pal.target_id, pal.details, pal.created_at,
            u.full_name as actor_name, u.email as actor_email
     FROM permission_audit_logs pal
     JOIN users u ON u.id = pal.actor_user_id
     WHERE pal.business_id = $1
     ORDER BY pal.created_at DESC
     LIMIT $2`,
    [businessId, limit]
  );

  return res.rows;
}
