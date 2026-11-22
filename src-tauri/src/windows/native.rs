use tauri::WebviewWindow;

#[derive(Debug, thiserror::Error)]
pub enum NativeWindowError {
    #[error("Platform error: {0}")]
    PlatformError(String),
    #[error("Failed to retrieve HWND: {0}")]
    HwndError(String),
    #[error("Win32 SetWindowPos failed with code {0}")]
    Win32Error(u32),
}

pub trait NativeWindowExt {
    fn set_native_always_on_top(&self, enable: bool) -> Result<(), NativeWindowError>;
    fn apply_native_backdrop(&self) -> Result<(), NativeWindowError>;
    fn update_window_clip_region(&self, is_collapsed: bool, radius: u32) -> Result<(), NativeWindowError>;
}

#[cfg(target_os = "windows")]
mod win32_impl {
    use super::*;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::UI::WindowsAndMessaging::{
        SetWindowPos, HWND_NOTOPMOST, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    };

    pub fn set_topmost(window: &WebviewWindow, enable: bool) -> Result<(), NativeWindowError> {
        let hwnd_raw = window
            .hwnd()
            .map_err(|e| NativeWindowError::HwndError(e.to_string()))?;

        let hwnd = HWND(hwnd_raw.0 as _);

        let insert_after = if enable {
            HWND_TOPMOST
        } else {
            HWND_NOTOPMOST
        };

        let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE;

        unsafe {
            if let Err(err) = SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, flags) {
                return Err(NativeWindowError::Win32Error(err.code().0 as u32));
            }
        }

        let _ = window.set_always_on_top(enable);

        Ok(())
    }

    pub fn apply_backdrop(window: &WebviewWindow) -> Result<(), NativeWindowError> {
        // Enable immersive dark mode so Windows DWM applies dark theme materials
        if let Ok(hwnd_raw) = window.hwnd() {
            unsafe {
                let hwnd = HWND(hwnd_raw.0 as _);

                let dark: u32 = 1;
                let _ = windows::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                    hwnd,
                    windows::Win32::Graphics::Dwm::DWMWA_USE_IMMERSIVE_DARK_MODE,
                    &dark as *const _ as _,
                    std::mem::size_of::<u32>() as u32,
                );

                // DWMWA_WINDOW_CORNER_PREFERENCE:
                // Apply native DWM rounded corners (DWMWCP_ROUND).
                // Do NOT use SetWindowRgn as GDI regions force Windows to draw the legacy
                // OS window caption/titlebar tab (- □ X) behind undecorated windows.
                let corner_pref: u32 = windows::Win32::Graphics::Dwm::DWMWCP_ROUND.0 as u32;
                let _ = windows::Win32::Graphics::Dwm::DwmSetWindowAttribute(
                    hwnd,
                    windows::Win32::Graphics::Dwm::DWMWA_WINDOW_CORNER_PREFERENCE,
                    &corner_pref as *const _ as _,
                    std::mem::size_of::<u32>() as u32,
                );

                // Ensure any previous GDI window region is completely removed so the OS window
                // remains 100% frameless and undecorated with no titlebar tab.
                let _ = windows::Win32::Graphics::Gdi::SetWindowRgn(
                    hwnd,
                    windows::Win32::Graphics::Gdi::HRGN(std::ptr::null_mut()),
                    true,
                );
            }
        }

        Ok(())
    }

    pub fn update_clip_region(
        _window: &WebviewWindow,
        _is_collapsed: bool,
        _radius: u32,
    ) -> Result<(), NativeWindowError> {
        Ok(())
    }
}

#[cfg(not(target_os = "windows"))]
mod fallback_impl {
    use super::*;

    pub fn set_topmost(window: &WebviewWindow, enable: bool) -> Result<(), NativeWindowError> {
        window
            .set_always_on_top(enable)
            .map_err(|e| NativeWindowError::PlatformError(e.to_string()))?;
        Ok(())
    }

    pub fn apply_backdrop(_window: &WebviewWindow) -> Result<(), NativeWindowError> {
        Ok(())
    }

    pub fn update_clip_region(_window: &WebviewWindow, _is_collapsed: bool, _radius: u32) -> Result<(), NativeWindowError> {
        Ok(())
    }
}

impl NativeWindowExt for WebviewWindow {
    fn set_native_always_on_top(&self, enable: bool) -> Result<(), NativeWindowError> {
        #[cfg(target_os = "windows")]
        {
            win32_impl::set_topmost(self, enable)
        }
        #[cfg(not(target_os = "windows"))]
        {
            fallback_impl::set_topmost(self, enable)
        }
    }

    fn apply_native_backdrop(&self) -> Result<(), NativeWindowError> {
        #[cfg(target_os = "windows")]
        {
            win32_impl::apply_backdrop(self)
        }
        #[cfg(not(target_os = "windows"))]
        {
            fallback_impl::apply_backdrop(self)
        }
    }

    fn update_window_clip_region(&self, is_collapsed: bool, radius: u32) -> Result<(), NativeWindowError> {
        #[cfg(target_os = "windows")]
        {
            win32_impl::update_clip_region(self, is_collapsed, radius)
        }
        #[cfg(not(target_os = "windows"))]
        {
            fallback_impl::update_clip_region(self, is_collapsed, radius)
        }
    }
}
