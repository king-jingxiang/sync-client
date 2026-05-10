import { create } from "zustand";
import type { SyncLog, SyncChange } from "@/lib/types";
import * as api from "@/lib/api";

interface LogStore {
  logs: SyncLog[];
  currentChanges: SyncChange[];
  loading: boolean;
  error: string | null;
  fetchLogs: (taskId?: number, limit?: number) => Promise<void>;
  fetchChanges: (logId: number) => Promise<void>;
  getLogContent: (logPath: string) => Promise<string>;
}

export const useLogStore = create<LogStore>((set) => ({
  logs: [],
  currentChanges: [],
  loading: false,
  error: null,

  fetchLogs: async (taskId, limit) => {
    set({ loading: true, error: null });
    try {
      const logs = await api.listSyncLogs(taskId, limit);
      set({ logs, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  fetchChanges: async (logId) => {
    set({ loading: true, error: null });
    try {
      const changes = await api.getSyncChanges(logId);
      set({ currentChanges: changes, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  getLogContent: async (logPath) => {
    try {
      return await api.getLogContent(logPath);
    } catch (e) {
      set({ error: String(e) });
      return "";
    }
  },
}));
