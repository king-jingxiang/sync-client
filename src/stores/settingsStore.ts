import { create } from "zustand";
import * as api from "@/lib/api";

interface SettingsStore {
  settings: Record<string, string>;
  loading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  getSetting: (key: string) => string | undefined;
  setSetting: (key: string, value: string) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const list = await api.getAllSettings();
      const map: Record<string, string> = {};
      for (const s of list) {
        map[s.key] = s.value;
      }
      set({ settings: map, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  getSetting: (key) => {
    return get().settings[key];
  },

  setSetting: async (key, value) => {
    try {
      await api.setSetting(key, value);
      set((prev) => ({ settings: { ...prev.settings, [key]: value } }));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
