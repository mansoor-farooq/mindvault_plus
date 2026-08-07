import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, db } from '@/lib/db';

interface AuthState {
  user: User | null;
  token: string | null;
  isUnlocked: boolean;
  login: (user: User, token?: string) => void;
  logout: () => void;
  unlock: () => void;
  lock: () => void;
  updateUser: (data: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isUnlocked: false,
      login: (user, token) => set({ user, token: token || null, isUnlocked: true }), 
      logout: () => {
        try {
          db.notes.clear();
          db.ledgerEntries.clear();
          db.udhaar.clear();
          db.bills.clear();
          db.syncStatus.clear();
        } catch (e) {
          console.error('Failed to clear local DB on logout', e);
        }
        set({ user: null, token: null, isUnlocked: false });
      },
      unlock: () => set({ isUnlocked: true }),
      lock: () => set({ isUnlocked: false }),
      updateUser: (data) => set((state) => ({ user: state.user ? { ...state.user, ...data } : null })),
    }),
    {
      name: 'mindvault-auth',
    }
  )
);
