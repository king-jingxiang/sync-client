import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  Remote,
  Task,
  SyncLog,
  SyncChange,
  AppSetting,
  TaskRuntimeState,
  RemoteFile,
} from "@/lib/types";

// ---- Config / Remote ----
export async function listRemotes(): Promise<string[]> {
  return invoke("list_remotes");
}

export async function getRemoteConfig(name: string): Promise<Remote> {
  return invoke("get_remote_config", { name });
}

export async function createRemote(config: { name: string; type: string; parameters: Record<string, string> }): Promise<void> {
  return invoke("create_remote", { config });
}

export async function deleteRemote(name: string): Promise<void> {
  return invoke("delete_remote", { name });
}

export async function testRemoteConnection(name: string): Promise<{ success: boolean; message: string }> {
  return invoke("test_remote_connection", { name });
}

export async function listRemoteFiles(remoteName: string, path: string): Promise<RemoteFile[]> {
  return invoke("list_remote_files", { remoteName, path });
}

export async function importRcloneConfig(filePath: string): Promise<number> {
  return invoke("import_rclone_config", { filePath });
}

export async function exportRcloneConfig(destPath: string): Promise<void> {
  return invoke("export_rclone_config", { destPath });
}

// ---- Tasks ----
export async function createTask(task: Omit<Task, "id" | "last_sync_at" | "created_at" | "updated_at">): Promise<Task> {
  return invoke("create_task", { task });
}

export async function updateTask(task: Task): Promise<void> {
  return invoke("update_task", { task });
}

export async function deleteTask(taskId: number): Promise<void> {
  return invoke("delete_task", { taskId });
}

export async function listTasks(): Promise<Task[]> {
  return invoke("list_tasks");
}

export async function toggleTask(taskId: number, enabled: boolean): Promise<void> {
  return invoke("toggle_task", { taskId, enabled });
}

// ---- Sync ----
export async function scanDiff(taskId: number): Promise<SyncChange[]> {
  return invoke("scan_diff", { taskId });
}

export async function runTask(taskId: number): Promise<void> {
  return invoke("run_task", { taskId });
}

export async function cancelTask(taskId: number): Promise<void> {
  return invoke("cancel_task", { taskId });
}

export async function applyDiffSelection(logId: number, selections: { changeId: number; isSelected: boolean }[]): Promise<void> {
  return invoke("apply_diff_selection", { logId, selections });
}

// ---- Logs ----
export async function listSyncLogs(taskId?: number, limit?: number): Promise<SyncLog[]> {
  return invoke("list_sync_logs", { taskId, limit: limit ?? 50 });
}

export async function getSyncChanges(logId: number): Promise<SyncChange[]> {
  return invoke("get_sync_changes", { logId });
}

export async function getLogContent(logPath: string): Promise<string> {
  return invoke("get_log_content", { logPath });
}

export async function exportLog(logId: number, destPath: string): Promise<void> {
  return invoke("export_log", { logId, destPath });
}

// ---- Settings ----
export async function getSetting(key: string): Promise<string | null> {
  return invoke("get_setting", { key });
}

export async function setSetting(key: string, value: string): Promise<void> {
  return invoke("set_setting", { key, value });
}

export async function getAllSettings(): Promise<AppSetting[]> {
  return invoke("get_all_settings");
}

// ---- Events ----
export function onTaskProgress(callback: (state: TaskRuntimeState) => void) {
  return listen<TaskRuntimeState>("task-progress", (event) => callback(event.payload));
}

export function onTaskStatusChange(callback: (state: TaskRuntimeState) => void) {
  return listen<TaskRuntimeState>("task-status-change", (event) => callback(event.payload));
}

export function onSyncComplete(callback: (log: SyncLog) => void) {
  return listen<SyncLog>("sync-complete", (event) => callback(event.payload));
}

// ---- Rclone Status ----
export async function getRcloneStatus(): Promise<{ running: boolean; version: string | null }> {
  return invoke("get_rclone_status");
}

export async function startRclone(): Promise<void> {
  return invoke("start_rclone");
}

export async function stopRclone(): Promise<void> {
  return invoke("stop_rclone");
}

// ---- File Dialog ----
export async function pickDirectory(): Promise<string | null> {
  return invoke("pick_directory");
}
