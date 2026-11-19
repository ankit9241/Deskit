# DESKIT — Phase 1 Architecture Specification

> **Product Name:** DESKIT  
> **Tagline:** Your workspace. Always within reach.  
> **Target Platform:** Windows 10 & Windows 11 (64-bit)

---

## 1. High-Level System Overview

DESKIT is a native Windows desktop productivity application engineered with **Tauri 2**, **Rust stable**, **React 19**, **TypeScript**, and **SQLite**.

Unlike browser dashboards or single-window web simulators that render widgets as in-page DOM elements, DESKIT implements a **true multi-window native desktop architecture**:

1. **Main Manager Window (`main`):**
   - The central configuration and widget library cockpit.
   - Used to browse the widget gallery, configure global settings, pin/unpin widgets, and monitor all active floating widgets.
   - Closing the manager hides it to the Windows System Tray rather than killing background processes.

2. **Independent Floating Widget Windows (`widget-<type>-<id>`):**
   - Each pinned widget is an actual independent native Windows OS window (`WebviewWindow`).
   - Frameless, transparent, draggable via dedicated titlebar grab handles (`data-tauri-drag-region`), and natively resizable.
   - Natively elevated above normal desktop applications (Chrome, VS Code, File Explorer) via Win32 `SetWindowPos` (`HWND_TOPMOST`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                        DESKIT Manager Window                           │
│  - Widget Catalog (Clock, Tasks, Focus, Notes, Deadlines, Goals)      │
│  - Pinned Status & Geometry Management                                 │
│  - Application Preferences & Win32 Startup Settings                    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC Commands & Events
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       Rust Backend (Core App)                          │
│  - Central WindowManager & WindowFactory                               │
│  - Win32 SetWindowPos Native Integration (HWND_TOPMOST, SWP_NOACTIVATE)│
│  - SQLite Engine & Schema Migrations (rusqlite / winsqlite3)           │
│  - Cross-Window IPC Event Router (Tauri Emitter / Listeners)           │
│  - System Tray Management & Auto-Launch at Windows Login               │
└───────────────┬───────────────────┬───────────────────┬────────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
     ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
     │  Clock Widget    │  │  Tasks Widget    │  │  Notes Widget    │
     │  (Native Window) │  │  (Native Window) │  │  (Native Window) │
     └──────────────────┘  └──────────────────┘  └──────────────────┘
```

---

## 2. Multi-Window Lifecycle & WindowManager

The core orchestration resides in `src-tauri/src/windows/`:

- **`manager.rs` (`WindowManager`):**
  - Manages creation, retrieval, positioning, pinning, unpinning, and destruction of widget windows.
  - Generates predictable, unique window labels: `widget-<type>` (for singletons) or `widget-<type>-<uuid>` (for multi-instance widgets like scratchpad notes).
  - Maintains state synchronization in SQLite whenever a window is created or destroyed.
  - Automatically restores previously pinned widgets on application startup.

- **`factory.rs` (`WindowFactory`):**
  - Configures frameless, transparent, resizable windows using `WebviewWindowBuilder`.
  - Injects query parameters for routing: `index.html?widget_id=<id>&type=<type>`.
  - Attaches native window event handlers (`WindowEvent::Moved`, `WindowEvent::Resized`) to automatically persist geometry into SQLite on user interaction.

- **`positioning.rs` (`WindowPositioning`):**
  - Calculates sensible default viewport positions for newly pinned widgets.
  - Ensures initial bounds stay within visible desktop coordinates without overflowing monitor boundaries.

- **`visibility.rs` (`VisibilityController`):**
  - Enforces visibility policies (`AlwaysOnTop`, `DesktopOnly`, `Smart`).
  - Correctly flags non-topmost fallback for experimental or unsupported modes.

---

## 3. Real Windows Win32 Always-On-Top Layer

Located in `src-tauri/src/windows/native.rs`:

```rust
// Native Win32 SetWindowPos invocation
let flags = SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE;
let insert_after = if enable { HWND_TOPMOST } else { HWND_NOTOPMOST };

unsafe {
    SetWindowPos(hwnd, insert_after, 0, 0, 0, 0, flags)?;
}
```

### Architectural Guarantees:
1. **Focus Preservation:** `SWP_NOACTIVATE` guarantees that pinning or elevating a widget does not steal foreground keyboard/mouse focus from the user's active application.
2. **Dimension & Position Preservation:** `SWP_NOMOVE | SWP_NOSIZE` prevents the native window manager from altering window geometry during Z-order manipulation.
3. **No Per-Frame Polling:** Always-on-top state is applied only upon state transitions (pin, unpin, show, restore), preventing CPU churn and GPU compositing stutter.
4. **Error Propagation:** All Win32 error codes are captured and wrapped in `NativeWindowError::Win32Error`.

---

## 4. SQLite Persistence & Schema Migration

The persistent source of truth is SQLite, interfaced via `rusqlite` linked against Windows' native `winsqlite3.dll`:

- **Database Location:** `%APPDATA%\com.deskit.desktop\deskit.db`.
- **Migrations (`migrations.rs`):** Schema versioning via `user_version` PRAGMA with idempotent migration scripts.
- **Relational Tables:**
  - `widget_instances`: ID, widget type, title, coordinates (`x`, `y`), dimensions (`width`, `height`), `is_pinned`, `visibility_mode`, `is_collapsed`, `config_json`, timestamps.
  - `tasks`: ID, title, description, `is_completed`, priority (`low`, `medium`, `high`), due date, timestamps.
  - `notes`: ID, title, content, timestamps.
  - `focus_sessions`: Duration, break length, state (`idle`, `running`, `paused`, `break`), remaining seconds, timestamps.
  - `deadlines`: ID, title, due date, category, completion status, timestamps.
  - `daily_goals`: ID, title, target count, current count, completion status, date string, timestamps.
  - `app_settings`: Startup at login, close-to-tray preference, 24h clock toggle, default visibility mode, theme.

---

## 5. Cross-Window State Reactivity

All windows display consistent, real-time synchronized state without polling:

```
[User Action in Widget Window]
             │
             ▼
   Rust Command Executed
   (e.g., toggle_task)
             │
             ├──────────────────────────┐
             ▼                          ▼
   SQLite Updated           Tauri Cross-Window Event
   (Single Source of Truth) (e.g., "tasks-updated")
                                        │
             ┌──────────────────────────┴──────────────────────────┐
             ▼                                                     ▼
   Manager Window Store Updated                      Widget Window Store Updated
   (Zustand re-renders UI)                           (Zustand re-renders UI)
```

1. Frontend initiates validated Rust commands (`invoke("toggle_task", ...)`).
2. Rust executes transactional SQLite queries via safe parameterized statements.
3. Upon commit, Rust emits cross-window Tauri events (`app.emit("tasks-updated", &tasks)`).
4. All open webview windows (Manager + floating widgets) listen via `listen(...)` and immediately update their local Zustand stores.
