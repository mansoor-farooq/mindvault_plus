export class AdminApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new AdminApiError(res.status, body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface AdminMe {
  id: number;
  name: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
}

export interface DashboardStats {
  totalUsers: number;
  totalNotes: number;
  totalLedgerEntries: number;
  totalKhataCustomers: number;
  licenseBreakdown: { FREE: number; PRO: number; LIFETIME: number };
  statusBreakdown: { ACTIVE: number; BANNED: number; SUSPENDED: number };
  signupsLast7Days: { date: string; count: number }[];
}

export interface AdminUserRow {
  id: number;
  full_name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'SUPER_ADMIN';
  account_status: 'ACTIVE' | 'BANNED' | 'SUSPENDED';
  license_type: 'FREE' | 'PRO' | 'LIFETIME';
  license_expiry: string | null;
  business_type: 'RETAIL_SHOP' | 'MANUFACTURING' | 'RESTAURANT' | 'WHOLESALE' | 'OTHER' | null;
  account_type: 'INDIVIDUAL' | 'ORGANIZATION' | null;
  organization_id: number | null;
  org_role: 'OWNER' | 'MEMBER' | null;
  created_at: string;
}

export interface AuditLogRow {
  id: number;
  action: string;
  details: string;
  created_at: string;
  admin_name: string | null;
  admin_email: string | null;
  target_name: string | null;
  target_email: string | null;
}

export const adminApi = {
  login: (email: string, password: string) =>
    adminFetch<{ success: boolean; redirect: string }>('/admin/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  logout: () => adminFetch<{ success: boolean }>('/admin/api/logout', { method: 'POST' }),
  me: () => adminFetch<AdminMe>('/admin/api/me'),
  dashboardStats: () => adminFetch<DashboardStats>('/admin/api/dashboard-stats'),
  auditLogs: (limit = 50, offset = 0) =>
    adminFetch<{ logs: AuditLogRow[]; total: number }>(`/admin/api/audit-logs?limit=${limit}&offset=${offset}`),
  users: () => adminFetch<{ users: AdminUserRow[] }>('/admin/api/users'),
  updateUserStatus: (id: number, status: 'ACTIVE' | 'BANNED' | 'SUSPENDED') =>
    adminFetch<{ success: boolean }>(`/admin/api/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  updateUserLicense: (id: number, license_type: 'FREE' | 'PRO' | 'LIFETIME', duration_days?: number) =>
    adminFetch<{ success: boolean }>(`/admin/api/users/${id}/license`, {
      method: 'POST',
      body: JSON.stringify({ license_type, duration_days }),
    }),
  featureAccess: (id: number) => adminFetch<{ access: Record<string, boolean> }>(`/admin/api/users/${id}/feature-access`),
  updateFeatureAccess: (id: number, featureKey: string, isEnabled: boolean) =>
    adminFetch<{ success: boolean; access: Record<string, boolean> }>(`/admin/api/users/${id}/feature-access`, {
      method: 'POST',
      body: JSON.stringify({ featureKey, isEnabled }),
    }),
};
