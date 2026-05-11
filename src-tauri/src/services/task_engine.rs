use std::collections::HashMap;
use std::sync::Arc;
use tauri::Emitter;

use crate::db::Database;
use crate::models::*;
use crate::services::rclone_mgr::RcloneMgr;

#[derive(Debug, Clone, PartialEq)]
pub enum TaskState {
    Idle,
    Scanning,
    Syncing,
    Completed,
    Failed,
}

pub struct TaskEngine {
    db: Arc<Database>,
    rclone: Arc<RcloneMgr>,
    runtime_states: std::sync::Mutex<HashMap<i64, TaskRuntimeState>>,
}

impl TaskEngine {
    pub fn new(db: Arc<Database>, rclone: Arc<RcloneMgr>) -> Self {
        Self {
            db,
            rclone,
            runtime_states: std::sync::Mutex::new(HashMap::new()),
        }
    }

    pub fn get_runtime_state(&self, task_id: i64) -> Option<TaskRuntimeState> {
        self.runtime_states
            .lock()
            .unwrap()
            .get(&task_id)
            .cloned()
    }

    pub fn get_all_runtime_states(&self) -> Vec<TaskRuntimeState> {
        self.runtime_states
            .lock()
            .unwrap()
            .values()
            .cloned()
            .collect()
    }

