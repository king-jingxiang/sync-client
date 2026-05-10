use reqwest::blocking::Client;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Duration;

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
                    Ok(None) => return Ok(()), // still running
                    Err(e) => return Err(e.to_string()),
                }
            }
        }

        let bin = self.get_rclone_bin();
        if !bin.exists() {
            return Err(format!("rclone binary not found at: {}", bin.display()));
        }

        let child = Command::new(bin.as_os_str())
            .args([
                "rcd",
                &format!("--rc-addr={}:{}", RCLONE_RC_ADDR, RCLONE_RC_PORT),
                "--rc-no-auth",
                "--rc-allow-origin=*",
                "--use-json-log",
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start rclone daemon: {}", e))?;

        *proc = Some(child);

        // Wait for rclone to become ready
        for _ in 0..30 {
            std::thread::sleep(Duration::from_millis(500));
            if self.health_check() {
                return Ok(());
            }
        }

        Err("rclone daemon failed to start within 15 seconds".to_string())
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
        let mut params = json!({
            "name": name,
            "type": remote_type,
            "parameters": parameters,
        });
        // Opt field is required for some remotes
        let mut opt = serde_json::Map::new();
        for (k, v) in parameters {
            opt.insert(k.clone(), json!(v));
        }
        params["opt"] = Value::Object(opt);

        self.rc_call("config/create", params)?;
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

    pub fn check_diff(
        &self,
        src_fs: &str,
        dst_fs: &str,
    ) -> Result<Value, String> {
        let resp = self.rc_call(
            "operations/check",
            json!({
                "srcFs": src_fs,
                "dstFs": dst_fs,
                "oneWay": true,
            }),
        )?;
        Ok(resp)
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
