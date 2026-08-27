"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { AdminThemeProvider } from '@/context/AdminThemeContext';
import { AdminSessionProvider } from '@/context/AdminSessionContext';
import MinimalHeader from '@/components/admin/MinimalHeader';
import MinimalSidebar from '@/components/admin/MinimalSidebar';
import MinimalCustomizerDrawer from '@/components/admin/MinimalCustomizerDrawer';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login';

  // The login page has no session yet, so it renders standalone - wrapping it in
  // AdminSessionProvider would redirect-loop (no session -> redirect to login -> no session -> ...).
  if (isLoginPage) {
    return <AdminThemeProvider>{children}</AdminThemeProvider>;
  }

  return (
    <AdminThemeProvider>
      <AdminSessionProvider>
        <div className="min-h-screen flex bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-gray-100 font-sans antialiased transition-colors">
          {/* Sidebar */}
          <MinimalSidebar />

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <MinimalHeader />

            {/* Page Container */}
            <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
              {children}
            </main>
          </div>

          {/* Customizer Side Drawer */}
          <MinimalCustomizerDrawer />
        </div>
      </AdminSessionProvider>
    </AdminThemeProvider>
  );
}
