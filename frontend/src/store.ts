import { create } from 'zustand';
import type { Account } from './types';

interface Store {
  accounts: Account[];
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  setAccounts: (accounts: Account[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<Store>((set) => ({
  accounts: [],
  loading: true,
  error: null,
  lastUpdate: 0,
  setAccounts: (accounts) => set({ accounts, lastUpdate: Date.now(), loading: false }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
