use tauri::WebviewWindow;

use crate::models::VisibilityMode;
use crate::windows::native::{NativeWindowError, NativeWindowExt};

pub struct VisibilityController;

impl VisibilityController {
    pub fn apply_visibility_mode(
        window: &WebviewWindow,
        mode: &VisibilityMode,
    ) -> Result<(), NativeWindowError> {
        match mode {
            VisibilityMode::AlwaysOnTop => {
                window.set_native_always_on_top(true)?;
                Ok(())
            }
            VisibilityMode::DesktopOnly => {
                // Phase 1 requirement: Do NOT fake desktop-only mode by claiming an ordinary
                // non-topmost window is embedded in the desktop wallpaper.
                // Clearly mark as unsupported in Phase 1 and fall back to standard non-topmost window.
                log::warn!("Desktop-only mode is experimental and currently unsupported; falling back to non-topmost.");
                window.set_native_always_on_top(false)?;
                Ok(())
            }
            VisibilityMode::Smart => {
                // Future configurable visibility behavior; default to non-topmost for now
                window.set_native_always_on_top(false)?;
                Ok(())
            }
        }
    }
}
