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
}

#[cfg(target_os = "windows")]
mod win32_impl {
    use super::*;
    use windows::core::s;
    use windows::Win32::Foundation::HWND;
    use windows::Win32::System::LibraryLoader::{GetProcAddress, LoadLibraryA};
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

    type DwmSetWindowAttributeFn = unsafe extern "system" fn(
        hwnd: HWND,
        dw_attribute: u32,
        pv_attribute: *const std::ffi::c_void,
        cb_attribute: u32,
    ) -> windows::core::HRESULT;

    pub fn apply_backdrop(window: &WebviewWindow) -> Result<(), NativeWindowError> {
        let hwnd_raw = window
            .hwnd()
            .map_err(|e| NativeWindowError::HwndError(e.to_string()))?;

        let hwnd = HWND(hwnd_raw.0 as _);

        unsafe {
            if let Ok(dwmapi) = LoadLibraryA(s!("dwmapi.dll")) {
                if let Some(func_ptr) = GetProcAddress(dwmapi, s!("DwmSetWindowAttribute")) {
                    let set_window_attribute: DwmSetWindowAttributeFn = std::mem::transmute(func_ptr);

                    // 1. Force Immersive Dark Mode: DWMWA_USE_IMMERSIVE_DARK_MODE = 20
                    let dark_mode: i32 = 1;
                    let _ = set_window_attribute(
                        hwnd,
                        20,
                        &dark_mode as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<i32>() as u32,
                    );

                    // 2. Set Caption & Border to Dark Graphite #242421 (COLORREF: 0x00212424)
                    let caption_color: u32 = 0x00212424;
                    let _ = set_window_attribute(
                        hwnd,
                        35, // DWMWA_CAPTION_COLOR
                        &caption_color as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<u32>() as u32,
                    );
                    let _ = set_window_attribute(
                        hwnd,
                        34, // DWMWA_BORDER_COLOR
                        &caption_color as *const _ as *const std::ffi::c_void,
                        std::mem::size_of::<u32>() as u32,
                    );
                }
            }
        }

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
}
