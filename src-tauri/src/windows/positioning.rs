use tauri::AppHandle;

use crate::models::WidgetType;

pub struct WindowPositioning;

impl WindowPositioning {
    /// Calculate a smart default position for a newly created widget if no saved position exists
    pub fn calculate_default_position(
        app: &AppHandle,
        widget_type: &WidgetType,
        index_offset: usize,
    ) -> (f64, f64, f64, f64) {
        let (def_w, def_h) = widget_type.default_dimensions();

        // Try to get primary monitor dimensions
        if let Ok(Some(monitor)) = app.primary_monitor() {
            let monitor_size = monitor.size();
            let scale_factor = monitor.scale_factor().max(0.5);
            let screen_w = (monitor_size.width as f64 / scale_factor).max(800.0);
            let screen_h = (monitor_size.height as f64 / scale_factor).max(600.0);

            // Default: place near top-right with margin and stagger
            let margin_x = 40.0;
            let margin_y = 60.0 + ((index_offset % 8) as f64 * 35.0);
            let x = (screen_w - def_w - margin_x).max(20.0);
            let y = margin_y.min(screen_h - def_h - 40.0);

            (x, y, def_w, def_h)
        } else {
            (100.0 + ((index_offset % 8) as f64 * 25.0), 100.0 + ((index_offset % 8) as f64 * 25.0), def_w, def_h)
        }
    }

    /// Clamp coordinates and size to sensible bounds
    pub fn sanitize_bounds(
        widget_type: &WidgetType,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> (f64, f64, f64, f64) {
        let (min_w, min_h) = widget_type.min_dimensions();
        let (max_w, max_h) = widget_type.max_dimensions();

        let clamped_w = width.clamp(min_w, max_w);
        let clamped_h = height.clamp(min_h, max_h);

        // Keep within reasonable desktop range
        let clamped_x = x.max(-200.0);
        let clamped_y = y.max(0.0);

        (clamped_x, clamped_y, clamped_w, clamped_h)
    }
}