    pub fn scan_diff(&self, task_id: i64) -> Result<Vec<SyncChange>, String> {
        let task = self
            .db
            .get_task(task_id)?
            .ok_or("Task not found")?;

        self.update_state(task_id, TaskState::Scanning, 0.0, None, 0.0, None, None);

        let (src_fs, dst_fs) = match task.direction.as_str() {
            "upload" => (
                task.local_path.clone(),
                format!("{}:{}", task.remote_name, task.remote_path),
            ),
            "download" => (
                format!("{}:{}", task.remote_name, task.remote_path),
                task.local_path.clone(),
            ),
            "bisync" => (
                task.local_path.clone(),
                format!("{}:{}", task.remote_name, task.remote_path),
            ),
            _ => return Err("Invalid direction".to_string()),
        };

        log::info!("scan_diff: listing src_fs={}", src_fs);
        let src_files = self.rclone.list_all_files(&src_fs)?;
        log::info!("scan_diff: listing dst_fs={}", dst_fs);
        let dst_files = self.rclone.list_all_files(&dst_fs)?;

        log::info!("scan_diff: src_files={}, dst_files={}", src_files.len(), dst_files.len());

        // Create a sync_log entry for this scan
        let now = chrono::Utc::now().to_rfc3339();
        let log_id = self.db.create_sync_log(&NewSyncLog {
            task_id,
            direction: task.direction.clone(),
            status: "running".to_string(),
            started_at: now,
        })?;

        // Compare file lists to find differences
        let mut changes = Vec::new();

        // Files in src but not in dst => added
        for (path, entry) in &src_files {
            if !dst_files.contains_key(path) {
                let (local_size, remote_size, local_modtime, remote_modtime, side) =
                    match task.direction.as_str() {
                        "upload" | "bisync" => (
                            Some(entry.size),
                            None,
                            entry.mod_time,
                            None,
                            Some("local".to_string()),
                        ),
                        "download" => (
                            None,
                            Some(entry.size),
                            None,
                            entry.mod_time,
                            Some("remote".to_string()),
                        ),
                        _ => (None, None, None, None, None),
                    };
                changes.push(NewSyncChange {
                    log_id,
                    file_path: path.clone(),
                    change_type: "added".to_string(),
                    side,
                    local_size,
                    remote_size,
                    local_modtime,
                    remote_modtime,
                });
            }
        }

        // Files in dst but not in src => deleted
        for (path, entry) in &dst_files {
            if !src_files.contains_key(path) {
                let (local_size, remote_size, local_modtime, remote_modtime, side) =
                    match task.direction.as_str() {
                        "upload" | "bisync" => (
                            None,
                            Some(entry.size),
                            None,
                            entry.mod_time,
                            Some("remote".to_string()),
                        ),
                        "download" => (
                            Some(entry.size),
                            None,
                            entry.mod_time,
                            None,
                            Some("local".to_string()),
                        ),
                        _ => (None, None, None, None, None),
                    };
                changes.push(NewSyncChange {
                    log_id,
                    file_path: path.clone(),
                    change_type: "deleted".to_string(),
                    side,
                    local_size,
                    remote_size,
                    local_modtime,
                    remote_modtime,
                });
            }
        }

        // Files in both but possibly modified or conflicting
        for (path, src_entry) in &src_files {
            if let Some(dst_entry) = dst_files.get(path) {
                let src_mod = src_entry.mod_time.unwrap_or(0);
                let dst_mod = dst_entry.mod_time.unwrap_or(0);
                let src_size = src_entry.size;
                let dst_size = dst_entry.size;

                if src_size != dst_size || src_mod != dst_mod {
                    // Determine change type based on direction and modification times
                    let (change_type, side) = if task.direction == "bisync" {
                        // For bisync, if both modified differently it's a conflict
                        if src_size != dst_size && src_mod != dst_mod && src_mod != 0 && dst_mod != 0 {
                            ("conflict".to_string(), None)
                        } else if src_mod > dst_mod {
                            ("modified".to_string(), Some("local".to_string()))
                        } else if dst_mod > src_mod {
                            ("modified".to_string(), Some("remote".to_string()))
                        } else {
                            ("modified".to_string(), None)
                        }
                    } else {
                        // For upload/download, any difference is a modification
                        ("modified".to_string(), None)
                    };

                    let (local_size, remote_size, local_modtime, remote_modtime) =
                        match task.direction.as_str() {
                            "upload" | "bisync" => (
                                Some(src_size),
                                Some(dst_size),
                                src_entry.mod_time,
                                dst_entry.mod_time,
                            ),
                            "download" => (
                                Some(dst_size),
                                Some(src_size),
                                dst_entry.mod_time,
                                src_entry.mod_time,
                            ),
                            _ => (None, None, None, None),
                        };

                    changes.push(NewSyncChange {
                        log_id,
                        file_path: path.clone(),
                        change_type,
                        side,
                        local_size,
                        remote_size,
                        local_modtime,
                        remote_modtime,
                    });
                }
            }
        }

        log::info!("scan_diff: found {} changes", changes.len());

        self.db.insert_sync_changes(&changes)?;

        // Count changes by type and update the sync_log
        let (added_count, modified_count, deleted_count, conflict_count, total_count) =
            self.db.count_changes_by_type(log_id)?;
        let _ = self.db.update_sync_log(
            log_id,
            "completed",
            total_count,
            0, // transferred_bytes - scan only, no actual transfer
            added_count,
            modified_count + conflict_count, // treat conflict as modified for display
            deleted_count,
            0, // error_count
            None,
        );

        let sync_changes = self.db.get_sync_changes(log_id)?;

        self.update_state(task_id, TaskState::Idle, 0.0, None, 0.0, None, None);

        Ok(sync_changes)
    }

