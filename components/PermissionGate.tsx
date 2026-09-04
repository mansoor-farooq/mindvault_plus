'use client';

import React, { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { CanonicalModuleKey, AccessLevel, CANONICAL_MODULES } from '@/lib/permissions/canonicalModules';
import { ShieldAlert } from 'lucide-react';

interface PermissionGateProps {
  moduleKey: CanonicalModuleKey;
  minLevel?: AccessLevel;
  fallback?: ReactNode;
  showLockNotice?: boolean;
  children: ReactNode;
}

export function PermissionGate({
  moduleKey,
  minLevel = 'view',
  fallback = null,
  showLockNotice = false,
  children
}: PermissionGateProps) {
  const { hasAccess, loading, roleName } = usePermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-muted-foreground animate-pulse">
        Checking permissions...
      </div>
    );
  }

  const allowed = hasAccess(moduleKey, minLevel);

  if (allowed) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showLockNotice) {
    const moduleDef = CANONICAL_MODULES.find((m) => m.key === moduleKey);
    const moduleName = moduleDef?.displayName || moduleKey;

    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card rounded-2xl border border-border shadow-sm text-center max-w-md mx-auto my-8">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-500 mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground mb-1">Access Restricted</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Aap ke role (<span className="font-semibold text-foreground">{roleName}</span>) ke paas <span className="font-semibold text-foreground">{moduleName}</span> module ka access nahi hai.
        </p>
        <p className="text-xs text-muted-foreground">
          Agar aapko is module ki zaroorat hai toh apne business owner se rabta karein.
        </p>
      </div>
    );
  }

  return null;
}
