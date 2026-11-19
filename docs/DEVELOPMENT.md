# PINNED — Development & Build Guide

> **Project Name:** PINNED  
> **Repository:** `pinned`  
> **Platform:** Windows 10 & 11 (64-bit)

---

## 1. Prerequisites

- **Node.js:** v18.0.0 or later (v20+ recommended)
- **Rust Toolchain:** `stable-x86_64-pc-windows-msvc` (Rust 1.80+ / 1.93+)
- **Visual Studio C++ Build Tools:** 2019 or 2022 with MSVC v142/v143 compiler tools
- **PowerShell:** 5.1 or later

---

## 2. Directory Structure

```
pinned/
│
├── src/
│   ├── app/                    # Entry components & client router
│   ├── components/             # Manager cockpit & widget containers
│   ├── features/               # The 6 core widgets (Clock, Tasks, Focus, Notes, Deadlines, Goals)
│   ├── stores/                 # Zustand reactive state stores
│   ├── services/               # Tauri IPC command invocations & event bus
│   ├── types/                  # TypeScript interface definitions
│   └── styles/                 # Tailwind CSS stylesheets
│
├── src-tauri/
│   ├── src/
│   │   ├── main.rs             # Tauri entrypoint
│   │   ├── lib.rs              # Tauri builder & setup lifecycle
│   │   ├── commands/           # IPC commands for widgets, windows, database, settings
│   │   ├── windows/            # WindowManager, WindowFactory, Native Win32 SetWindowPos
│   │   ├── persistence/        # SQLite migrations & entity repositories
│   │   ├── startup.rs          # System Tray & auto-launch orchestration
│   │   └── models/             # Rust domain structs & enums
│   ├── capabilities/           # Tauri 2 security permissions
│   ├── icons/                  # Application icons
│   └── Cargo.toml              # Rust manifest & dependencies
│
├── docs/                       # Architectural & native integration documentation
├── scripts/                    # Automation scripts for checking, testing, and building
├── package.json
└── README.md
```

---

## 3. Building the Application

### A. Frontend Compilation
```powershell
npm run build
```
Executes `tsc && vite build`, creating optimized production assets in `dist/`.

### B. Rust Backend Check
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cargo_check.ps1
```
Runs `cargo check` validating all Rust crates, models, Win32 APIs, and commands.

### C. Run Native Test Suite
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cargo_test.ps1
```
Executes the comprehensive in-memory SQLite integration tests covering:
- Widget CRUD & geometry persistence
- Tasks CRUD & priority handling
- Notes CRUD & content updates
- Focus session transitions & timer state
- Deadlines calculations & category assignment
- Daily goals counter updates
- Application settings & launch configurations

### D. Compile Debug Executable
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cargo_build.ps1
```
Outputs the standalone Windows executable to:
`src-tauri\target\x86_64-pc-windows-msvc\debug\pinned.exe`

---

## 4. Launching & Testing

To launch the native Windows binary:
```powershell
.\src-tauri\target\x86_64-pc-windows-msvc\debug\pinned.exe
```

- Click **Pin** on any widget (Clock, Tasks, Focus, Notes, Deadlines, Goals) in the Manager window.
- The widget will spawn as a separate native floating window on your desktop.
- Switch to other applications (VS Code, Chrome); the pinned widget will stay elevated above normal windows.
- Drag the widget by its top titlebar to reposition.
- Resize by dragging the window border.
- Changes made in the widget window immediately reflect in the Manager window via cross-window Tauri events.
