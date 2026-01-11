import { create } from 'zustand';
import type { Account } from './types';

interface Store {
  accounts: Account[];
  connected: boolean;
  loading: boolean;
  error: string | null;
  lastUpdate: number;
  setAccounts: (accounts: Account[]) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useStore = create<Store>((set) => ({
  accounts: [],
  connected: false,
  loading: true,
  error: null,
  lastUpdate: 0,
  setAccounts: (accounts) => set({ accounts, lastUpdate: Date.now(), loading: false }),
  setConnected: (connected) => set({ connected }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}));
