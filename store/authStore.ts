import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, db } from '@/lib/db';

interface AuthState {
  user: User | null;
  token: string | null;
  isUnlocked: boolean;
  shopModeEnabled: boolean;
  // null = not fetched yet (treat everything as allowed to avoid flashing/hiding
  // tools before the first fetch completes); an object = the merged access map.
  featureAccess: Record<string, boolean> | null;
  login: (user: User, token?: string) => void;
  logout: () => void;
  unlock: () => void;
  lock: () => void;
  toggleShopMode: () => void;
  updateUser: (data: Partial<User>) => void;
  setFeatureAccess: (access: Record<string, boolean>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isUnlocked: false,
      shopModeEnabled: true,
      featureAccess: null,
      login: (user, token) => set({ user, token: token || null, isUnlocked: true }),
      logout: () => {
        try {
          db.notes.clear();
          db.ledgerEntries.clear();
          db.udhaar.clear();
          db.bills.clear();
          db.syncStatus.clear();
          db.khataCustomers.clear();
          db.khataTransactions.clear();
        } catch (e) {
          console.error('Failed to clear local DB on logout', e);
        }
        set({ user: null, token: null, isUnlocked: false, featureAccess: null });
      },
      unlock: () => set({ isUnlocked: true }),
      lock: () => set({ isUnlocked: false }),
      toggleShopMode: () => set((state) => ({ shopModeEnabled: !state.shopModeEnabled })),
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
      setFeatureAccess: (access) => set({ featureAccess: access }),
    }),
    {
      name: 'mindvault-auth',
    }
  )
);
