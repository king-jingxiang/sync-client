use crate::db::Database;
use crate::models::*;
use crate::services::{fs_watcher::FsWatcherService, rclone_mgr::RcloneMgr, task_engine::TaskEngine};
use std::sync::Arc;
use tauri::State;

pub struct AppState {
    pub db: Arc<Database>,
    pub rclone: Arc<RcloneMgr>,
    pub task_engine: Arc<TaskEngine>,
    pub fs_watcher: Arc<FsWatcherService>,
}

// ---- Config / Remote Commands ----

#[tauri::command]
pub fn list_remotes(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    state.rclone.list_remotes()
}

#[tauri::command]
pub fn get_remote_config(state: State<'_, AppState>, name: String) -> Result<serde_json::Value, String> {
    state.rclone.get_remote_config(&name)
}

#[tauri::command]
pub fn create_remote(
    state: State<'_, AppState>,
    config: RemoteConfig,
) -> Result<(), String> {
    let params = config.parameters.unwrap_or_default();
    state
        .rclone
        .create_remote(&config.name, &config.remote_type, &params)
}

#[tauri::command]
pub fn delete_remote(state: State<'_, AppState>, name: String) -> Result<(), String> {
    state.rclone.delete_remote(&name)
}

#[tauri::command]
pub fn test_remote_connection(
    state: State<'_, AppState>,
    name: String,
) -> Result<serde_json::Value, String> {
    let (success, message) = state.rclone.test_connection(&name)?;
    Ok(serde_json::json!({ "success": success, "message": message }))
}

#[tauri::command]
pub fn list_remote_files(
    state: State<'_, AppState>,
    remote_name: String,
    path: String,
) -> Result<Vec<RemoteFile>, String> {
    state.rclone.list_remote_files(&remote_name, &path)
}

#[tauri::command]
pub fn import_rclone_config(_state: State<'_, AppState>, _file_path: String) -> Result<i64, String> {
    // TODO: Implement rclone.conf import
    Err("Not implemented yet".to_string())
}

#[tauri::command]
pub fn export_rclone_config(_state: State<'_, AppState>, _dest_path: String) -> Result<(), String> {
    // TODO: Implement rclone.conf export
    Err("Not implemented yet".to_string())
}

// ---- Task Commands ----

#[tauri::command]
pub fn create_task(state: State<'_, AppState>, task: NewTask) -> Result<Task, String> {
    state.db.create_task(&task)
}

#[tauri::command]
pub fn update_task(state: State<'_, AppState>, task: Task) -> Result<(), String> {
    state.db.update_task(&task)
}

#[tauri::command]
pub fn delete_task(state: State<'_, AppState>, task_id: i64) -> Result<(), String> {
    state.fs_watcher.unwatch(task_id).ok();
    state.db.delete_task(task_id)
}

#[tauri::command]
pub fn list_tasks(state: State<'_, AppState>) -> Result<Vec<Task>, String> {
    state.db.list_tasks()
}

#[tauri::command]
pub fn toggle_task(state: State<'_, AppState>, task_id: i64, enabled: bool) -> Result<(), String> {
    state.db.toggle_task(task_id, enabled)
}

// ---- Sync Commands ----

#[tauri::command]
pub fn scan_diff(state: State<'_, AppState>, task_id: i64) -> Result<Vec<SyncChange>, String> {
    state.task_engine.scan_diff(task_id)
}

#[tauri::command]
pub fn run_task(
    state: State<'_, AppState>,
    task_id: i64,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    state.task_engine.run_task(task_id, app_handle)
}

#[tauri::command]
pub fn cancel_task(state: State<'_, AppState>, task_id: i64) -> Result<(), String> {
    state.task_engine.cancel_task(task_id)
}

#[tauri::command]
pub fn apply_diff_selection(
    state: State<'_, AppState>,
    _log_id: i64,
    selections: Vec<DiffSelection>,
) -> Result<(), String> {
    for sel in selections {
        state
            .db
            .update_change_selection(sel.change_id, sel.is_selected)?;
    }
    Ok(())
}

// ---- Log Commands ----

#[tauri::command]
pub fn list_sync_logs(
    state: State<'_, AppState>,
    task_id: Option<i64>,
    limit: i64,
) -> Result<Vec<SyncLog>, String> {
    state.db.list_sync_logs(task_id, limit)
}

#[tauri::command]
pub fn get_sync_changes(
    state: State<'_, AppState>,
    log_id: i64,
) -> Result<Vec<SyncChange>, String> {
    state.db.get_sync_changes(log_id)
}

#[tauri::command]
pub fn get_log_content(_state: State<'_, AppState>, log_path: String) -> Result<String, String> {
    std::fs::read_to_string(&log_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_log(
    state: State<'_, AppState>,
    log_id: i64,
    dest_path: String,
) -> Result<(), String> {
    let changes = state.db.get_sync_changes(log_id)?;
    let content = serde_json::to_string_pretty(&changes).map_err(|e| e.to_string())?;
    std::fs::write(&dest_path, content).map_err(|e| e.to_string())
}

// ---- Settings Commands ----

#[tauri::command]
pub fn get_setting(state: State<'_, AppState>, key: String) -> Result<Option<String>, String> {
    state.db.get_setting(&key)
}

#[tauri::command]
pub fn set_setting(state: State<'_, AppState>, key: String, value: String) -> Result<(), String> {
    state.db.set_setting(&key, &value)
}

#[tauri::command]
pub fn get_all_settings(state: State<'_, AppState>) -> Result<Vec<AppSetting>, String> {
    state.db.get_all_settings()
}

// ---- Rclone Status Commands ----

#[tauri::command]
pub fn get_rclone_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let (running, version) = state.rclone.get_status();
    Ok(serde_json::json!({
        "running": running,
        "version": version,
    }))
}

#[tauri::command]
pub fn start_rclone(state: State<'_, AppState>) -> Result<(), String> {
    state.rclone.start_daemon()
}

#[tauri::command]
pub fn stop_rclone(state: State<'_, AppState>) -> Result<(), String> {
    state.rclone.stop_daemon()
}

// ---- File Dialog ----

#[tauri::command]
pub async fn pick_directory(app_handle: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let dir = app_handle.dialog().file().blocking_pick_folder();
    match dir {
        Some(path) => Ok(Some(path.to_string())),
        None => Ok(None),
    }
}

// Helper type for diff selection
#[derive(serde::Deserialize)]
pub struct DiffSelection {
    pub change_id: i64,
    pub is_selected: bool,
}
