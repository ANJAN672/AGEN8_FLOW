import { create } from 'zustand';

export type SettingsState = {
  apiBaseUrl: string;
  setApiBaseUrl: (v: string) => void;
};

export const useSettings = create<SettingsState>((set) => ({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api',
  setApiBaseUrl: (v) => set({ apiBaseUrl: v || '/api' }),
}));