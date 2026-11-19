pub mod commands;
pub mod models;
pub mod persistence;
pub mod startup;
pub mod windows;

use tauri::{Manager, WindowEvent};

use commands::*;
use persistence::{get_db_path, DbState, Repositories};
use startup::setup_tray;
use windows::WindowManager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(main_window) = app.get_webview_window("main") {
                let _ = main_window.show();
                let _ = main_window.unminimize();
                let _ = main_window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            let handle = app.handle();

            // Initialize SQLite Database with graceful fallback
            let db_state = match get_db_path(handle) {
                Ok(path) => DbState::new(path).unwrap_or_else(|e| {
                    log::warn!("Failed to open disk database ({e}), using in-memory database");
                    DbState::new_in_memory().expect("Failed to initialize database")
                }),
                Err(e) => {
                    log::warn!("Failed to resolve database path ({e}), using in-memory database");
                    DbState::new_in_memory().expect("Failed to initialize database")
                }
            };
            app.manage(db_state.clone());

            // Setup System Tray
            let _ = setup_tray(handle);

            // Restore previously pinned widgets on startup
            let _ = WindowManager::restore_pinned_widgets(handle, &db_state);

            // Configure main window close behavior (close to tray)
            if let Some(main_window) = app.get_webview_window("main") {
                let db_clone = db_state.clone();
                let win_clone = main_window.clone();

                main_window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        if let Ok(settings) = Repositories::get_app_settings(&db_clone.0) {
                            if settings.close_to_tray {
                                api.prevent_close();
                                let _ = win_clone.hide();
                            }
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Window control
            start_dragging,
            minimize_window,
            hide_window,
            close_window,
            set_native_topmost,
            set_window_size,
            // Widgets management
            get_widgets,
            pin_widget,
            unpin_widget,
            remove_widget,
            set_widget_visibility,
            toggle_collapse_widget,
            // Tasks
            get_tasks,
            save_task,
            delete_task,
            // Notes
            get_notes,
            save_note,
            delete_note,
            // Focus
            get_focus_session,
            save_focus_session,
            // Deadlines
            get_deadlines,
            save_deadline,
            delete_deadline,
            // Daily Goals
            get_goals,
            save_goal,
            delete_goal,
            // Settings
            get_settings,
            save_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running DESKIT desktop application");
}
