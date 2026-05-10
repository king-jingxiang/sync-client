-- 同步任务表
CREATE TABLE IF NOT EXISTS tasks (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,
    local_path    TEXT NOT NULL,
    remote_name   TEXT NOT NULL,
    remote_path   TEXT NOT NULL,
    direction     TEXT NOT NULL CHECK(direction IN ('upload','download','bisync')),
    filters       TEXT,
    conflict_policy TEXT DEFAULT 'newer',
    auto_sync     BOOLEAN DEFAULT 0,
    sync_interval INTEGER,
    is_enabled    BOOLEAN DEFAULT 1,
    last_sync_at  DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 同步历史记录表
CREATE TABLE IF NOT EXISTS sync_logs (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id       INTEGER NOT NULL REFERENCES tasks(id),
    direction     TEXT NOT NULL,
    status        TEXT NOT NULL CHECK(status IN ('running','completed','failed','cancelled')),
    total_files   INTEGER DEFAULT 0,
    transferred_bytes INTEGER DEFAULT 0,
    added_count   INTEGER DEFAULT 0,
    modified_count INTEGER DEFAULT 0,
    deleted_count INTEGER DEFAULT 0,
    error_count   INTEGER DEFAULT 0,
    started_at    DATETIME NOT NULL,
    ended_at      DATETIME,
    log_path      TEXT
);

-- 差异扫描结果表
CREATE TABLE IF NOT EXISTS sync_changes (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    log_id        INTEGER NOT NULL REFERENCES sync_logs(id),
    file_path     TEXT NOT NULL,
    change_type   TEXT NOT NULL CHECK(change_type IN ('added','modified','deleted','conflict')),
    side          TEXT CHECK(side IN ('local','remote')),
    local_size    INTEGER,
    remote_size   INTEGER,
    local_modtime INTEGER,
    remote_modtime INTEGER,
    is_selected   BOOLEAN DEFAULT 1,
    resolved_by   TEXT
);

-- 应用设置表
CREATE TABLE IF NOT EXISTS app_settings (
    key           TEXT PRIMARY KEY,
    value         TEXT NOT NULL,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