    pub fn run_task(&self, task_id: i64, app_handle: tauri::AppHandle) -> Result<(), String> {
        let task = self
            .db
            .get_task(task_id)?
            .ok_or("Task not found")?;

        if !task.is_enabled {
            return Err("Task is disabled".to_string());
        }

        // Check if already running
        if let Some(state) = self.get_runtime_state(task_id) {
            if state.status == "scanning" || state.status == "syncing" {
                return Err("Task is already running".to_string());
            }
        }

        let now = chrono::Utc::now().to_rfc3339();
        let log_id = self.db.create_sync_log(&NewSyncLog {
            task_id,
            direction: task.direction.clone(),
            status: "running".to_string(),
            started_at: now,
        })?;

        self.update_state(task_id, TaskState::Syncing, 0.0, None, 0.0, None, None);
        self.emit_status(&app_handle, task_id);

        let rclone = self.rclone.clone();
        let db = self.db.clone();
        let engine_self = Arc::new(Self::new(db.clone(), rclone.clone()));

        let filters = task.filters.clone();
        let direction = task.direction.clone();
        let local_path = task.local_path.clone();
        let remote_name = task.remote_name.clone();
        let remote_path = task.remote_path.clone();
        let conflict_policy = task.conflict_policy.clone();

        std::thread::spawn(move || {
            let filters_ref = filters.as_deref();
            let job_result: Result<i64, String> = match direction.as_str() {
                "upload" => rclone.sync_upload(&local_path, &remote_name, &remote_path, filters_ref),
                "download" => rclone.sync_download(&remote_name, &remote_path, &local_path, filters_ref),
                "bisync" => rclone.bisync(
                    &local_path,
                    &remote_name,
                    &remote_path,
                    false,
                    &conflict_policy,
                    filters_ref,
                ),
                _ => Err("Invalid direction".to_string()),
            };

            match job_result {
                Ok(jobid) => {
                    engine_self.update_state(task_id, TaskState::Syncing, 0.0, None, 0.0, None, Some(jobid));
                    engine_self.emit_status(&app_handle, task_id);

                    // Poll job status
                    loop {
                        std::thread::sleep(std::time::Duration::from_secs(2));
                        match rclone.get_job_status(jobid) {
                            Ok(status) => {
                                let progress = status
                                    .get("progress")
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0)
                                    * 100.0;
                                let current_file = status
                                    .get("transferred")
                                    .and_then(|v| v.as_array())
                                    .and_then(|arr| arr.last())
                                    .and_then(|t| t.get("name"))
                                    .and_then(|v| v.as_str())
                                    .map(String::from);
                                let speed = status
                                    .get("speed")
                                    .and_then(|v| v.as_f64())
                                    .unwrap_or(0.0);
                                let eta = status
                                    .get("eta")
                                    .and_then(|v| v.as_f64())
                                    .map(|v| v as i64);

                                engine_self.update_state(
                                    task_id,
                                    TaskState::Syncing,
                                    progress,
                                    current_file,
                                    speed,
                                    eta,
                                    Some(jobid),
                                );
                                engine_self.emit_status(&app_handle, task_id);

                                let finished = status
                                    .get("finished")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false);
                                let success = status
                                    .get("success")
                                    .and_then(|v| v.as_bool())
                                    .unwrap_or(false);

                                if finished {
                                    // rclone job/status may put stats at top level or inside "stats" object
                                    let stats = status.get("stats").cloned().unwrap_or(status.clone());

                                    let total_files = stats
                                        .get("totalTransfers")
                                        .and_then(|v| v.as_i64())
                                        .or_else(|| stats.get("transfers").and_then(|v| v.as_i64()))
                                        .or_else(|| status.get("totalTransfers").and_then(|v| v.as_i64()))
                                        .unwrap_or(0);
                                    let transferred_bytes = stats
                                        .get("totalBytes")
                                        .and_then(|v| v.as_i64())
                                        .or_else(|| stats.get("bytes").and_then(|v| v.as_i64()))
                                        .or_else(|| status.get("totalBytes").and_then(|v| v.as_i64()))
                                        .unwrap_or(0);
                                    let error_count = stats
                                        .get("totalErrorCount")
                                        .and_then(|v| v.as_i64())
                                        .or_else(|| stats.get("errors").and_then(|v| v.as_i64()))
                                        .or_else(|| stats.get("totalErrors").and_then(|v| v.as_i64()))
                                        .or_else(|| status.get("totalErrorCount").and_then(|v| v.as_i64()))
                                        .unwrap_or(0);

                                    // Count transferred files from the transferred array
                                    let transferred_arr = status
                                        .get("transferred")
                                        .and_then(|v| v.as_array())
                                        .cloned()
                                        .unwrap_or_default();
                                    let transfer_count = transferred_arr.len() as i64;

                                    // Use the larger of totalTransfers vs counted transfers
                                    let effective_total = std::cmp::max(total_files, transfer_count);

                                    // For run_task, all transferred files are treated as added/modified
                                    // (sync/sync doesn't distinguish between new vs modified)
                                    let added_count = effective_total; // sync treats all as additions
                                    let modified_count = 0i64;
                                    let deleted_count = 0i64;

                                    if success {
                                        engine_self.update_state(
                                            task_id,
                                            TaskState::Completed,
                                            100.0,
                                            None,
                                            0.0,
                                            None,
                                            None,
                                        );
                                        let _ = db.update_sync_log(
                                            log_id,
                                            "completed",
                                            effective_total,
                                            transferred_bytes,
                                            added_count,
                                            modified_count,
                                            deleted_count,
                                            error_count,
                                            None,
                                        );
                                    } else {
                                        engine_self.update_state(
                                            task_id,
                                            TaskState::Failed,
                                            progress,
                                            None,
                                            0.0,
                                            None,
                                            None,
                                        );
                                        let _ = db.update_sync_log(
                                            log_id,
                                            "failed",
                                            effective_total,
                                            transferred_bytes,
                                            added_count,
                                            modified_count,
                                            deleted_count,
                                            error_count,
                                            None,
                                        );
                                    }
                                    engine_self.emit_status(&app_handle, task_id);
                                    let _ = db.update_last_sync(task_id);
                                    break;
                                }
                            }
                            Err(e) => {
                                log::error!("Failed to poll job status: {}", e);
                                engine_self.update_state(
                                    task_id,
                                    TaskState::Failed,
                                    0.0,
                                    None,
                                    0.0,
                                    None,
                                    None,
                                );
                                engine_self.emit_status(&app_handle, task_id);
                                let _ = db.update_sync_log(
                                    log_id,
                                    "failed",
                                    0,
                                    0,
                                    0,
                                    0,
                                    0,
                                    1,
                                    None,
                                );
                                break;
                            }
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to start sync job: {}", e);
                    engine_self.update_state(task_id, TaskState::Failed, 0.0, None, 0.0, None, None);
                    engine_self.emit_status(&app_handle, task_id);
                    let _ = db.update_sync_log(log_id, "failed", 0, 0, 0, 0, 0, 1, None);
                }
            }
        });

        Ok(())
    }

