use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::models::{VisibilityMode, WidgetInstance, WidgetType, Workspace, WorkspaceWidgetLayout};
use crate::persistence::{DbState, Repositories};
use crate::windows::debouncer::GeometryDebouncer;
use crate::windows::factory::WindowFactory;
use crate::windows::positioning::WindowPositioning;
use crate::windows::visibility::VisibilityController;

pub struct WindowManager;

impl WindowManager {
    /// Create a new widget instance or bring an existing one to front
    pub fn pin_widget(
        app: &AppHandle,
        db_state: &DbState,
        widget_type: WidgetType,
        custom_title: Option<String>,
    ) -> Result<WidgetInstance, Box<dyn std::error::Error>> {
        let existing_widgets = Repositories::get_all_widgets(&db_state.0)?;

        // If clock or single-instance type already exists, restore it instead of creating duplicates
        let existing = existing_widgets
            .iter()
            .find(|w| w.widget_type == widget_type && w.is_pinned);

        if let Some(instance) = existing {
            let label = format!("widget-{}-{}", instance.widget_type.as_str(), instance.id);
            if let Some(win) = app.get_webview_window(&label) {
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
                return Ok(instance.clone());
            } else {
                // Window was closed/hidden; re-create it
                let win = WindowFactory::create_widget_window(app, instance, db_state.clone())?;
                let _ = win.show();
                let _ = win.unminimize();
                let _ = win.set_focus();
                return Ok(instance.clone());
            }
        }

        // Calculate staggered position
        let (x, y, width, height) = WindowPositioning::calculate_default_position(
            app,
            &widget_type,
            existing_widgets.len(),
        );

        let id = uuid::Uuid::new_v4().to_string();
        let title = custom_title.unwrap_or_else(|| match widget_type {
            WidgetType::Clock => "Clock".to_string(),
            WidgetType::Tasks => "Tasks".to_string(),
            WidgetType::Focus => "Focus Timer".to_string(),
            WidgetType::Notes => "Quick Notes".to_string(),
            WidgetType::Deadlines => "Deadlines".to_string(),
            WidgetType::Goals => "Daily Goals".to_string(),
        });

        let now = chrono::Utc::now().to_rfc3339();
        let instance = WidgetInstance {
            id: id.clone(),
            widget_type: widget_type.clone(),
            title: title.clone(),
            x,
            y,
            width,
            height,
            is_pinned: true,
            visibility_mode: VisibilityMode::AlwaysOnTop,
            is_collapsed: false,
            config_json: "{}".to_string(),
            created_at: now.clone(),
            updated_at: now,
        };

        // Persist to database
        Repositories::save_widget(&db_state.0, &instance)?;

        // Also add to the currently active workspace
        if let Ok(mut active_ws) = Repositories::get_active_workspace(&db_state.0) {
            active_ws.widgets.push(WorkspaceWidgetLayout {
                widget_id: instance.id.clone(),
                widget_type: instance.widget_type.clone(),
                title: instance.title.clone(),
                x: instance.x,
                y: instance.y,
                width: instance.width,
                height: instance.height,
                is_pinned: true,
                visibility_mode: instance.visibility_mode.clone(),
                is_collapsed: false,
                lock_position: false,
                config_json: instance.config_json.clone(),
            });
            let _ = Repositories::save_workspace(&db_state.0, &active_ws);
        }

        // Automatically ensure launch_at_login is enabled so pinned widgets survive reboots
        if let Ok(mut settings) = Repositories::get_app_settings(&db_state.0) {
            if !settings.launch_at_login {
                settings.launch_at_login = true;
                let _ = Repositories::save_app_settings(&db_state.0, &settings);
                let _ = app.autolaunch().enable();
                let _ = app.emit("settings-updated", &settings);
            }
        }

        // Create the native window
        WindowFactory::create_widget_window(app, &instance, db_state.clone())?;

        Ok(instance)
    }

