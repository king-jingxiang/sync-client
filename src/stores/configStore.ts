import { create } from "zustand";
import type { Remote, Task, TaskRuntimeState } from "@/lib/types";
import * as api from "@/lib/api";

interface ConfigStore {
  remotes: Remote[];
  loading: boolean;
  error: string | null;
  fetchRemotes: () => Promise<void>;
  createRemote: (config: { name: string; type: string; parameters: Record<string, string> }) => Promise<void>;
  deleteRemote: (name: string) => Promise<void>;
  testConnection: (name: string) => Promise<{ success: boolean; message: string }>;
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  remotes: [],
  loading: false,
  error: null,

  fetchRemotes: async () => {
    set({ loading: true, error: null });
    try {
      const names = await api.listRemotes();
      const remotes: Remote[] = await Promise.all(
        names.map(async (name) => {
          try {
            const config = await api.getRemoteConfig(name);
            return Object.assign({ name }, config);
          } catch {
            return { name, type: "unknown" };
          }
        })
      );
      set({ remotes, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createRemote: async (config) => {
    try {
      await api.createRemote(config);
      await get().fetchRemotes();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  deleteRemote: async (name) => {
    try {
      await api.deleteRemote(name);
      await get().fetchRemotes();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  testConnection: async (name) => {
    try {
      return await api.testRemoteConnection(name);
    } catch (e) {
      return { success: false, message: String(e) };
    }
  },
}));
