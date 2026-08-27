'use client';
import { usePathname } from 'next/navigation';
import AppSidebar from './AppSidebar';

// Routes that keep their own full-bleed layout (admin has its own sidebar/theme, auth/lock
// screens are deliberately chrome-free) - the consumer sidebar never renders on these.
const EXCLUDED_PREFIXES = ['/admin', '/login', '/register', '/lock'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isExcluded = EXCLUDED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (isExcluded) {
    return <>{children}</>;
  }

  return (
    <div className="lg:flex">
      <AppSidebar />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
