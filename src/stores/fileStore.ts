import { create } from "zustand";
import type { RemoteFile, FileTransferResult } from "@/lib/types";
import * as api from "@/lib/api";

interface TransferProgress {
  current: number;
  total: number;
  currentFile: string;
}

interface FileStore {
  // Navigation state
  currentRemote: string | null;
  currentPath: string;

  // File list
  files: RemoteFile[];
  loading: boolean;
  error: string | null;

  // Pagination
  page: number;
  pageSize: number;

  // Selection
  selectedPaths: Set<string>;

  // Transfer state
  transferring: boolean;
  transferProgress: TransferProgress | null;

  // Actions
  browse: (remoteName: string, path: string) => Promise<void>;
  navigateToFolder: (folder: RemoteFile) => Promise<void>;
  navigateUp: () => Promise<void>;
  navigateToPathIndex: (index: number) => Promise<void>;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  toggleSelection: (path: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  uploadFiles: (localPaths: string[]) => Promise<FileTransferResult[]>;
  downloadSelected: (localDir: string) => Promise<FileTransferResult[]>;
  deleteSelected: () => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useFileStore = create<FileStore>((set, get) => ({
  currentRemote: null,
  currentPath: "",
  files: [],
  loading: false,
  error: null,
  page: 1,
  pageSize: 50,
  selectedPaths: new Set(),
  transferring: false,
  transferProgress: null,

  browse: async (remoteName: string, path: string) => {
    set({ loading: true, error: null, currentRemote: remoteName, currentPath: path, page: 1, selectedPaths: new Set() });
    try {
      const files = await api.browseRemoteFiles(remoteName, path);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false, files: [] });
    }
  },

  navigateToFolder: async (folder: RemoteFile) => {
    const { currentRemote } = get();
    if (!currentRemote) return;
    const newPath = folder.path;
    set({ loading: true, error: null, currentPath: newPath, page: 1, selectedPaths: new Set() });
    try {
      const files = await api.browseRemoteFiles(currentRemote, newPath);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false, files: [] });
    }
  },

  navigateUp: async () => {
    const { currentRemote, currentPath } = get();
    if (!currentRemote) return;
    if (!currentPath || currentPath === "" || currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    const newPath = parts.join("/");
    set({ loading: true, error: null, currentPath: newPath, page: 1, selectedPaths: new Set() });
    try {
      const files = await api.browseRemoteFiles(currentRemote, newPath);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false, files: [] });
    }
  },

  navigateToPathIndex: async (index: number) => {
    const { currentRemote, currentPath } = get();
    if (!currentRemote) return;
    const parts = currentPath.split("/").filter(Boolean);
    const newPath = parts.slice(0, index + 1).join("/");
    set({ loading: true, error: null, currentPath: newPath, page: 1, selectedPaths: new Set() });
    try {
      const files = await api.browseRemoteFiles(currentRemote, newPath);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false, files: [] });
    }
  },

  setPage: (page: number) => set({ page }),
  setPageSize: (size: number) => set({ pageSize: size, page: 1 }),

  toggleSelection: (path: string) => {
    const { selectedPaths } = get();
    const newSet = new Set(selectedPaths);
    if (newSet.has(path)) {
      newSet.delete(path);
    } else {
      newSet.add(path);
    }
    set({ selectedPaths: newSet });
  },

  selectAll: () => {
    const { files, page, pageSize } = get();
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageFiles = files.slice(start, end);
    const newSet = new Set(pageFiles.map((f) => f.path));
    set({ selectedPaths: newSet });
  },

  clearSelection: () => set({ selectedPaths: new Set() }),

  uploadFiles: async (localPaths: string[]) => {
    const { currentRemote, currentPath } = get();
    if (!currentRemote) throw new Error("No remote selected");

    set({ transferring: true, transferProgress: { current: 0, total: localPaths.length, currentFile: "" } });

    try {
      // Process files one by one to track progress
      const results: FileTransferResult[] = [];
      for (let i = 0; i < localPaths.length; i++) {
        const fileName = localPaths[i].split(/[/\\]/).pop() || localPaths[i];
        set({ transferProgress: { current: i, total: localPaths.length, currentFile: fileName } });

        const batchResults = await api.uploadLocalFiles([localPaths[i]], currentRemote, currentPath);
        results.push(...batchResults);
      }
      set({ transferProgress: { current: localPaths.length, total: localPaths.length, currentFile: "" } });

      // Refresh file list
      await get().refresh();
      return results;
    } finally {
      set({ transferring: false, transferProgress: null });
    }
  },

  downloadSelected: async (localDir: string) => {
    const { currentRemote, selectedPaths, files } = get();
    if (!currentRemote || selectedPaths.size === 0) throw new Error("No files selected");

    const selectedFiles = files.filter((f) => selectedPaths.has(f.path) && !f.is_dir);
    const filePaths = selectedFiles.map((f) => f.path);

    set({ transferring: true, transferProgress: { current: 0, total: filePaths.length, currentFile: "" } });

    try {
      const results = await api.downloadRemoteFiles(currentRemote, filePaths, localDir);
      set({ transferProgress: { current: filePaths.length, total: filePaths.length, currentFile: "" } });
      return results;
    } finally {
      set({ transferring: false, transferProgress: null });
    }
  },

  deleteSelected: async () => {
    const { currentRemote, selectedPaths, files } = get();
    if (!currentRemote || selectedPaths.size === 0) return;

    const selectedItems = files.filter((f) => selectedPaths.has(f.path));
    set({ transferring: true, transferProgress: { current: 0, total: selectedItems.length, currentFile: "" } });

    try {
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        set({ transferProgress: { current: i, total: selectedItems.length, currentFile: item.name } });
        await api.deleteRemoteItem(currentRemote, item.path, item.is_dir);
      }
      set({ transferProgress: { current: selectedItems.length, total: selectedItems.length, currentFile: "" } });
      set({ selectedPaths: new Set() });
      await get().refresh();
    } finally {
      set({ transferring: false, transferProgress: null });
    }
  },

  createFolder: async (name: string) => {
    const { currentRemote, currentPath } = get();
    if (!currentRemote) throw new Error("No remote selected");

    await api.createRemoteFolder(currentRemote, currentPath, name);
    await get().refresh();
  },

  refresh: async () => {
    const { currentRemote, currentPath } = get();
    if (!currentRemote) return;

    set({ loading: true, error: null });
    try {
      const files = await api.browseRemoteFiles(currentRemote, currentPath);
      set({ files, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },
}));