    /// Restore all previously pinned widgets upon application startup
    pub fn restore_pinned_widgets(
        app: &AppHandle,
        db_state: &DbState,
    ) -> Result<usize, Box<dyn std::error::Error>> {
        let active_ws = Repositories::get_active_workspace(&db_state.0)
            .unwrap_or_else(|_| Workspace {
                id: "default".to_string(),
                name: "Default Workspace".to_string(),
                description: String::new(),
                is_active: true,
                widgets: Vec::new(),
                created_at: String::new(),
                updated_at: String::new(),
            });

        let mut restored = 0;

        if !active_ws.widgets.is_empty() {
            for w in active_ws.widgets.into_iter().filter(|w| w.is_pinned) {
                let (cx, cy, cw, ch) = WindowPositioning::clamp_to_visible_screen(
                    app,
                    w.x,
                    w.y,
                    w.width,
                    w.height,
                );
                let instance = WidgetInstance {
                    id: w.widget_id,
                    widget_type: w.widget_type,
                    title: w.title,
                    x: cx,
                    y: cy,
                    width: cw,
                    height: ch,
                    is_pinned: true,
                    visibility_mode: w.visibility_mode,
                    is_collapsed: w.is_collapsed,
                    config_json: w.config_json,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                };
                match WindowFactory::create_widget_window(app, &instance, db_state.clone()) {
                    Ok(_) => restored += 1,
                    Err(err) => log::error!("Failed to restore widget {}: {}", instance.id, err),
                }
            }
        } else {
            let widgets = Repositories::get_all_widgets(&db_state.0)?;
            for widget in widgets.into_iter().filter(|w| w.is_pinned) {
                match WindowFactory::create_widget_window(app, &widget, db_state.clone()) {
                    Ok(_) => restored += 1,
                    Err(err) => log::error!("Failed to restore widget {}: {}", widget.id, err),
                }
            }
        }

        Ok(restored)
    }

    /// Switch to a target workspace
    pub fn switch_workspace(
        app: &AppHandle,
        db_state: &DbState,
        target_workspace_id: &str,
    ) -> Result<Workspace, Box<dyn std::error::Error>> {
        // 1. Flush debouncer so current window positions are recorded
        if let Some(deb) = app.try_state::<GeometryDebouncer>() {
            deb.flush_all(db_state);
        }

        // 2. Save current live window positions for the currently active workspace
        if let Ok(current_ws) = Repositories::get_active_workspace(&db_state.0) {
            for w in &current_ws.widgets {
                let label = format!("widget-{}-{}", w.widget_type.as_str(), w.widget_id);
                if let Some(win) = app.get_webview_window(&label) {
                    if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                        let _ = Repositories::update_workspace_widget_geometry(
                            &db_state.0,
                            &current_ws.id,
                            &w.widget_id,
                            pos.x as f64,
                            pos.y as f64,
                            size.width as f64,
                            size.height as f64,
                        );
                    }
                }
            }
        }

        // 3. Set active workspace in database
        let target_ws = Repositories::set_active_workspace(&db_state.0, target_workspace_id)?;

        // 4. Identify target widgets
        let target_ids: std::collections::HashSet<String> = target_ws
            .widgets
            .iter()
            .map(|w| w.widget_id.clone())
            .collect();

        // Hide any open widget window that is NOT in the target workspace
        for (label, win) in app.webview_windows() {
            if label.starts_with("widget-") {
                let is_in_target = target_ids.iter().any(|id| label.ends_with(id));
                if !is_in_target {
                    let _ = win.hide();
                }
            }
        }

