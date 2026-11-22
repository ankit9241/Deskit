pub mod commands;
pub mod models;
pub mod persistence;
pub mod startup;
pub mod windows;

use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_autostart::ManagerExt;

use commands::*;
use persistence::{get_db_path, DbState, Repositories};
use startup::setup_tray;
use windows::{GeometryDebouncer, WindowManager};

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

            // Initialize GeometryDebouncer for debounced window layout persistence
            let debouncer = GeometryDebouncer::new(db_state.clone());
            app.manage(debouncer);

            // Setup System Tray
            let _ = setup_tray(handle);

            // Ensure Windows autostart is registered if enabled in settings
            if let Ok(settings) = Repositories::get_app_settings(&db_state.0) {
                let autostart_manager = handle.autolaunch();
                if settings.launch_at_login {
                    let _ = autostart_manager.enable();
                }
            }

            // If started via Windows autostart on laptop reboot, keep Manager hidden in tray
            let is_autostart = std::env::args().any(|arg| arg == "--autostart");
            if is_autostart {
                if let Some(main_win) = app.get_webview_window("main") {
                    let _ = main_win.hide();
                }
            }

            // Restore previously pinned widgets on startup directly to their saved positions
            let _ = WindowManager::restore_pinned_widgets(handle, &db_state);

            // Spawn background thread to monitor local date change and reconcile daily goals at midnight
            let handle_for_goals = handle.clone();
            let db_for_goals = db_state.clone();
            std::thread::spawn(move || {
                let mut last_date = chrono::Local::now().format("%Y-%m-%d").to_string();
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    let current_date = chrono::Local::now().format("%Y-%m-%d").to_string();
                    if current_date != last_date {
                        last_date = current_date.clone();
                        if let Ok(goals) = Repositories::reconcile_daily_goals(&db_for_goals.0, &current_date) {
                            let _ = handle_for_goals.emit("goals-updated", &goals);
                        }
                    }
                }
            });

            // Spawn background thread to monitor deadlines and alarms, dispatching native notifications
            let handle_for_notifications = handle.clone();
            let db_for_notifications = db_state.clone();
            let alarm_retries = std::sync::Arc::new(std::sync::Mutex::new(std::collections::HashMap::<String, u32>::new()));
            let alarm_retries_clone = alarm_retries.clone();
            std::thread::spawn(move || {
                let check_and_notify = |app_handle: &tauri::AppHandle, db: &DbState, retries_map: &std::sync::Arc<std::sync::Mutex<std::collections::HashMap<String, u32>>>| {
                    let now_utc = chrono::Utc::now();
                    let now_local = chrono::Local::now();

                    // Reconcile Deadlines
                    if let Ok(triggered) = Repositories::reconcile_deadlines_notifications(&db.0, now_utc) {
                        if !triggered.is_empty() {
                            for (deadline, kind) in &triggered {
                                let (title, body) = match kind {
                                    models::DeadlineNotificationKind::Approaching => (
                                        "Deadline Approaching".to_string(),
                                        format!("\"{}\" is due in {} minutes", deadline.title, deadline.notify_lead_minutes),
                                    ),
                                    models::DeadlineNotificationKind::Due => (
                                        "Deadline Due".to_string(),
                                        format!("\"{}\" is due now!", deadline.title),
                                    ),
                                    models::DeadlineNotificationKind::Missed => (
                                        "Overdue Deadline".to_string(),
                                        format!("\"{}\" was due at {}", deadline.title, deadline.due_date),
                                    ),
                                };
                                let res = windows::send_desktop_notification(&title, &body);
                                if let Err(e) = res {
                                    log::error!("Failed to send deadline notification: {e}");
                                    let _ = Repositories::reset_deadline_notification(&db.0, &deadline.id, kind);
                                }
                            }
                            let _ = app_handle.emit("deadlines-updated", &());
                        }
                    }

                    // Reconcile Alarms
                    if let Ok(triggered_alarms) = Repositories::reconcile_alarms(&db.0, now_local) {
                        if !triggered_alarms.is_empty() {
                            for (alarm, kind) in &triggered_alarms {
                                match kind {
                                    models::AlarmTriggerKind::Due => {
                                        let title = "Alarm".to_string();
                                        let body = format!("\"{}\" - {}", alarm.title, alarm.time_str);

                                        // 1. Play audible native alarm audio (loops until dismissed or 60s timeout)
                                        let audio_res = windows::audio::play_alarm_sound(&alarm.id, &alarm.title);
                                        if let Err(ref e) = audio_res {
                                            log::error!("Failed to play native alarm audio: {e}");
                                        }

                                        // 2. Dispatch native Windows toast with scenario="alarm"
                                        let toast_res = windows::send_alarm_notification(&title, &body);
                                        if let Err(ref e) = toast_res {
                                            log::error!("Failed to send alarm toast: {e}");
                                        }

                                        // 3. Emit alarm-triggered event to frontend windows
                                        let payload = serde_json::json!({
                                            "id": alarm.id,
                                            "title": alarm.title,
                                            "time_str": alarm.time_str,
                                        });
                                        let _ = app_handle.emit("alarm-triggered", &payload);

                                        // 4. Bounded retry on complete delivery failure (max 3 attempts)
                                        if audio_res.is_err() && toast_res.is_err() {
                                            let mut retries = retries_map.lock().unwrap();
                                            let count = retries.entry(alarm.id.clone()).or_insert(0);
                                            if *count < 3 {
                                                *count += 1;
                                                log::warn!("Alarm delivery failed, scheduling retry attempt {}/3 for ID {}", *count, alarm.id);
                                                let _ = Repositories::reset_alarm_trigger(&db.0, &alarm.id, alarm.is_recurring);
                                            } else {
                                                log::error!("Alarm delivery failed after 3 attempts for ID {}, stopping retries", alarm.id);
                                                retries.remove(&alarm.id);
                                            }
                                        } else if let Ok(mut retries) = retries_map.lock() {
                                            retries.remove(&alarm.id);
                                        }
                                    }
                                    models::AlarmTriggerKind::Missed => {
                                        // Missed alarm policy: do NOT play sound hours later!
                                        // Dispatch informative quiet toast notification only.
                                        let title = "Missed Alarm".to_string();
                                        let body = format!("\"{}\" was scheduled for {}", alarm.title, alarm.time_str);
                                        let _ = windows::send_desktop_notification(&title, &body);
                                    }
                                }
                            }
                            let _ = app_handle.emit("alarms-updated", &());
                        }
                    }
                };

                // Immediate startup reconciliation check
                check_and_notify(&handle_for_notifications, &db_for_notifications, &alarm_retries_clone);

                loop {
                    std::thread::sleep(std::time::Duration::from_secs(10));
                    check_and_notify(&handle_for_notifications, &db_for_notifications, &alarm_retries_clone);
                }
            });

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
            set_window_position,
            get_window_position,
            clear_window_acrylic,
            apply_window_acrylic,
            update_window_clip_region,
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
            toggle_task,
            delete_task,
            // Notes
            get_notes,
            save_note,
            toggle_pin_note,
            search_notes,
            delete_note,
            // Focus
            get_focus_session,
            start_focus_timer,
            pause_focus_timer,
            reset_focus_timer,
            add_focus_minutes,
            switch_focus_mode,
            set_focus_durations,
            tick_focus_timer,
            save_focus_session,
            // Deadlines
            get_deadlines,
            save_deadline,
            delete_deadline,
            // Daily Goals
            get_goals,
            save_goal,
            increment_goal,
            decrement_goal,
            toggle_goal,
            delete_goal,
            get_goal_history,
            // Workspaces
            get_workspaces,
            get_active_workspace,
            switch_workspace,
            save_workspace,
            save_current_workspace,
            delete_workspace,
            // Clock & Alarms
            get_world_clocks,
            save_world_clock,
            delete_world_clock,
            get_alarms,
            save_alarm,
            toggle_alarm,
            delete_alarm,
            convert_timezone,
            dismiss_alarm,
            get_active_ringing_alarm,
            // Settings
            get_settings,
            save_settings,
        ])
        .build(tauri::generate_context!())
        .expect("error while building DESKIT desktop application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit = event {
                if let (Some(debouncer), Some(db)) = (
                    app_handle.try_state::<GeometryDebouncer>(),
                    app_handle.try_state::<DbState>(),
                ) {
                    debouncer.flush_all(&db);
                }
            }
        });
}
