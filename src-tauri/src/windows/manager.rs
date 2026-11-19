use tauri::{AppHandle, Manager};

use crate::models::{VisibilityMode, WidgetInstance, WidgetType};
use crate::persistence::{DbState, Repositories};
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
            widget_type,
            title,
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

        // Create the native window
        WindowFactory::create_widget_window(app, &instance, db_state.clone())?;

        Ok(instance)
    }

    /// Restore all previously pinned widgets upon application startup
    pub fn restore_pinned_widgets(
        app: &AppHandle,
        db_state: &DbState,
    ) -> Result<usize, Box<dyn std::error::Error>> {
        let widgets = Repositories::get_all_widgets(&db_state.0)?;
        let mut restored = 0;

        for widget in widgets.into_iter().filter(|w| w.is_pinned) {
            match WindowFactory::create_widget_window(app, &widget, db_state.clone()) {
                Ok(_) => restored += 1,
                Err(err) => {
                    log::error!("Failed to restore widget window {}: {}", widget.id, err);
                }
            }
        }

        Ok(restored)
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
