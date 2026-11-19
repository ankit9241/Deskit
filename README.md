# PINNED

> **Your workspace. Always within reach.**

PINNED is a distributable Windows desktop productivity application engineered for Windows 10 and Windows 11. It provides a central manager application and independent native floating desktop widgets that remain visible above standard windows.

---

## Key Features (Phase 1)

- **Native Multi-Window Architecture:** Each widget is a real, independent native Windows OS window (`WebviewWindow`), not a browser card or DOM overlay.
- **True Always-On-Top:** Driven directly by Win32 `SetWindowPos` (`HWND_TOPMOST`) with `SWP_NOACTIVATE` to prevent focus stealing.
- **6 Built-in Functional Widgets:**
  1. **Clock Widget:** Local time with seconds, date display, and 12h/24h toggle.
  2. **Tasks Widget:** Task creation, priority badges (low, medium, high), completion toggle, and deletion.
  3. **Focus Timer:** Pomodoro work/break timer with start, pause, resume, and reset.
  4. **Scratchpad Notes:** Quick notes with debounced auto-saving and multi-note support.
  5. **Upcoming Deadlines:** Project milestones with datetime picker and relative remaining time calculation.
  6. **Daily Goals:** Daily habit counters with target increments and progress bars.
- **SQLite Persistence:** Embedded SQLite database with automatic migrations preserving geometry, pinned state, and widget records.
- **Cross-Window Reactivity:** Immediate bidirectional synchronization between the Manager and floating widgets via Tauri events and Zustand stores.
- **Windows Tray & Startup:** System tray integration with close-to-tray support and optional Launch at Windows Login via `tauri-plugin-autostart`.

---

## Technical Stack

- **Desktop Framework:** Tauri 2
- **Systems Core:** Rust (stable MSVC x86_64)
- **Frontend Framework:** React 19, TypeScript
- **Bundler:** Vite
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **Database:** SQLite (`rusqlite` + Windows `winsqlite3.dll`)
- **Native APIs:** Win32 User32 (`windows-rs` v0.58)

---

## Getting Started

### 1. Build the Frontend
```powershell
npm run build
```

### 2. Run Tests
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cargo_test.ps1
```

### 3. Build the Native Executable
```powershell
powershell -ExecutionPolicy Bypass -File scripts\cargo_build.ps1
```

The compiled binary will be located at:
`src-tauri\target\x86_64-pc-windows-msvc\debug\pinned.exe`

---

## Documentation

- [Architecture Specification](docs/ARCHITECTURE.md)
- [Windows Native Integration](docs/WINDOWS-INTEGRATION.md)
- [Development Guide](docs/DEVELOPMENT.md)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
