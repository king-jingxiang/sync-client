use rusqlite::{params, Connection, OptionalExtension, Result as SqlResult};
use std::path::Path;
use std::sync::Mutex;

use crate::models::*;

pub struct Database {
    conn: Mutex<Connection>,
}

impl Database {
    pub fn new(db_path: &Path) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
            .map_err(|e| e.to_string())?;
        Ok(Self {
            conn: Mutex::new(conn),
        })
    }

    pub fn initialize(&self) -> Result<(), String> {
        let schema = include_str!("../../../migrations/001_init.sql");
        self.conn
            .lock()
            .map_err(|e| e.to_string())?
            .execute_batch(schema)
            .map_err(|e| e.to_string())
    }

    // ---- Tasks ----

    pub fn list_tasks(&self) -> Result<Vec<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, local_path, remote_name, remote_path, direction, filters, conflict_policy, auto_sync, sync_interval, is_enabled, last_sync_at, created_at, updated_at FROM tasks ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(Task {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    local_path: row.get(2)?,
                    remote_name: row.get(3)?,
                    remote_path: row.get(4)?,
                    direction: row.get(5)?,
                    filters: row.get(6)?,
                    conflict_policy: row.get(7)?,
                    auto_sync: row.get(8)?,
                    sync_interval: row.get(9)?,
                    is_enabled: row.get(10)?,
                    last_sync_at: row.get(11)?,
                    created_at: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    pub fn create_task(&self, task: &NewTask) -> Result<Task, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO tasks (name, local_path, remote_name, remote_path, direction, filters, conflict_policy, auto_sync, sync_interval, is_enabled) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                task.name,
                task.local_path,
                task.remote_name,
                task.remote_path,
                task.direction,
                task.filters,
                task.conflict_policy,
                task.auto_sync,
                task.sync_interval,
                task.is_enabled,
            ],
        )
        .map_err(|e| e.to_string())?;

        let id = conn.last_insert_rowid();
        let mut stmt = conn
            .prepare("SELECT id, name, local_path, remote_name, remote_path, direction, filters, conflict_policy, auto_sync, sync_interval, is_enabled, last_sync_at, created_at, updated_at FROM tasks WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        stmt.query_row(params![id], |row| {
            Ok(Task {
                id: row.get(0)?,
                name: row.get(1)?,
                local_path: row.get(2)?,
                remote_name: row.get(3)?,
                remote_path: row.get(4)?,
                direction: row.get(5)?,
                filters: row.get(6)?,
                conflict_policy: row.get(7)?,
                auto_sync: row.get(8)?,
                sync_interval: row.get(9)?,
                is_enabled: row.get(10)?,
                last_sync_at: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
            })
        })
        .map_err(|e| e.to_string())
    }

    pub fn update_task(&self, task: &Task) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE tasks SET name=?1, local_path=?2, remote_name=?3, remote_path=?4, direction=?5, filters=?6, conflict_policy=?7, auto_sync=?8, sync_interval=?9, is_enabled=?10, updated_at=CURRENT_TIMESTAMP WHERE id=?11",
            params![
                task.name,
                task.local_path,
                task.remote_name,
                task.remote_path,
                task.direction,
                task.filters,
                task.conflict_policy,
                task.auto_sync,
                task.sync_interval,
                task.is_enabled,
                task.id,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_task(&self, task_id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sync_changes WHERE log_id IN (SELECT id FROM sync_logs WHERE task_id = ?1)", params![task_id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sync_logs WHERE task_id = ?1", params![task_id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM tasks WHERE id = ?1", params![task_id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn toggle_task(&self, task_id: i64, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE tasks SET is_enabled = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![enabled, task_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_last_sync(&self, task_id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE tasks SET last_sync_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![task_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_task(&self, task_id: i64) -> Result<Option<Task>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, local_path, remote_name, remote_path, direction, filters, conflict_policy, auto_sync, sync_interval, is_enabled, last_sync_at, created_at, updated_at FROM tasks WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row(params![task_id], |row| {
                Ok(Task {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    local_path: row.get(2)?,
                    remote_name: row.get(3)?,
                    remote_path: row.get(4)?,
                    direction: row.get(5)?,
                    filters: row.get(6)?,
                    conflict_policy: row.get(7)?,
                    auto_sync: row.get(8)?,
                    sync_interval: row.get(9)?,
                    is_enabled: row.get(10)?,
                    last_sync_at: row.get(11)?,
                    created_at: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            })
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    // ---- Sync Logs ----

    pub fn create_sync_log(&self, log: &NewSyncLog) -> Result<i64, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO sync_logs (task_id, direction, status, started_at) VALUES (?1, ?2, ?3, ?4)",
            params![log.task_id, log.direction, log.status, log.started_at],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn update_sync_log(
        &self,
        log_id: i64,
        status: &str,
        total_files: i64,
        transferred_bytes: i64,
        added_count: i64,
        modified_count: i64,
        deleted_count: i64,
        error_count: i64,
        log_path: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_logs SET status=?1, total_files=?2, transferred_bytes=?3, added_count=?4, modified_count=?5, deleted_count=?6, error_count=?7, ended_at=CURRENT_TIMESTAMP, log_path=?8 WHERE id=?9",
            params![status, total_files, transferred_bytes, added_count, modified_count, deleted_count, error_count, log_path, log_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn list_sync_logs(&self, task_id: Option<i64>, limit: i64) -> Result<Vec<SyncLog>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = if let Some(tid) = task_id {
            conn.prepare(&format!(
                "SELECT sl.id, sl.task_id, t.name as task_name, sl.direction, sl.status, sl.total_files, sl.transferred_bytes, sl.added_count, sl.modified_count, sl.deleted_count, sl.error_count, sl.started_at, sl.ended_at, sl.log_path FROM sync_logs sl LEFT JOIN tasks t ON sl.task_id = t.id WHERE sl.task_id = {} ORDER BY sl.started_at DESC LIMIT {}",
                tid, limit
            ))
            .map_err(|e| e.to_string())?
        } else {
            conn.prepare(&format!(
                "SELECT sl.id, sl.task_id, t.name as task_name, sl.direction, sl.status, sl.total_files, sl.transferred_bytes, sl.added_count, sl.modified_count, sl.deleted_count, sl.error_count, sl.started_at, sl.ended_at, sl.log_path FROM sync_logs sl LEFT JOIN tasks t ON sl.task_id = t.id ORDER BY sl.started_at DESC LIMIT {}",
                limit
            ))
            .map_err(|e| e.to_string())?
        };
        let rows = stmt
            .query_map([], |row| {
                Ok(SyncLog {
                    id: row.get(0)?,
                    task_id: row.get(1)?,
                    task_name: row.get(2)?,
                    direction: row.get(3)?,
                    status: row.get(4)?,
                    total_files: row.get(5)?,
                    transferred_bytes: row.get(6)?,
                    added_count: row.get(7)?,
                    modified_count: row.get(8)?,
                    deleted_count: row.get(9)?,
                    error_count: row.get(10)?,
                    started_at: row.get(11)?,
                    ended_at: row.get(12)?,
                    log_path: row.get(13)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    // ---- Sync Changes ----

    pub fn insert_sync_changes(&self, changes: &[NewSyncChange]) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        for c in changes {
            conn.execute(
                "INSERT INTO sync_changes (log_id, file_path, change_type, side, local_size, remote_size, local_modtime, remote_modtime) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![c.log_id, c.file_path, c.change_type, c.side, c.local_size, c.remote_size, c.local_modtime, c.remote_modtime],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn get_sync_changes(&self, log_id: i64) -> Result<Vec<SyncChange>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, log_id, file_path, change_type, side, local_size, remote_size, local_modtime, remote_modtime, is_selected, resolved_by FROM sync_changes WHERE log_id = ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![log_id], |row| {
                Ok(SyncChange {
                    id: row.get(0)?,
                    log_id: row.get(1)?,
                    file_path: row.get(2)?,
                    change_type: row.get(3)?,
                    side: row.get(4)?,
                    local_size: row.get(5)?,
                    remote_size: row.get(6)?,
                    local_modtime: row.get(7)?,
                    remote_modtime: row.get(8)?,
                    is_selected: row.get(9)?,
                    resolved_by: row.get(10)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }

    pub fn update_change_selection(&self, change_id: i64, selected: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE sync_changes SET is_selected = ?1 WHERE id = ?2",
            params![selected, change_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Count changes by type for a given log_id.
    /// Returns (added_count, modified_count, deleted_count, conflict_count, total_changes).
    pub fn count_changes_by_type(&self, log_id: i64) -> Result<(i64, i64, i64, i64, i64), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let added: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_changes WHERE log_id = ?1 AND change_type = 'added'",
                params![log_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let modified: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_changes WHERE log_id = ?1 AND change_type = 'modified'",
                params![log_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let deleted: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_changes WHERE log_id = ?1 AND change_type = 'deleted'",
                params![log_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let conflict: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_changes WHERE log_id = ?1 AND change_type = 'conflict'",
                params![log_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        let total: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sync_changes WHERE log_id = ?1",
                params![log_id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        Ok((added, modified, deleted, conflict, total))
    }

    // ---- Settings ----

    pub fn get_setting(&self, key: &str) -> Result<Option<String>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT value FROM app_settings WHERE key = ?1")
            .map_err(|e| e.to_string())?;
        let result = stmt
            .query_row(params![key], |row| row.get::<_, String>(0))
            .optional()
            .map_err(|e| e.to_string())?;
        Ok(result)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
            params![key, value],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get_all_settings(&self) -> Result<Vec<AppSetting>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT key, value, updated_at FROM app_settings")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(AppSetting {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.collect::<SqlResult<Vec<_>>>().map_err(|e| e.to_string())
    }
}
