# DESKIT — Windows 10 & 11 Native Integration

> **Module:** `src-tauri/src/windows/native.rs`  
> **Platform Target:** Windows 10 & 11 (64-bit)  
> **Primary Technology:** Win32 User32 APIs via `windows` crate (v0.58)

---

## 1. Native HWND Retrieval

Tauri 2 exposes the underlying Windows `HWND` handle via `window.hwnd()`:

```rust
let hwnd = window.hwnd().map_err(|e| NativeWindowError::TauriError(e.to_string()))?;
```

The HWND is safely cast to `windows::Win32::Foundation::HWND(hwnd.0 as _)`.

---

## 2. Real Always-On-Top via `SetWindowPos`

To ensure widget windows float natively above normal user applications (such as Google Chrome, Visual Studio Code, Microsoft Office, Windows Terminal) without standard Windows window stacking limitations:

```rust
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowPos,
    HWND_NOTOPMOST,
    HWND_TOPMOST,
    SWP_NOACTIVATE,
    SWP_NOMOVE,
    SWP_NOSIZE,
};

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
```

### Win32 Flag Breakdown

| Flag | Purpose | Architectural Rationale |
|---|---|---|
| `HWND_TOPMOST` | Places window above all non-topmost windows | Essential to ensure widgets float above active apps |
| `HWND_NOTOPMOST` | Relinquishes topmost position back to normal tier | Used when user unpins or sets normal visibility |
| `SWP_NOACTIVATE` | Does not activate the window | **Critical:** Prevents stealing keyboard/mouse focus from the user's active application when pinning |
| `SWP_NOMOVE` | Retains current position | Prevents Windows DWM from resetting coordinates to `(0, 0)` |
| `SWP_NOSIZE` | Retains current dimensions | Prevents Windows DWM from resetting width/height |

---

## 3. Frameless, Transparent Window Mechanics

Tauri widget windows are created with native frameless attributes:

- `decorations(false)`: Removes Windows title bar, system menu, and default borders.
- `transparent(true)`: Enables transparent alpha composition for modern floating widget styling.
- `shadow(false)`: Eliminates default thick drop shadows that clash with custom widget cards.
- `skip_taskbar(true)`: Pinned widget windows do not clutter the Windows Taskbar with individual icons; management occurs through the DESKIT Manager and System Tray.

### Explicit Drag Region (`data-tauri-drag-region`)

To prevent entire interactive components (input fields, buttons, scrollbars, checkboxes) from intercepting window drag gestures:
- Only dedicated header/drag handle elements carry the HTML attribute `data-tauri-drag-region`.
- The rest of the widget body remains fully responsive to mouse selection, clicks, and scrolling.

---

## 4. Visibility Mode Implementation Matrix

| Mode | Phase 1 Status | Implementation Details |
|---|---|---|
| **Always On Top** | **Fully Implemented** | Native Win32 `SetWindowPos` with `HWND_TOPMOST` and focus preservation. |
| **Desktop Only** | **Experimental** | Marked experimental and unsupported for Phase 1. Correctly falls back to non-topmost window stacking. Worker Windows / Progman parenting will be evaluated in Phase 2. |
| **Smart Visibility** | **Experimental** | Marked experimental for Phase 1. Falls back to default topmost configuration until foreground window detection is specified. |

---

## 5. System Tray & Windows Autostart

- **Tray Integration (`src-tauri/src/startup.rs`):**
  - Left click on tray icon restores/focuses the DESKIT Manager window.
  - Right click displays native context menu with options: *Open DESKIT*, *Hide All*, *Quit*.
  - When *Close to Tray* is enabled, clicking the Manager's `X` button hides the window rather than terminating the application process.

- **Autostart Integration (`tauri-plugin-autostart`):**
  - Configures the Windows Run registry key (`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`).
  - Enabled conditionally based on user preference (`launch_at_login`).
  - On login, DESKIT launches and automatically reads previous pinned states from SQLite, restoring floating widgets exactly where the user placed them.
