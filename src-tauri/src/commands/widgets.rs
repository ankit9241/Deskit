use tauri::{AppHandle, Emitter, State};

use crate::models::{VisibilityMode, WidgetInstance, WidgetType};
use crate::persistence::{DbState, Repositories};
use crate::windows::WindowManager;

#[tauri::command]
pub fn get_widgets(db: State<'_, DbState>) -> Result<Vec<WidgetInstance>, String> {
    Repositories::get_all_widgets(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn pin_widget(
    app: AppHandle,
    db: State<'_, DbState>,
    widget_type: String,
    title: Option<String>,
) -> Result<WidgetInstance, String> {
    let w_type = WidgetType::from_str(&widget_type)
        .ok_or_else(|| format!("Invalid widget type: {}", widget_type))?;

    let instance = WindowManager::pin_widget(&app, &db, w_type, title)
        .map_err(|e| format!("Failed to pin widget: {}", e))?;

    let _ = app.emit("widget-updated", &instance);
    Ok(instance)
}

#[tauri::command]
pub fn unpin_widget(
    app: AppHandle,
    db: State<'_, DbState>,
    widget_id: String,
) -> Result<(), String> {
    WindowManager::unpin_widget(&app, &db, &widget_id)
        .map_err(|e| format!("Failed to unpin widget: {}", e))?;

    let _ = app.emit("widget-updated", &widget_id);
    Ok(())
}

#[tauri::command]
pub fn remove_widget(
    app: AppHandle,
    db: State<'_, DbState>,
    widget_id: String,
) -> Result<(), String> {
    WindowManager::remove_widget(&app, &db, &widget_id)
        .map_err(|e| format!("Failed to remove widget: {}", e))?;

    let _ = app.emit("widget-removed", &widget_id);
    Ok(())
}

#[tauri::command]
pub fn set_widget_visibility(
    app: AppHandle,
    db: State<'_, DbState>,
    widget_id: String,
    visibility_mode: String,
) -> Result<(), String> {
    let mode = VisibilityMode::from_str(&visibility_mode);
    WindowManager::set_visibility_mode(&app, &db, &widget_id, mode)
        .map_err(|e| format!("Failed to set visibility mode: {}", e))?;

    let _ = app.emit("widget-updated", &widget_id);
    Ok(())
}

#[tauri::command]
pub fn toggle_collapse_widget(
    app: AppHandle,
    db: State<'_, DbState>,
    widget_id: String,
    is_collapsed: bool,
) -> Result<(), String> {
    Repositories::update_widget_collapsed(&db.0, &widget_id, is_collapsed)
        .map_err(|e| format!("Failed to collapse widget: {}", e))?;

    let _ = app.emit("widget-updated", &widget_id);
    Ok(())
}
