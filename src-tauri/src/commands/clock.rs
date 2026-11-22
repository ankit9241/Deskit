use tauri::{AppHandle, Emitter, State};

use crate::models::{utc_to_local, Alarm, WorldClock};
use crate::persistence::{DbState, Repositories};

#[tauri::command]
pub fn get_world_clocks(db: State<'_, DbState>) -> Result<Vec<WorldClock>, String> {
    Repositories::get_world_clocks(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_world_clock(
    app: AppHandle,
    db: State<'_, DbState>,
    clock: WorldClock,
) -> Result<WorldClock, String> {
    let saved = Repositories::save_world_clock(&db.0, &clock).map_err(|e| e.to_string())?;
    let _ = app.emit("world-clocks-updated", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn delete_world_clock(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_world_clock(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("world-clock-deleted", &id);
    Ok(())
}

#[tauri::command]
pub fn get_alarms(db: State<'_, DbState>) -> Result<Vec<Alarm>, String> {
    Repositories::get_alarms(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_alarm(app: AppHandle, db: State<'_, DbState>, alarm: Alarm) -> Result<Alarm, String> {
    let saved = Repositories::save_alarm(&db.0, &alarm).map_err(|e| e.to_string())?;
    let _ = app.emit("alarms-updated", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn toggle_alarm(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<Alarm, String> {
    let updated = Repositories::toggle_alarm(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("alarms-updated", &updated);
    Ok(updated)
}

#[tauri::command]
pub fn delete_alarm(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_alarm(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("alarms-updated", &id);
    Ok(())
}

#[tauri::command]
pub fn dismiss_alarm(app: AppHandle, id: Option<String>) -> Result<(), String> {
    crate::windows::audio::stop_alarm_sound().map_err(|e| e.to_string())?;
    let _ = app.emit("alarm-dismissed", &id);
    Ok(())
}

#[tauri::command]
pub fn get_active_ringing_alarm() -> Result<Option<String>, String> {
    Ok(crate::windows::audio::get_ringing_alarm_id())
}

#[tauri::command]
pub fn convert_timezone(tz: String, dt_utc_iso: Option<String>) -> Result<String, String> {
    let dt_utc = if let Some(iso) = dt_utc_iso {
        chrono::DateTime::parse_from_rfc3339(&iso)
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .map_err(|e| format!("Invalid UTC datetime: {}", e))?
    } else {
        chrono::Utc::now()
    };

    let local_naive = utc_to_local(&tz, dt_utc)?;
    Ok(local_naive.format("%Y-%m-%d %H:%M:%S").to_string())
}
