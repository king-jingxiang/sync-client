pub mod models;
pub mod db;
pub mod services;
pub mod commands;

use commands::AppState;
use db::Database;
use services::{fs_watcher::FsWatcherService, rclone_mgr::RcloneMgr, task_engine::TaskEngine};
use std::sync::Arc;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_data_dir = dirs::data_dir()
        .expect("Cannot determine app data directory")
        .join("sync-client");

    let db_path = app_data_dir.join("sync_client.db");
    let db = Database::new(&db_path).expect("Failed to initialize database");
    db.initialize().expect("Failed to run database migrations");

    let db = Arc::new(db);

    let rclone = Arc::new(RcloneMgr::new());

    // Try to find rclone binary
    let rclone_bin = find_rclone_binary();
    rclone.set_rclone_bin(rclone_bin);

    let task_engine = Arc::new(TaskEngine::new(db.clone(), rclone.clone()));
    let fs_watcher = Arc::new(FsWatcherService::new(5));

    let app_state = AppState {
        db,
        rclone,
        task_engine,
        fs_watcher,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(app_state)
        .setup(|app| {
            // Setup system tray
            let show_item = MenuItem::with_id(app, "show", "打开主界面", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/icon.png"))
                .expect("Failed to load tray icon");
            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("SyncClient - 文件同步客户端")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, .. } = event {
                        // 只响应左键点击，右键留给菜单弹出
                        if button == MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            // Auto-start rclone daemon
            let state = app.state::<AppState>();
            if let Err(e) = state.rclone.start_daemon() {
                log::warn!("Failed to auto-start rclone daemon: {}", e);
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Config / Remote
            commands::list_remotes,
            commands::get_remote_config,
            commands::create_remote,
            commands::delete_remote,
            commands::test_remote_connection,
            commands::list_remote_files,
            commands::import_rclone_config,
            commands::export_rclone_config,
            // File Browser
            commands::browse_remote_files,
            commands::upload_local_files,
            commands::download_remote_files,
            commands::delete_remote_item,
            commands::create_remote_folder,
            // Tasks
            commands::create_task,
            commands::update_task,
            commands::delete_task,
            commands::list_tasks,
            commands::toggle_task,
            // Sync
            commands::scan_diff,
            commands::run_task,
            commands::cancel_task,
            commands::apply_diff_selection,
            // Logs
            commands::list_sync_logs,
            commands::get_sync_changes,
            commands::get_log_content,
            commands::export_log,
            // Settings
            commands::get_setting,
            commands::set_setting,
            commands::get_all_settings,
            // Rclone
            commands::get_rclone_status,
            commands::start_rclone,
            commands::stop_rclone,
            // Dialog
            commands::pick_directory,
            commands::pick_files,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn find_rclone_binary() -> std::path::PathBuf {
    // 1. Check bundled resources
    if let Ok(exe_dir) = std::env::current_exe() {
        if let Some(parent) = exe_dir.parent() {
            let bundled = parent.join(if cfg!(windows) {
                "rclone.exe"
            } else {
                "rclone"
            });
            if bundled.exists() {
                return bundled;
            }
        }
    }

    // 2. Check PATH
    if let Ok(output) = std::process::Command::new(if cfg!(windows) { "where" } else { "which" })
        .arg("rclone")
        .output()
    {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !path.is_empty() {
                return std::path::PathBuf::from(path);
            }
        }
    }

    // 3. Check common locations
    let common_paths = if cfg!(windows) {
        vec![
            r"C:\Program Files\rclone\rclone.exe",
            r"C:\rclone\rclone.exe",
        ]
    } else {
        vec![
            "/usr/local/bin/rclone",
            "/usr/bin/rclone",
            "/opt/homebrew/bin/rclone",
        ]
    };

    for p in common_paths {
        let pb = std::path::PathBuf::from(p);
        if pb.exists() {
            return pb;
        }
    }

    // Return default path (will show error when trying to use)
    std::path::PathBuf::from("rclone")
}
