use rusqlite::{Connection, Result};

pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        )",
        [],
    )?;

    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < 1 {
        let tx = conn.transaction()?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS widget_instances (
                id TEXT PRIMARY KEY,
                widget_type TEXT NOT NULL,
                title TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                is_pinned INTEGER NOT NULL DEFAULT 1,
                visibility_mode TEXT NOT NULL DEFAULT 'always_on_top',
                is_collapsed INTEGER NOT NULL DEFAULT 0,
                config_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                is_completed INTEGER NOT NULL DEFAULT 0,
                priority TEXT NOT NULL DEFAULT 'medium',
                due_date TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                is_pinned INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS focus_sessions (
                id TEXT PRIMARY KEY,
                duration_minutes INTEGER NOT NULL DEFAULT 25,
                break_minutes INTEGER NOT NULL DEFAULT 5,
                state TEXT NOT NULL DEFAULT 'idle',
                remaining_seconds INTEGER NOT NULL DEFAULT 1500,
                is_running INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL,
                ends_at TEXT
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS deadlines (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                due_date TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'General',
                is_completed INTEGER NOT NULL DEFAULT 0,
                notify_lead_minutes INTEGER NOT NULL DEFAULT 15,
                notified_lead INTEGER NOT NULL DEFAULT 0,
                notified_due INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS daily_goals (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                target_count INTEGER NOT NULL DEFAULT 1,
                current_count INTEGER NOT NULL DEFAULT 0,
                is_completed INTEGER NOT NULL DEFAULT 0,
                date_str TEXT NOT NULL,
                current_streak INTEGER NOT NULL DEFAULT 0,
                longest_streak INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS app_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (1, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    if current_version < 2 {
        let tx = conn.transaction()?;

        let mut stmt = tx.prepare("PRAGMA table_info(focus_sessions)")?;
        let has_ends_at: bool = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .any(|name| name == "ends_at");
        drop(stmt);

        if !has_ends_at {
            tx.execute("ALTER TABLE focus_sessions ADD COLUMN ends_at TEXT", [])?;
        }

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (2, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    if current_version < 3 {
        let tx = conn.transaction()?;

        tx.execute(
            "CREATE TABLE IF NOT EXISTS goal_history (
                id TEXT PRIMARY KEY,
                goal_id TEXT NOT NULL,
                date_str TEXT NOT NULL,
                target_count INTEGER NOT NULL,
                current_count INTEGER NOT NULL,
                is_completed INTEGER NOT NULL DEFAULT 0,
                recorded_at TEXT NOT NULL,
                UNIQUE(goal_id, date_str)
            )",
            [],
        )?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_goal_history_goal_date ON goal_history(goal_id, date_str)",
            [],
        )?;

        let mut stmt = tx.prepare("PRAGMA table_info(daily_goals)")?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        if !columns.iter().any(|c| c == "current_streak") {
            tx.execute("ALTER TABLE daily_goals ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0", [])?;
        }
        if !columns.iter().any(|c| c == "longest_streak") {
            tx.execute("ALTER TABLE daily_goals ADD COLUMN longest_streak INTEGER NOT NULL DEFAULT 0", [])?;
        }

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (3, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    if current_version < 4 {
        let tx = conn.transaction()?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_tasks_sorting ON tasks(is_completed, due_date, priority, created_at)",
            [],
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (4, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    if current_version < 5 {
        let tx = conn.transaction()?;

        let mut stmt = tx.prepare("PRAGMA table_info(notes)")?;
        let has_is_pinned: bool = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .any(|name| name == "is_pinned");
        drop(stmt);

        if !has_is_pinned {
            tx.execute("ALTER TABLE notes ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0", [])?;
        }

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_notes_pinned_updated ON notes(is_pinned, updated_at)",
            [],
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (5, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    if current_version < 6 {
        let tx = conn.transaction()?;

        let mut stmt = tx.prepare("PRAGMA table_info(deadlines)")?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        if !columns.iter().any(|c| c == "notify_lead_minutes") {
            tx.execute(
                "ALTER TABLE deadlines ADD COLUMN notify_lead_minutes INTEGER NOT NULL DEFAULT 15",
                [],
            )?;
        }
        if !columns.iter().any(|c| c == "notified_lead") {
            tx.execute(
                "ALTER TABLE deadlines ADD COLUMN notified_lead INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }
        if !columns.iter().any(|c| c == "notified_due") {
            tx.execute(
                "ALTER TABLE deadlines ADD COLUMN notified_due INTEGER NOT NULL DEFAULT 0",
                [],
            )?;
        }

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_deadlines_notification ON deadlines(is_completed, due_date, notified_lead, notified_due)",
            [],
        )?;

        let now = chrono::Utc::now().to_rfc3339();
        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (6, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    if current_version < 7 {
        let tx = conn.transaction()?;

        // 1. Workspaces table
        tx.execute(
            "CREATE TABLE IF NOT EXISTS workspaces (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // 2. Workspace widgets table
        tx.execute(
            "CREATE TABLE IF NOT EXISTS workspace_widgets (
                id TEXT PRIMARY KEY,
                workspace_id TEXT NOT NULL,
                widget_id TEXT NOT NULL,
                widget_type TEXT NOT NULL,
                title TEXT NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                is_pinned INTEGER NOT NULL DEFAULT 1,
                visibility_mode TEXT NOT NULL DEFAULT 'always_on_top',
                is_collapsed INTEGER NOT NULL DEFAULT 0,
                lock_position INTEGER NOT NULL DEFAULT 0,
                config_json TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(workspace_id, widget_id)
            )",
            [],
        )?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_workspace_widgets_ws ON workspace_widgets(workspace_id)",
            [],
        )?;

        // 3. Add columns to widget_instances if missing
        let mut stmt = tx.prepare("PRAGMA table_info(widget_instances)")?;
        let columns: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        if !columns.iter().any(|c| c == "workspace_id") {
            tx.execute("ALTER TABLE widget_instances ADD COLUMN workspace_id TEXT", [])?;
        }
        if !columns.iter().any(|c| c == "lock_position") {
            tx.execute("ALTER TABLE widget_instances ADD COLUMN lock_position INTEGER NOT NULL DEFAULT 0", [])?;
        }

        let now = chrono::Utc::now().to_rfc3339();

        // 4. Seed default presets if workspaces table is empty
        let count: i64 = tx.query_row("SELECT COUNT(*) FROM workspaces", [], |r| r.get(0))?;
        if count == 0 {
            tx.execute(
                "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
                 VALUES ('default', 'Default Workspace', 'Primary workspace layout', 1, ?1, ?1)",
                [&now],
            )?;

            tx.execute(
                "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
                 VALUES ('study', 'Study & Deep Work', 'Focus timer, tasks, clock, and daily habit goals for uninterrupted study sessions.', 0, ?1, ?1)",
                [&now],
            )?;
            tx.execute(
                "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
                 VALUES ('developer', 'Developer Workspace', 'Milestone deadlines, scratchpad for snippets, task tracker, and clock.', 0, ?1, ?1)",
                [&now],
            )?;
            tx.execute(
                "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
                 VALUES ('minimal', 'Zen Minimalist', 'Zero clutter. Only the clock and a circular focus timer on your desktop.', 0, ?1, ?1)",
                [&now],
            )?;

            // Migrate any existing widget_instances into the 'default' workspace
            let mut w_stmt = tx.prepare(
                "SELECT id, widget_type, title, x, y, width, height, is_pinned, visibility_mode, is_collapsed, config_json, created_at, updated_at
                 FROM widget_instances"
            )?;
            let existing_widgets: Vec<(String, String, String, f64, f64, f64, f64, i32, String, i32, String, String, String)> = w_stmt
                .query_map([], |row| {
                    Ok((
                        row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?,
                        row.get(5)?, row.get(6)?, row.get(7)?, row.get(8)?, row.get(9)?,
                        row.get(10)?, row.get(11)?, row.get(12)?,
                    ))
                })?
                .filter_map(|r| r.ok())
                .collect();
            drop(w_stmt);

            for w in existing_widgets {
                let rel_id = format!("default-{}", w.0);
                tx.execute(
                    "INSERT OR IGNORE INTO workspace_widgets (
                        id, workspace_id, widget_id, widget_type, title, x, y, width, height,
                        is_pinned, visibility_mode, is_collapsed, lock_position, config_json, created_at, updated_at
                    ) VALUES (?1, 'default', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0, ?12, ?13, ?14)",
                    rusqlite::params![rel_id, w.0, w.1, w.2, w.3, w.4, w.5, w.6, w.7, w.8, w.9, w.10, w.11, w.12],
                )?;
                tx.execute("UPDATE widget_instances SET workspace_id = 'default' WHERE id = ?1", [&w.0])?;
            }

            // Seed widgets for 'study', 'developer', and 'minimal' presets
            let presets_widgets = vec![
                ("study", vec![
                    ("clock", "Clock", 1000.0, 50.0, 260.0, 140.0),
                    ("tasks", "Tasks", 1000.0, 220.0, 320.0, 420.0),
                    ("focus", "Focus Timer", 650.0, 50.0, 280.0, 220.0),
                    ("goals", "Daily Goals", 650.0, 300.0, 320.0, 380.0),
                ]),
                ("developer", vec![
                    ("clock", "Clock", 1050.0, 50.0, 260.0, 140.0),
                    ("tasks", "Tasks", 1050.0, 220.0, 320.0, 420.0),
                    ("notes", "Quick Notes", 700.0, 50.0, 320.0, 360.0),
                    ("deadlines", "Deadlines", 700.0, 440.0, 320.0, 380.0),
                ]),
                ("minimal", vec![
                    ("clock", "Clock", 1100.0, 60.0, 260.0, 140.0),
                    ("focus", "Focus Timer", 1100.0, 230.0, 280.0, 220.0),
                ]),
            ];

            for (ws_id, w_list) in presets_widgets {
                for (w_type, title, x, y, width, height) in w_list {
                    let w_id = format!("{}-{}", ws_id, w_type);
                    let row_id = format!("{}-{}", ws_id, w_id);
                    tx.execute(
                        "INSERT OR IGNORE INTO workspace_widgets (
                            id, workspace_id, widget_id, widget_type, title, x, y, width, height,
                            is_pinned, visibility_mode, is_collapsed, lock_position, config_json, created_at, updated_at
                        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1, 'always_on_top', 0, 0, '{}', ?10, ?10)",
                        rusqlite::params![row_id, ws_id, w_id, w_type, title, x, y, width, height, now],
                    )?;
                }
            }
        }

        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (7, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    // Migration 8: Clock Preferences, World Clocks, and Alarms
    if current_version < 8 {
        log::info!("Applying migration 8: Clock Preferences, World Clocks, and Alarms");
        let now = chrono::Utc::now().to_rfc3339();
        let tx = conn.transaction()?;

        // Default show_seconds preference
        tx.execute(
            "INSERT OR IGNORE INTO app_settings (key, value) VALUES ('show_seconds', 'true')",
            [],
        )?;

        // Create world_clocks table
        tx.execute(
            "CREATE TABLE IF NOT EXISTS world_clocks (
                id TEXT PRIMARY KEY,
                city_name TEXT NOT NULL,
                timezone TEXT NOT NULL,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        // Seed popular default world clocks
        let default_cities = vec![
            ("wc-nyc", "New York", "America/New_York", 1),
            ("wc-lon", "London", "Europe/London", 2),
            ("wc-tyo", "Tokyo", "Asia/Tokyo", 3),
        ];

        for (id, city, tz, order) in default_cities {
            tx.execute(
                "INSERT OR IGNORE INTO world_clocks (id, city_name, timezone, sort_order, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                rusqlite::params![id, city, tz, order, now],
            )?;
        }

        // Create alarms table
        tx.execute(
            "CREATE TABLE IF NOT EXISTS alarms (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                time_str TEXT NOT NULL,
                days_of_week TEXT NOT NULL DEFAULT '[]',
                is_enabled INTEGER NOT NULL DEFAULT 1,
                is_recurring INTEGER NOT NULL DEFAULT 0,
                one_time_date TEXT,
                last_triggered_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )",
            [],
        )?;

        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (8, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    // Migration 9: Reliability Indexes for Performance and Concurrency
    if current_version < 9 {
        log::info!("Applying migration 9: Reliability Indexes");
        let now = chrono::Utc::now().to_rfc3339();
        let tx = conn.transaction()?;

        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_workspace_widgets_widget ON workspace_widgets(widget_id)",
            [],
        )?;
        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_world_clocks_order ON world_clocks(sort_order, city_name)",
            [],
        )?;
        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_alarms_schedule ON alarms(is_enabled, time_str)",
            [],
        )?;
        tx.execute(
            "CREATE INDEX IF NOT EXISTS idx_deadlines_schedule ON deadlines(is_completed, due_date)",
            [],
        )?;

        tx.execute(
            "INSERT INTO schema_migrations (version, applied_at) VALUES (9, ?1)",
            [&now],
        )?;

        tx.commit()?;
    }

    Ok(())
}
