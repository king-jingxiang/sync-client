use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i64,
    pub name: String,
    pub local_path: String,
    pub remote_name: String,
    pub remote_path: String,
    pub direction: String,
    pub filters: Option<String>,
    pub conflict_policy: String,
    pub auto_sync: bool,
    pub sync_interval: Option<i64>,
    pub is_enabled: bool,
    pub last_sync_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewTask {
    pub name: String,
    pub local_path: String,
    pub remote_name: String,
    pub remote_path: String,
    pub direction: String,
    pub filters: Option<String>,
    pub conflict_policy: String,
    pub auto_sync: bool,
    pub sync_interval: Option<i64>,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLog {
    pub id: i64,
    pub task_id: i64,
    pub task_name: Option<String>,
    pub direction: String,
    pub status: String,
    pub total_files: i64,
    pub transferred_bytes: i64,
    pub added_count: i64,
    pub modified_count: i64,
    pub deleted_count: i64,
    pub error_count: i64,
    pub started_at: String,
    pub ended_at: Option<String>,
    pub log_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSyncLog {
    pub task_id: i64,
    pub direction: String,
    pub status: String,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncChange {
    pub id: i64,
    pub log_id: i64,
    pub file_path: String,
    pub change_type: String,
    pub side: Option<String>,
    pub local_size: Option<i64>,
    pub remote_size: Option<i64>,
    pub local_modtime: Option<i64>,
    pub remote_modtime: Option<i64>,
    pub is_selected: bool,
    pub resolved_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewSyncChange {
    pub log_id: i64,
    pub file_path: String,
    pub change_type: String,
    pub side: Option<String>,
    pub local_size: Option<i64>,
    pub remote_size: Option<i64>,
    pub local_modtime: Option<i64>,
    pub remote_modtime: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSetting {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskRuntimeState {
    pub task_id: i64,
    pub status: String,
    pub progress: f64,
    pub current_file: Option<String>,
    pub speed: f64,
    pub eta: Option<i64>,
    pub job_id: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteConfig {
    pub name: String,
    #[serde(rename = "type")]
    pub remote_type: String,
    pub parameters: Option<std::collections::HashMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteFile {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: i64,
    pub mod_time: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileTransferResult {
    pub success: bool,
    pub path: String,
    pub error: Option<String>,
}