        // 5. Restore, position, and reveal all target widgets
        for w in &target_ws.widgets {
            if !w.is_pinned {
                continue;
            }

            let (cx, cy, cw, ch) = WindowPositioning::clamp_to_visible_screen(
                app,
                w.x,
                w.y,
                w.width,
                w.height,
            );

            let label = format!("widget-{}-{}", w.widget_type.as_str(), w.widget_id);

            if let Some(win) = app.get_webview_window(&label) {
                let _ = win.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(cx, cy)));
                let _ = win.set_size(tauri::LogicalSize::new(cw, ch));
                let _ = win.set_always_on_top(w.visibility_mode == VisibilityMode::AlwaysOnTop);
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            } else {
                let instance = WidgetInstance {
                    id: w.widget_id.clone(),
                    widget_type: w.widget_type.clone(),
                    title: w.title.clone(),
                    x: cx,
                    y: cy,
                    width: cw,
                    height: ch,
                    is_pinned: true,
                    visibility_mode: w.visibility_mode.clone(),
                    is_collapsed: w.is_collapsed,
                    config_json: w.config_json.clone(),
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                };
                let _ = WindowFactory::create_widget_window(app, &instance, db_state.clone());
            }

            let instance = WidgetInstance {
                id: w.widget_id.clone(),
                widget_type: w.widget_type.clone(),
                title: w.title.clone(),
                x: cx,
                y: cy,
                width: cw,
                height: ch,
                is_pinned: true,
                visibility_mode: w.visibility_mode.clone(),
                is_collapsed: w.is_collapsed,
                config_json: w.config_json.clone(),
                created_at: chrono::Utc::now().to_rfc3339(),
                updated_at: chrono::Utc::now().to_rfc3339(),
            };
            let _ = Repositories::save_widget(&db_state.0, &instance);
        }

        // 6. Emit sync events to notify manager and widgets
        let _ = app.emit("workspace-switched", &target_ws);
        let _ = app.emit("widgets-updated", &target_ws.widgets);

        Ok(target_ws)
    }

    /// Save the current desktop layout as a new or updated workspace
    pub fn save_current_workspace(
        app: &AppHandle,
        db_state: &DbState,
        id: Option<String>,
        name: String,
        description: Option<String>,
    ) -> Result<Workspace, Box<dyn std::error::Error>> {
        if let Some(deb) = app.try_state::<GeometryDebouncer>() {
            deb.flush_all(db_state);
        }

        let all_widgets = Repositories::get_all_widgets(&db_state.0)?;
        let mut layouts = Vec::new();

        for w in all_widgets.into_iter().filter(|w| w.is_pinned) {
            let label = format!("widget-{}-{}", w.widget_type.as_str(), w.id);
            let (mut x, mut y, mut width, mut height) = (w.x, w.y, w.width, w.height);
            if let Some(win) = app.get_webview_window(&label) {
                if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                    x = pos.x as f64;
                    y = pos.y as f64;
                    if size.width > 80 && size.height > 30 {
                        width = size.width as f64;
                        height = size.height as f64;
                    }
                }
            }

            layouts.push(WorkspaceWidgetLayout {
                widget_id: w.id,
                widget_type: w.widget_type,
                title: w.title,
                x,
                y,
                width,
                height,
                is_pinned: true,
                visibility_mode: w.visibility_mode,
                is_collapsed: w.is_collapsed,
                lock_position: false,
                config_json: w.config_json,
            });
        }

        let ws_id = id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let ws = Workspace {
            id: ws_id,
            name,
            description: description.unwrap_or_default(),
            is_active: true,
            widgets: layouts,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        let saved = Repositories::save_workspace(&db_state.0, &ws)?;
        let _ = Repositories::set_active_workspace(&db_state.0, &saved.id);
        let _ = app.emit("workspace-updated", &saved);
        Ok(saved)
    }

    /// Hide window without removing widget
    pub fn hide_widget(app: &AppHandle, widget_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        for (_, window) in app.webview_windows() {
            if window.label().ends_with(widget_id) {
                window.hide()?;
                break;
            }
        }
        Ok(())
    }

    /// Unpin widget: close window and mark unpinned in database
    pub fn unpin_widget(
        app: &AppHandle,
        db_state: &DbState,
        widget_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for (label, window) in app.webview_windows() {
            if label.ends_with(widget_id) {
                let _ = window.close();
                break;
            }
        }
        Repositories::update_widget_pinned(&db_state.0, widget_id, false)?;
        Ok(())
    }

    /// Explicitly remove widget: destroy window and delete record from database
    pub fn remove_widget(
        app: &AppHandle,
        db_state: &DbState,
        widget_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(deb) = app.try_state::<GeometryDebouncer>() {
            deb.evict(widget_id);
        }
        for (label, window) in app.webview_windows() {
            if label.ends_with(widget_id) {
                let _ = window.destroy();
                break;
            }
        }
        Repositories::delete_widget(&db_state.0, widget_id)?;
        Ok(())
    }

    /// Update visibility mode for widget
    pub fn set_visibility_mode(
        app: &AppHandle,
        db_state: &DbState,
        widget_id: &str,
        mode: VisibilityMode,
    ) -> Result<(), Box<dyn std::error::Error>> {
        for (label, window) in app.webview_windows() {
            if label.ends_with(widget_id) {
                VisibilityController::apply_visibility_mode(&window, &mode)?;
                break;
            }
        }
        Repositories::update_widget_visibility_mode(&db_state.0, widget_id, mode.as_str())?;
        Ok(())
    }
}
