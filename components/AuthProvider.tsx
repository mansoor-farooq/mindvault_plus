"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import { normalizeEmail } from "@/lib/utils";
import BannedScreen from "@/components/BannedScreen";
import { SyncRejectionBanner } from "@/components/SyncRejectionBanner";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isUnlocked, token, setFeatureAccess, featureAccess } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // The admin panel (/admin/*) has its own independent session-cookie auth
  // (adminAuth middleware + AdminSessionProvider) - it must never be subject
  // to the consumer app's JWT/PIN-lock guard below, or every /admin route
  // gets bounced to the consumer /login before the admin code ever runs.
  const isAdminRoute = pathname.startsWith("/admin");

  useEffect(() => {
    if (!mounted || isAdminRoute) return;

    const publicPaths = ["/login", "/register"];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      router.replace("/login");
    } else if (user && !isUnlocked && pathname !== "/lock" && !isPublicPath) {
      router.replace("/lock");
    } else if (user && isUnlocked && isPublicPath) {
      router.replace(user.pin ? "/" : "/lock/setup");
    } else if (user && isUnlocked && !isPublicPath) {
      // ----------------------------------------------------------------------
      // DYNAMIC LAYER 2 ROUTE GUARD
      // ----------------------------------------------------------------------
      let userPerms: Record<string, string> | null = null;
      let isOwner = user.role === 'ADMIN' || user.role === 'OWNER' || user.accountType === 'INDIVIDUAL' || !(user as any).organizationId;
      
      const cleanEmail = normalizeEmail(user.email);
      if (typeof window !== 'undefined' && cleanEmail) {
        try {
          const cached = localStorage.getItem(`mindvault_perms_${cleanEmail}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            userPerms = parsed.permissions;
            if (parsed.isOwner !== undefined) isOwner = parsed.isOwner;
          }
        } catch {}
      }

      if (!isOwner && userPerms) {
        const routeModuleMap: { prefix: string; module: string }[] = [
          { prefix: '/erp', module: 'pos' },
          { prefix: '/quotes', module: 'pos' },
          { prefix: '/invoice-builder', module: 'pos' },
          { prefix: '/services', module: 'service_tracker' },
          { prefix: '/khata', module: 'khata' },
          { prefix: '/vendors', module: 'vendors' },
          { prefix: '/inventory', module: 'inventory' },
          { prefix: '/categories', module: 'inventory' },
          { prefix: '/locations', module: 'inventory' },
          { prefix: '/production', module: 'factory' },
          { prefix: '/staff', module: 'payroll' },
          { prefix: '/budget', module: 'budget' },
          { prefix: '/gulluck', module: 'budget' },
          { prefix: '/kameti', module: 'budget' },
          { prefix: '/pnl', module: 'reports' },
          { prefix: '/reports', module: 'reports' },
          { prefix: '/analytics', module: 'reports' },
          { prefix: '/finance', module: 'roznamcha' },
          { prefix: '/notes', module: 'notes_ai' },
          { prefix: '/tools', module: 'tools' },
          { prefix: '/tasks', module: 'tools' },
          { prefix: '/sale-alerts', module: 'tools' },
          { prefix: '/settings/team', module: 'team_management' },
          { prefix: '/settings/roles', module: 'team_management' },
        ];

        for (const { prefix, module } of routeModuleMap) {
          if (pathname.startsWith(prefix) && userPerms[module] === 'none') {
            router.replace('/');
            return;
          }
        }
      }

      // ----------------------------------------------------------------------
      // LAYER 1: FEATURE TOGGLE/VIP ROUTE GUARD (Client-Side)
      // ----------------------------------------------------------------------
      if (featureAccess) {
        const featureRoutes = [
          { prefix: '/khata', feature: 'khata' },
          { prefix: '/inventory', feature: 'inventory' },
          { prefix: '/finance', feature: 'finance' },
          { prefix: '/notes', feature: 'notes_ai' },
        ];
        
        for (const { prefix, feature } of featureRoutes) {
          if (pathname.startsWith(prefix) && featureAccess[feature] === false) {
            router.replace('/');
            return;
          }
        }
      }
    }
  }, [user, isUnlocked, pathname, router, mounted, isAdminRoute, featureAccess]);

  useEffect(() => {
    if (!token || !mounted) return;
    // Fetch which features this user is allowed to use (admin-controlled per-user
    // toggles/VIP grants) - refetched alongside the periodic sync below so an
    // admin's change is picked up within a few minutes, not just at next login.
    const fetchFeatureAccess = async () => {
      try {
        const res = await fetch('/api/user/feature-access', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setFeatureAccess(data.access);
        }
      } catch {
        // offline or transient error - keep whatever access map we already have
      }
    };
    fetchFeatureAccess();
    const featureAccessInterval = setInterval(fetchFeatureAccess, 5 * 60 * 1000);
    return () => clearInterval(featureAccessInterval);
  }, [token, mounted, setFeatureAccess]);

  useEffect(() => {
    if (user && mounted) {
      // Periodic check for account status (ban/unban)
      const checkStatus = async () => {
        try {
          const res = await fetch(`/api/auth/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.status && data.status !== user.status) {
              // Update local state immediately
              useAuthStore.getState().updateUser({ status: data.status });
              
              // Also update indexedDB so BANNED/ACTIVE status is persisted properly
              import('@/lib/db').then(({ db }) => {
                db.users.where('email').equalsIgnoreCase(user.email).modify({ status: data.status }).catch(() => {});
              });
            }
          }
        } catch (e) {
          // ignore network errors if offline
        }
      };

      const statusInterval = setInterval(checkStatus, 5000); // Check every 5 seconds for instant response

      // Auto-sync every 5 minutes
      const syncInterval = setInterval(() => {
        if (isUnlocked) {
          import('@/services/SyncService').then(m => m.SyncService.sync());
        }
      }, 5 * 60 * 1000);
      
      return () => {
        clearInterval(statusInterval);
        clearInterval(syncInterval);
      };
    }
  }, [user?.email, user?.status, user?.id, isUnlocked, mounted]);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return <div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  // Global Ban Enforcement: render BannedScreen for any protected route if status is BANNED
  if (!isAdminRoute && user && user.status === 'BANNED' && pathname !== '/login' && pathname !== '/register') {
    return <BannedScreen />;
  }

  return (
    <>
      {children}
      <SyncRejectionBanner />
    </>
  );
}
