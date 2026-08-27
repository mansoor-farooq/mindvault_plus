"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import BannedScreen from "@/components/BannedScreen";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isUnlocked, token, setFeatureAccess } = useAuthStore();
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
      // The single place that decides where a freshly-authenticated user on
      // /login or /register goes next. Login/register pages used to also call
      // router.push() themselves right after calling login() - since that
      // triggers this same effect, the two navigations raced, and this one
      // always won, silently sending every first-time user straight past PIN
      // setup. Centralizing it here (checking user.pin) is what actually fixes it.
      router.replace(user.pin ? "/" : "/lock/setup");
    }
  }, [user, isUnlocked, pathname, router, mounted, isAdminRoute]);

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

  return <>{children}</>;
}
