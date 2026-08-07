"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

import BannedScreen from "@/components/BannedScreen";

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isUnlocked } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const publicPaths = ["/login", "/register"];
    const isPublicPath = publicPaths.includes(pathname);

    if (!user && !isPublicPath) {
      router.replace("/login");
    } else if (user && !isUnlocked && pathname !== "/lock" && !isPublicPath) {
      router.replace("/lock");
    } else if (user && isUnlocked && isPublicPath) {
      router.replace("/");
    }
  }, [user, isUnlocked, pathname, router, mounted]);

  useEffect(() => {
    if (user && mounted) {
      // Periodic check for account status (ban/unban)
      const checkStatus = async () => {
        try {
          const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
          const res = await fetch(`${BACKEND_URL}/api/auth/status`, {
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
  if (user && user.status === 'BANNED' && pathname !== '/login' && pathname !== '/register') {
    return <BannedScreen />;
  }

  return <>{children}</>;
}
