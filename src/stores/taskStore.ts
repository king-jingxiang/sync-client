import { create } from "zustand";
import type { Task, TaskRuntimeState } from "@/lib/types";
import * as api from "@/lib/api";

interface TaskStore {
  tasks: Task[];
  runtimeStates: Map<number, TaskRuntimeState>;
  loading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  createTask: (task: Omit<Task, "id" | "last_sync_at" | "created_at" | "updated_at">) => Promise<Task>;
  updateTask: (task: Task) => Promise<void>;
  deleteTask: (taskId: number) => Promise<void>;
  toggleTask: (taskId: number, enabled: boolean) => Promise<void>;
  runTask: (taskId: number) => Promise<void>;
  cancelTask: (taskId: number) => Promise<void>;
  updateRuntimeState: (state: TaskRuntimeState) => void;
  getTaskRuntimeState: (taskId: number) => TaskRuntimeState | undefined;
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  runtimeStates: new Map(),
  loading: false,
  error: null,

  fetchTasks: async () => {
    set({ loading: true, error: null });
    try {
      const tasks = await api.listTasks();
      set({ tasks, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  createTask: async (task) => {
    try {
      const created = await api.createTask(task);
      await get().fetchTasks();
      return created;
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  updateTask: async (task) => {
    try {
      await api.updateTask(task);
      await get().fetchTasks();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  deleteTask: async (taskId) => {
    try {
      await api.deleteTask(taskId);
      await get().fetchTasks();
    } catch (e) {
      set({ error: String(e) });
      throw e;
    }
  },

  toggleTask: async (taskId, enabled) => {
    try {
      await api.toggleTask(taskId, enabled);
      await get().fetchTasks();
    } catch (e) {
      set({ error: String(e) });
    }
  },

  runTask: async (taskId) => {
    try {
      await api.runTask(taskId);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  cancelTask: async (taskId) => {
    try {
      await api.cancelTask(taskId);
    } catch (e) {
      set({ error: String(e) });
    }
  },

  updateRuntimeState: (state) => {
    set((prev) => {
      const newMap = new Map(prev.runtimeStates);
      newMap.set(state.task_id, state);
      return { runtimeStates: newMap };
    });
  },

  getTaskRuntimeState: (taskId) => {
    return get().runtimeStates.get(taskId);
  },
}));
