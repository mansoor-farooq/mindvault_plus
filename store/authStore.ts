import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, db } from '@/lib/db';

interface AuthState {
  user: User | null;
  token: string | null;
  isUnlocked: boolean;
  shopModeEnabled: boolean;
  login: (user: User, token?: string) => void;
  logout: () => void;
  unlock: () => void;
  lock: () => void;
  toggleShopMode: () => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isUnlocked: false,
      shopModeEnabled: true,
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
        set({ user: null, token: null, isUnlocked: false });
      },
      unlock: () => set({ isUnlocked: true }),
      lock: () => set({ isUnlocked: false }),
      toggleShopMode: () => set((state) => ({ shopModeEnabled: !state.shopModeEnabled })),
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
    }),
    {
      name: 'mindvault-auth',
    }
  )
);
