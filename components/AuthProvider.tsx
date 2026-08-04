"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";

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

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return <div className="h-screen w-full flex items-center justify-center bg-gray-50">Loading...</div>;
  }

  return <>{children}</>;
}
