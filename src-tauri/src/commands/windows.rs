use tauri::WebviewWindow;

use crate::windows::native::NativeWindowExt;

#[tauri::command]
pub fn start_dragging(window: WebviewWindow) -> Result<(), String> {
    window.start_dragging().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn minimize_window(window: WebviewWindow) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn hide_window(window: WebviewWindow) -> Result<(), String> {
    window.hide().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn close_window(window: WebviewWindow) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_native_topmost(window: WebviewWindow, enable: bool) -> Result<(), String> {
    window
        .set_native_always_on_top(enable)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_window_size(window: WebviewWindow, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(tauri::LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_window_clip_region(
    window: WebviewWindow,
    is_collapsed: bool,
    radius: Option<u32>,
) -> Result<(), String> {
    window
        .update_window_clip_region(is_collapsed, radius.unwrap_or(28))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_window_position(window: WebviewWindow, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(tauri::Position::Logical(tauri::LogicalPosition::new(x, y)))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_window_position(window: WebviewWindow) -> Result<(f64, f64), String> {
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    Ok((pos.x as f64, pos.y as f64))
}

#[tauri::command]
pub fn clear_window_acrylic(window: WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        crate::windows::factory::WindowFactory::clear_native_effect(&window);
    }
    Ok(())
}

#[tauri::command]
pub fn apply_window_acrylic(window: WebviewWindow) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        crate::windows::factory::WindowFactory::apply_native_effect(&window);
    }
    Ok(())
}
