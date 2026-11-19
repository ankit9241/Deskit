use tauri::{window::Color, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::models::{VisibilityMode, WidgetInstance};
use crate::persistence::DbState;
use crate::windows::native::NativeWindowExt;

pub struct WindowFactory;

impl WindowFactory {
    pub fn create_widget_window(
        app: &AppHandle,
        widget: &WidgetInstance,
        _db_state: DbState,
    ) -> Result<WebviewWindow, Box<dyn std::error::Error>> {
        let label = format!("widget-{}-{}", widget.widget_type.as_str(), widget.id);

        // If window already exists, restore and focus it
        if let Some(existing_window) = app.get_webview_window(&label) {
            let _ = existing_window.show();
            let _ = existing_window.unminimize();
            let _ = existing_window.set_focus();
            return Ok(existing_window);
        }

        let (_, _) = widget.widget_type.min_dimensions();
        let (max_w, max_h) = widget.widget_type.max_dimensions();

        let init_script = format!(
            "window.__PINNED_WIDGET__ = {{ id: '{}', type: '{}' }};",
            widget.id,
            widget.widget_type.as_str()
        );

        // Explicitly encode widget routing parameters in URL for instant synchronous resolution
        let route_query = format!("index.html?widget_id={}&type={}", widget.id, widget.widget_type.as_str());
        let webview_url = WebviewUrl::App(route_query.into());

        let window = WebviewWindowBuilder::new(app, &label, webview_url)
            .title(&widget.title)
            .inner_size(widget.width, widget.height)
            .min_inner_size(100.0, 32.0)
            .max_inner_size(max_w, max_h)
            .position(widget.x, widget.y)
            .decorations(false)
            .shadow(true)
            .resizable(true)
            .always_on_top(widget.visibility_mode == VisibilityMode::AlwaysOnTop)
            .transparent(true)
            .background_color(Color(36, 36, 33, 255))
            .visible(false)
            .skip_taskbar(false)
            .initialization_script(&init_script)
            .build()?;

        // Apply dark mode styling to window frame
        let _ = window.apply_native_backdrop();

        // Reveal window with dark warm graphite surface already initialized (no white flash)
        let _ = window.show();
        let _ = window.set_focus();

        Ok(window)
    }
}
