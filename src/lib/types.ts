export interface Remote {
  name: string;
  type: string;
  parameters?: Record<string, string>;
}

export interface Task {
  id: number;
  name: string;
  local_path: string;
  remote_name: string;
  remote_path: string;
  direction: "upload" | "download" | "bisync";
  filters: string | null;
  conflict_policy: "newer" | "local" | "remote" | "manual";
  auto_sync: boolean;
  sync_interval: number | null;
  is_enabled: boolean;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SyncLog {
  id: number;
  task_id: number;
  task_name?: string;
  direction: string;
  status: "running" | "completed" | "failed" | "cancelled";
  total_files: number;
  transferred_bytes: number;
  added_count: number;
  modified_count: number;
  deleted_count: number;
  error_count: number;
  started_at: string;
  ended_at: string | null;
  log_path: string | null;
}

export interface SyncChange {
  id: number;
  log_id: number;
  file_path: string;
  change_type: "added" | "modified" | "deleted" | "conflict";
  side: "local" | "remote" | null;
  local_size: number | null;
  remote_size: number | null;
  local_modtime: number | null;
  remote_modtime: number | null;
  is_selected: boolean;
  resolved_by: string | null;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
}

export type TaskStatus = "idle" | "scanning" | "syncing" | "completed" | "failed";

export interface TaskRuntimeState {
  task_id: number;
  status: TaskStatus;
  progress: number;
  current_file: string | null;
  speed: number;
  eta: number | null;
  job_id: number | null;
}

export interface RemoteFile {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  mod_time: string;
}

export interface FileTransferResult {
  success: boolean;
  path: string;
  error: string | null;
}