    pub fn cancel_task(&self, task_id: i64) -> Result<(), String> {
        let state = self.get_runtime_state(task_id);
        if let Some(s) = state {
            if let Some(jobid) = s.job_id {
                self.rclone.stop_job(jobid)?;
            }
            self.update_state(task_id, TaskState::Idle, 0.0, None, 0.0, None, None);
        }
        Ok(())
    }

    fn update_state(
        &self,
        task_id: i64,
        status: TaskState,
        progress: f64,
        current_file: Option<String>,
        speed: f64,
        eta: Option<i64>,
        job_id: Option<i64>,
    ) {
        let state = TaskRuntimeState {
            task_id,
            status: match status {
                TaskState::Idle => "idle".to_string(),
                TaskState::Scanning => "scanning".to_string(),
                TaskState::Syncing => "syncing".to_string(),
                TaskState::Completed => "completed".to_string(),
                TaskState::Failed => "failed".to_string(),
            },
            progress,
            current_file,
            speed,
            eta,
            job_id,
        };
        self.runtime_states
            .lock()
            .unwrap()
            .insert(task_id, state);
    }

    fn emit_status(&self, app_handle: &tauri::AppHandle, task_id: i64) {
        if let Some(state) = self.get_runtime_state(task_id) {
            let _ = app_handle.emit("task-status-change", &state);
            let _ = app_handle.emit("task-progress", &state);
        }
    }
}
