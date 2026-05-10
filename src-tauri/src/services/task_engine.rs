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

        let diff_result = self.rclone.check_diff(&src_fs, &dst_fs)?;

        // Create a sync_log entry for this scan
        let now = chrono::Utc::now().to_rfc3339();
        let log_id = self.db.create_sync_log(&NewSyncLog {
            task_id,
            direction: task.direction.clone(),
            status: "running".to_string(),
            started_at: now,
        })?;

        // Parse diff results into changes
        let mut changes = Vec::new();
        if let Some(missing) = diff_result.get("MissingOnSrc") {
            if let Some(arr) = missing.as_array() {
                for item in arr {
                    if let Some(path) = item.as_str() {
                        changes.push(NewSyncChange {
                            log_id,
                            file_path: path.to_string(),
                            change_type: "deleted".to_string(),
                            side: Some("remote".to_string()),
                            local_size: None,
                            remote_size: None,
                            local_modtime: None,
                            remote_modtime: None,
                        });
                    }
                }
            }
        }

        if let Some(missing) = diff_result.get("MissingOnDst") {
            if let Some(arr) = missing.as_array() {
                for item in arr {
                    if let Some(path) = item.as_str() {
                        changes.push(NewSyncChange {
                            log_id,
                            file_path: path.to_string(),
                            change_type: "added".to_string(),
                            side: Some("local".to_string()),
                            local_size: None,
                            remote_size: None,
                            local_modtime: None,
                            remote_modtime: None,
                        });
                    }
                }
            }
        }

        if let Some(matched) = diff_result.get("Match") {
            if let Some(arr) = matched.as_array() {
                for item in arr {
                    if let Some(path) = item.as_str() {
                        changes.push(NewSyncChange {
                            log_id,
                            file_path: path.to_string(),
                            change_type: "modified".to_string(),
                            side: None,
                            local_size: None,
                            remote_size: None,
                            local_modtime: None,
                            remote_modtime: None,
                        });
                    }
                }
            }
        }

        if let Some(differ) = diff_result.get("Differ") {
            if let Some(arr) = differ.as_array() {
                for item in arr {
                    if let Some(path) = item.as_str() {
                        changes.push(NewSyncChange {
                            log_id,
                            file_path: path.to_string(),
                            change_type: "conflict".to_string(),
                            side: None,
                            local_size: None,
                            remote_size: None,
                            local_modtime: None,
                            remote_modtime: None,
                        });
                    }
                }
            }
        }

        self.db.insert_sync_changes(&changes)?;
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
                                    let total_files = status
                                        .get("totalTransfers")
                                        .and_then(|v| v.as_i64())
                                        .unwrap_or(0);
                                    let transferred_bytes = status
                                        .get("totalBytes")
                                        .and_then(|v| v.as_i64())
                                        .unwrap_or(0);
                                    let error_count = status
                                        .get("totalErrorCount")
                                        .and_then(|v| v.as_i64())
                                        .unwrap_or(0);

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
                                            total_files,
                                            transferred_bytes,
                                            0,
                                            0,
                                            0,
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
                                            total_files,
                                            transferred_bytes,
                                            0,
                                            0,
                                            0,
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
