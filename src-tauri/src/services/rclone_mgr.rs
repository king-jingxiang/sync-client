use reqwest::blocking::Client;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::models::RemoteFile;

const RCLONE_RC_PORT: u16 = 5572;
const RCLONE_RC_ADDR: &str = "127.0.0.1";

pub struct RcloneMgr {
    process: Mutex<Option<Child>>,
    client: Client,
    rclone_bin: Mutex<PathBuf>,
    rc_url: String,
}

impl RcloneMgr {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .build()
            .expect("Failed to create HTTP client");

        let rc_url = format!("http://{}:{}", RCLONE_RC_ADDR, RCLONE_RC_PORT);

        Self {
            process: Mutex::new(None),
            client,
            rclone_bin: Mutex::new(PathBuf::new()),
            rc_url,
        }
    }

    pub fn set_rclone_bin(&self, path: PathBuf) {
        *self.rclone_bin.lock().unwrap() = path;
    }

    pub fn get_rclone_bin(&self) -> PathBuf {
        self.rclone_bin.lock().unwrap().clone()
    }

    pub fn start_daemon(&self) -> Result<(), String> {
        let mut proc = self.process.lock().unwrap();
        if proc.is_some() {
            // Check if still alive
            if let Some(ref mut child) = *proc {
                match child.try_wait() {
                    Ok(Some(_)) => { /* process exited, restart */ }
                    Ok(None) => {
                        log::debug!("rclone daemon already running");
                        return Ok(());
                    } // still running
                    Err(e) => return Err(e.to_string()),
                }
            }
        }

        let bin = self.get_rclone_bin();
        log::info!("Starting rclone daemon from: {}", bin.display());
        if !bin.exists() {
            let msg = format!("rclone binary not found at: {}", bin.display());
            log::error!("{}", msg);
            return Err(msg);
        }

        let mut cmd = Command::new(bin.as_os_str());
        cmd.args([
            "rcd",
            &format!("--rc-addr={}:{}", RCLONE_RC_ADDR, RCLONE_RC_PORT),
            "--rc-no-auth",
            "--rc-allow-origin=*",
            "--use-json-log",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null());

        #[cfg(windows)]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let child = cmd.spawn().map_err(|e| {
            let msg = format!("Failed to start rclone daemon: {}", e);
            log::error!("{}", msg);
            msg
        })?;

        *proc = Some(child);

        // Wait for rclone to become ready
        for i in 0..30 {
            std::thread::sleep(Duration::from_millis(500));
            if self.health_check() {
                log::info!("rclone daemon ready after {}ms", (i + 1) * 500);
                return Ok(());
            }
        }

        let msg = "rclone daemon failed to start within 15 seconds".to_string();
        log::error!("{}", msg);
        Err(msg)
    }

    pub fn stop_daemon(&self) -> Result<(), String> {
        let mut proc = self.process.lock().unwrap();
        if let Some(ref mut child) = *proc {
            child.kill().map_err(|e| e.to_string())?;
            child.wait().ok();
        }
        *proc = None;
        Ok(())
    }

    pub fn health_check(&self) -> bool {
        self.rc_call("rc/noop", json!({})).is_ok()
    }

    pub fn is_running(&self) -> bool {
        let mut proc = self.process.lock().unwrap();
        match proc.as_mut() {
            Some(child) => matches!(child.try_wait(), Ok(None)),
            None => false,
        }
    }

    pub fn get_status(&self) -> (bool, Option<String>) {
        if !self.is_running() {
            return (false, None);
        }
        match self.rc_call("core/version", json!({})) {
            Ok(v) => {
                let version = v.get("version").and_then(|v| v.as_str()).map(String::from);
                (true, version)
            }
            Err(_) => (false, None),
        }
    }

    fn rc_call(&self, endpoint: &str, params: Value) -> Result<Value, String> {
        let url = format!("{}/{}", self.rc_url, endpoint);
        let resp = self
            .client
            .post(&url)
            .json(&params)
            .send()
            .map_err(|e| format!("RC API request failed: {}", e))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().unwrap_or_default();
            return Err(format!("RC API error {}: {}", status, body));
        }

        resp.json::<Value>()
            .map_err(|e| format!("Failed to parse RC API response: {}", e))
    }

    // ---- Config operations ----

    pub fn list_remotes(&self) -> Result<Vec<String>, String> {
        log::debug!("Listing remotes via RC API");
        let resp = self.rc_call("config/listremotes", json!({}))?;
        let remotes = resp
            .get("remotes")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(String::from))
                    .collect()
            })
            .unwrap_or_default();
        Ok(remotes)
    }

    pub fn get_remote_config(&self, name: &str) -> Result<Value, String> {
        let resp = self.rc_call("config/get", json!({ "name": name }))?;
        Ok(resp)
    }

    pub fn create_remote(
        &self,
        name: &str,
        remote_type: &str,
        parameters: &std::collections::HashMap<String, String>,
    ) -> Result<(), String> {
        let params = json!({
            "name": name,
            "type": remote_type,
            "parameters": parameters,
        });
        log::info!(
            "Creating remote '{}' type='{}' params={:?}",
            name, remote_type, parameters
        );
        self.rc_call("config/create", params)?;
        log::info!("Remote '{}' created successfully", name);
        Ok(())
    }

    pub fn delete_remote(&self, name: &str) -> Result<(), String> {
        self.rc_call("config/delete", json!({ "name": name }))?;
        Ok(())
    }

    pub fn test_connection(&self, name: &str) -> Result<(bool, String), String> {
        match self.rc_call(
            "operations/list",
            json!({ "fs": format!("{}:", name), "remote": "" }),
        ) {
            Ok(_) => Ok((true, "Connection successful".to_string())),
            Err(e) => Ok((false, e)),
        }
    }

    // ---- File operations ----

    pub fn list_remote_files(
        &self,
        remote_name: &str,
        path: &str,
    ) -> Result<Vec<RemoteFile>, String> {
        let fs = format!("{}:", remote_name);
        let resp = self.rc_call(
            "operations/list",
            json!({ "fs": fs, "remote": path }),
        )?;

        let list = resp
            .get("list")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        Some(RemoteFile {
                            name: item.get("Name")?.as_str()?.to_string(),
                            path: item.get("Path")?.as_str()?.to_string(),
                            is_dir: item.get("IsDir")?.as_bool().unwrap_or(false),
                            size: item.get("Size")?.as_i64().unwrap_or(0),
                            mod_time: item
                                .get("ModTime")?
                                .as_str()
                                .unwrap_or("")
                                .to_string(),
                        })
                    })
                    .collect()
            })
            .unwrap_or_default();
        Ok(list)
    }

    // ---- Sync operations ----

    pub fn sync_upload(
        &self,
        local_path: &str,
        remote_name: &str,
        remote_path: &str,
        filters: Option<&str>,
    ) -> Result<i64, String> {
        let src_fs = local_path.to_string();
        let dst_fs = format!("{}:{}", remote_name, remote_path);

        let mut params = json!({
            "srcFs": src_fs,
            "dstFs": dst_fs,
            "_async": true,
        });

        if let Some(f) = filters {
            params["filters"] = json!({ "filter": f });
        }

        let resp = self.rc_call("sync/sync", params)?;
        let jobid = resp
            .get("jobid")
            .and_then(|v| v.as_i64())
            .ok_or("No jobid in response")?;
        Ok(jobid)
    }

    pub fn sync_download(
        &self,
        remote_name: &str,
        remote_path: &str,
        local_path: &str,
        filters: Option<&str>,
    ) -> Result<i64, String> {
        let src_fs = format!("{}:{}", remote_name, remote_path);
        let dst_fs = local_path.to_string();

        let mut params = json!({
            "srcFs": src_fs,
            "dstFs": dst_fs,
            "_async": true,
        });

        if let Some(f) = filters {
            params["filters"] = json!({ "filter": f });
        }

        let resp = self.rc_call("sync/sync", params)?;
        let jobid = resp
            .get("jobid")
            .and_then(|v| v.as_i64())
            .ok_or("No jobid in response")?;
        Ok(jobid)
    }

    pub fn bisync(
        &self,
        local_path: &str,
        remote_name: &str,
        remote_path: &str,
        resync: bool,
        conflict_resolve: &str,
        filters: Option<&str>,
    ) -> Result<i64, String> {
        let path1 = local_path.to_string();
        let path2 = format!("{}:{}", remote_name, remote_path);

        let mut params = json!({
            "path1": path1,
            "path2": path2,
            "resync": resync,
            "conflictResolve": conflict_resolve,
            "_async": true,
        });

        if let Some(f) = filters {
            params["filters"] = json!({ "filter": f });
        }

        let resp = self.rc_call("sync/bisync", params)?;
        let jobid = resp
            .get("jobid")
            .and_then(|v| v.as_i64())
            .ok_or("No jobid in response")?;
        Ok(jobid)
    }

    /// List all files (recursively) under the given fs, returning a map of
    /// relative_path -> (size, mod_time_unix_seconds).
    pub fn list_all_files(
        &self,
        fs: &str,
    ) -> Result<std::collections::HashMap<String, FileEntry>, String> {
        let mut all_files = std::collections::HashMap::new();
        let mut queue = vec![String::new()]; // start from root

        while let Some(remote) = queue.pop() {
            let resp = self.rc_call(
                "operations/list",
                json!({ "fs": fs, "remote": remote }),
            )?;

            let list = resp
                .get("list")
                .and_then(|v| v.as_array())
                .cloned()
                .unwrap_or_default();

            for item in &list {
                let is_dir = item.get("IsDir").and_then(|v| v.as_bool()).unwrap_or(false);
                let _path = item
                    .get("Path")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let name = item
                    .get("Name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                if is_dir {
                    let subdir = if remote.is_empty() || remote == "/" {
                        name.to_string()
                    } else {
                        format!("{}/{}", remote.trim_end_matches('/'), name)
                    };
                    queue.push(subdir);
                } else {
                    let size = item.get("Size").and_then(|v| v.as_i64()).unwrap_or(0);
                    let mod_time = item
                        .get("ModTime")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let mod_ts = parse_iso8601_to_unix(mod_time);

                    let rel_path = if remote.is_empty() || remote == "/" {
                        name.to_string()
                    } else {
                        format!("{}/{}", remote.trim_end_matches('/'), name)
                    };

                    all_files.insert(rel_path, FileEntry { size, mod_time: mod_ts });
                }
            }
        }

        Ok(all_files)
    }

    pub fn copy_file(
        &self,
        src_fs: &str,
        src_remote: &str,
        dst_fs: &str,
        dst_remote: &str,
    ) -> Result<(), String> {
        self.rc_call(
            "operations/copyfile",
            json!({
                "srcFs": src_fs,
                "srcRemote": src_remote,
                "dstFs": dst_fs,
                "dstRemote": dst_remote,
            }),
        )?;
        Ok(())
    }

    pub fn delete_file(&self, fs: &str, remote: &str) -> Result<(), String> {
        self.rc_call(
            "operations/deletefile",
            json!({
                "fs": fs,
                "remote": remote,
            }),
        )?;
        Ok(())
    }

    pub fn purge_dir(&self, fs: &str, remote: &str) -> Result<(), String> {
        self.rc_call(
            "operations/purge",
            json!({
                "fs": fs,
                "remote": remote,
            }),
        )?;
        Ok(())
    }

    pub fn mkdir(&self, fs: &str, remote: &str) -> Result<(), String> {
        self.rc_call(
            "operations/mkdir",
            json!({
                "fs": fs,
                "remote": remote,
            }),
        )?;
        Ok(())
    }

    pub fn get_job_status(&self, jobid: i64) -> Result<Value, String> {
        self.rc_call("job/status", json!({ "jobid": jobid }))
    }

    pub fn stop_job(&self, jobid: i64) -> Result<(), String> {
        self.rc_call("job/stop", json!({ "jobid": jobid }))?;
        Ok(())
    }
}

impl Drop for RcloneMgr {
    fn drop(&mut self) {
        let _ = self.stop_daemon();
    }
}

/// A file entry with size and modification time.
#[derive(Debug, Clone)]
pub struct FileEntry {
    pub size: i64,
    pub mod_time: Option<i64>,
}

/// Parse an ISO 8601 datetime string into a unix timestamp (seconds).
fn parse_iso8601_to_unix(s: &str) -> Option<i64> {
    use chrono::DateTime;
    if let Ok(dt) = DateTime::parse_from_rfc3339(s) {
        return Some(dt.timestamp());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S%.fZ") {
        return Some(dt.and_utc().timestamp());
    }
    if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%SZ") {
        return Some(dt.and_utc().timestamp());
    }
    None
}
