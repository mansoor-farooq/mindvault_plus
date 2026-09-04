'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/store/authStore';
import { normalizeEmail } from '@/lib/utils';
import { CanonicalModuleKey, AccessLevel, isAccessSufficient } from '@/lib/permissions/canonicalModules';

export interface UserPermissionMatrix {
  userId: number;
  businessId: number;
  isOwner: boolean;
  roleId: string | null;
  roleName: string;
  permissions: Record<CanonicalModuleKey, AccessLevel>;
  resolvedAt: string;
}

export function usePermissions() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const cleanEmail = normalizeEmail(user?.email);

  const [perms, setPerms] = useState<UserPermissionMatrix | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadCachedPermissions = useCallback(() => {
    if (!cleanEmail || typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem(`mindvault_perms_${cleanEmail}`);
      if (cached) {
        return JSON.parse(cached) as UserPermissionMatrix;
      }
    } catch (e) {
      console.warn('Failed to parse cached permissions:', e);
    }
    return null;
  }, [cleanEmail]);

  const fetchLivePermissions = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/roles/my-permissions', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (res.ok) {
        const data: UserPermissionMatrix = await res.json();
        setPerms(data);
        if (cleanEmail && typeof window !== 'undefined') {
          localStorage.setItem(`mindvault_perms_${cleanEmail}`, JSON.stringify(data));
        }
      }
    } catch (err) {
      console.warn('Failed to fetch live permissions, falling back to cache:', err);
    } finally {
      setLoading(false);
    }
  }, [token, cleanEmail]);

  useEffect(() => {
    // 1. Instant hydration from cache to prevent UI flash
    const cached = loadCachedPermissions();
    if (cached) {
      setPerms(cached);
      setLoading(false);
    }

    // 2. Fetch live to check role_updated_at invalidation
    fetchLivePermissions();

    // 3. Listen to cross-system updates
    const handlePermissionsUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<UserPermissionMatrix>;
      if (customEvent.detail) {
        setPerms(customEvent.detail);
      } else {
        fetchLivePermissions();
      }
    };

    window.addEventListener('permissions:updated', handlePermissionsUpdated);
    return () => {
      window.removeEventListener('permissions:updated', handlePermissionsUpdated);
    };
  }, [loadCachedPermissions, fetchLivePermissions]);

  const hasAccess = useCallback(
    (moduleKey: CanonicalModuleKey, minLevel: AccessLevel = 'view'): boolean => {
      if (!perms) return false;
      if (perms.isOwner) return true;
      const userLevel = perms.permissions[moduleKey] || 'none';
      return isAccessSufficient(userLevel, minLevel);
    },
    [perms]
  );

  const canView = useCallback(
    (moduleKey: CanonicalModuleKey): boolean => hasAccess(moduleKey, 'view'),
    [hasAccess]
  );

  const canEdit = useCallback(
    (moduleKey: CanonicalModuleKey): boolean => hasAccess(moduleKey, 'full'),
    [hasAccess]
  );

  return {
    permissions: perms?.permissions || ({} as Record<CanonicalModuleKey, AccessLevel>),
    matrix: perms,
    isOwner: perms?.isOwner ?? false,
    roleName: perms?.roleName || 'Loading...',
    loading,
    hasAccess,
    canView,
    canEdit,
    refresh: fetchLivePermissions
  };
}
