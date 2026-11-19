use tauri::{AppHandle, Emitter, State};
use tauri_plugin_autostart::ManagerExt;

use crate::models::AppSettings;
use crate::persistence::{DbState, Repositories};

#[tauri::command]
pub fn get_settings(db: State<'_, DbState>) -> Result<AppSettings, String> {
    Repositories::get_app_settings(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(
    app: AppHandle,
    db: State<'_, DbState>,
    settings: AppSettings,
) -> Result<AppSettings, String> {
    // Configure autostart plugin if launch_at_login was modified
    let autostart_manager = app.autolaunch();
    if settings.launch_at_login {
        let _ = autostart_manager.enable();
    } else {
        let _ = autostart_manager.disable();
    }

    Repositories::save_app_settings(&db.0, &settings).map_err(|e| e.to_string())?;
    let _ = app.emit("settings-updated", &settings);
    Ok(settings)
}
