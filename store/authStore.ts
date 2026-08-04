import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/lib/db';

interface AuthState {
  user: User | null;
  isUnlocked: boolean;
  login: (user: User) => void;
  logout: () => void;
  unlock: () => void;
  lock: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isUnlocked: false, // Initially false, needs PIN to unlock if user exists
      login: (user) => set({ user, isUnlocked: true }), 
      logout: () => set({ user: null, isUnlocked: false }),
      unlock: () => set({ isUnlocked: true }),
      lock: () => set({ isUnlocked: false }),
    }),
    {
      name: 'mindvault-auth',
    }
  )
);
