use tauri::{window::Color, AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::models::{VisibilityMode, WidgetInstance};
use crate::persistence::{DbState, Repositories};
use crate::windows::debouncer::GeometryDebouncer;
use crate::windows::native::NativeWindowExt;
use crate::windows::positioning::WindowPositioning;

pub const WIDGET_ACRYLIC_TINT: (u8, u8, u8, u8) = (20, 20, 24, 25);

pub struct WindowFactory;

impl WindowFactory {
    #[cfg(target_os = "windows")]
    pub fn apply_native_effect(window: &WebviewWindow) {
        let _ = window_vibrancy::apply_acrylic(window, Some(WIDGET_ACRYLIC_TINT));
    }

    #[cfg(target_os = "windows")]
    pub fn clear_native_effect(window: &WebviewWindow) {
        let _ = window_vibrancy::clear_acrylic(window);
    }

    #[cfg(not(target_os = "windows"))]
    pub fn apply_native_effect(_window: &WebviewWindow) {}

    #[cfg(not(target_os = "windows"))]
    pub fn clear_native_effect(_window: &WebviewWindow) {}
    pub fn create_widget_window(
        app: &AppHandle,
        widget: &WidgetInstance,
        _db_state: DbState,
    ) -> Result<WebviewWindow, Box<dyn std::error::Error>> {
        let label = format!("widget-{}-{}", widget.widget_type.as_str(), widget.id);

        // Clamp window coordinates to current monitor(s) so disconnected displays don't hide windows
        let (clamped_x, clamped_y, clamped_w, clamped_h) = WindowPositioning::clamp_to_visible_screen(
            app,
            widget.x,
            widget.y,
            widget.width,
            widget.height,
        );

        // If window already exists, restore and focus it
        if let Some(existing_window) = app.get_webview_window(&label) {
            let (target_w, target_h) = if widget.is_collapsed {
                match widget.widget_type {
                    crate::models::WidgetType::Clock => (158.0, 42.0),
                    crate::models::WidgetType::Focus => (168.0, 42.0),
                    crate::models::WidgetType::Tasks => (168.0, 42.0),
                    crate::models::WidgetType::Notes => (158.0, 42.0),
                    crate::models::WidgetType::Deadlines => (172.0, 42.0),
                    crate::models::WidgetType::Goals => (158.0, 42.0),
                }
            } else {
                (clamped_w, clamped_h)
            };

            let _ = existing_window.set_position(tauri::Position::Logical(tauri::LogicalPosition::new(
                clamped_x, clamped_y,
            )));
            let _ = existing_window.set_size(tauri::LogicalSize::new(target_w, target_h));
            let _ = existing_window.show();
            let _ = existing_window.unminimize();
            let _ = existing_window.set_focus();
            return Ok(existing_window);
        }

        let (_, _) = widget.widget_type.min_dimensions();
        let (max_w, max_h) = widget.widget_type.max_dimensions();

        let (initial_w, initial_h) = if widget.is_collapsed {
            match widget.widget_type {
                crate::models::WidgetType::Clock => (158.0, 42.0),
                crate::models::WidgetType::Focus => (168.0, 42.0),
                crate::models::WidgetType::Tasks => (168.0, 42.0),
                crate::models::WidgetType::Notes => (158.0, 42.0),
                crate::models::WidgetType::Deadlines => (172.0, 42.0),
                crate::models::WidgetType::Goals => (158.0, 42.0),
            }
        } else {
            (clamped_w, clamped_h)
        };

        let init_script = format!(
            "window.__DESKIT_WIDGET__ = {{ id: '{}', type: '{}' }};",
            widget.id,
            widget.widget_type.as_str()
        );

        let webview_url = WebviewUrl::default();

        let window = WebviewWindowBuilder::new(app, &label, webview_url)
            .title(&widget.title)
            .inner_size(initial_w, initial_h)
            .min_inner_size(100.0, 32.0)
            .max_inner_size(max_w, max_h)
            .position(clamped_x, clamped_y)
            .decorations(false)
            .shadow(true)
            .resizable(true)
            .always_on_top(widget.visibility_mode == VisibilityMode::AlwaysOnTop)
            .transparent(true)
            .background_color(Color(0, 0, 0, 0))
            .visible(false)
            .skip_taskbar(false)
            .initialization_script(&init_script)
            .build()?;

        // Apply native Windows blur or acrylic blur-behind to transparent window
        #[cfg(target_os = "windows")]
        {
            WindowFactory::apply_native_effect(&window);
        }

        // Apply dark mode styling and DWM rounded corners to window frame
        let _ = window.apply_native_backdrop();

        // Automatically persist live window position and size changes to SQLite via debouncer
        let db_for_events = _db_state.clone();
        let widget_id = widget.id.clone();
        let win_for_events = window.clone();
        let debouncer_opt = app.try_state::<GeometryDebouncer>().map(|d| (*d).clone());

        window.on_window_event(move |event| {
            match event {
                tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                    if let (Ok(pos), Ok(size)) = (win_for_events.outer_position(), win_for_events.outer_size()) {
                        let is_collapsed = Repositories::get_widget_by_id(&db_for_events.0, &widget_id)
                            .ok()
                            .flatten()
                            .map(|w| w.is_collapsed)
                            .unwrap_or(false);

                        if let Some(ref deb) = debouncer_opt {
                            deb.record(
                                widget_id.clone(),
                                pos.x as f64,
                                pos.y as f64,
                                size.width as f64,
                                size.height as f64,
                                is_collapsed,
                            );
                        } else {
                            if is_collapsed {
                                let _ = Repositories::update_widget_position(
                                    &db_for_events.0,
                                    &widget_id,
                                    pos.x as f64,
                                    pos.y as f64,
                                );
                            } else if size.width > 80 && size.height > 30 {
                                let _ = Repositories::update_widget_geometry(
                                    &db_for_events.0,
                                    &widget_id,
                                    pos.x as f64,
                                    pos.y as f64,
                                    size.width as f64,
                                    size.height as f64,
                                );
                            }
                        }
                    }
                }
                _ => {}
            }
        });

        // Reveal window with dark warm graphite surface already initialized (no white flash)
        let _ = window.show();
        let _ = window.set_focus();

        Ok(window)
    }
}
