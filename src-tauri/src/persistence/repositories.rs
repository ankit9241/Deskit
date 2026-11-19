use rusqlite::{params, Connection, OptionalExtension, Result};
use std::sync::Mutex;

use crate::models::{
    AppSettings, DailyGoal, Deadline, FocusSession, Note, Task, VisibilityMode, WidgetInstance,
    WidgetType,
};

pub struct Repositories;

impl Repositories {
    // ---------------- WIDGET INSTANCES ----------------

    pub fn get_all_widgets(conn: &Mutex<Connection>) -> Result<Vec<WidgetInstance>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, widget_type, title, x, y, width, height, is_pinned, visibility_mode, is_collapsed, config_json, created_at, updated_at 
             FROM widget_instances ORDER BY created_at ASC",
        )?;

        let widgets = stmt
            .query_map([], |row| {
                let type_str: String = row.get(1)?;
                let mode_str: String = row.get(8)?;
                let widget_type = WidgetType::from_str(&type_str).unwrap_or(WidgetType::Clock);
                let visibility_mode = VisibilityMode::from_str(&mode_str);

                Ok(WidgetInstance {
                    id: row.get(0)?,
                    widget_type,
                    title: row.get(2)?,
                    x: row.get(3)?,
                    y: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    is_pinned: row.get::<_, i32>(7)? != 0,
                    visibility_mode,
                    is_collapsed: row.get::<_, i32>(9)? != 0,
                    config_json: row.get(10)?,
                    created_at: row.get(11)?,
                    updated_at: row.get(12)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(widgets)
    }

    pub fn get_widget_by_id(conn: &Mutex<Connection>, id: &str) -> Result<Option<WidgetInstance>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, widget_type, title, x, y, width, height, is_pinned, visibility_mode, is_collapsed, config_json, created_at, updated_at 
             FROM widget_instances WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            let type_str: String = row.get(1)?;
            let mode_str: String = row.get(8)?;
            let widget_type = WidgetType::from_str(&type_str).unwrap_or(WidgetType::Clock);
            let visibility_mode = VisibilityMode::from_str(&mode_str);

            Ok(WidgetInstance {
                id: row.get(0)?,
                widget_type,
                title: row.get(2)?,
                x: row.get(3)?,
                y: row.get(4)?,
                width: row.get(5)?,
                height: row.get(6)?,
                is_pinned: row.get::<_, i32>(7)? != 0,
                visibility_mode,
                is_collapsed: row.get::<_, i32>(9)? != 0,
                config_json: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub fn save_widget(conn: &Mutex<Connection>, widget: &WidgetInstance) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO widget_instances (
                id, widget_type, title, x, y, width, height, is_pinned, visibility_mode, is_collapsed, config_json, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                x = excluded.x,
                y = excluded.y,
                width = excluded.width,
                height = excluded.height,
                is_pinned = excluded.is_pinned,
                visibility_mode = excluded.visibility_mode,
                is_collapsed = excluded.is_collapsed,
                config_json = excluded.config_json,
                updated_at = excluded.updated_at",
            params![
                widget.id,
                widget.widget_type.as_str(),
                widget.title,
                widget.x,
                widget.y,
                widget.width,
                widget.height,
                if widget.is_pinned { 1 } else { 0 },
                widget.visibility_mode.as_str(),
                if widget.is_collapsed { 1 } else { 0 },
                widget.config_json,
                widget.created_at,
                widget.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_widget_geometry(
        conn: &Mutex<Connection>,
        id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE widget_instances SET x = ?1, y = ?2, width = ?3, height = ?4, updated_at = ?5 WHERE id = ?6",
            params![x, y, width, height, now, id],
        )?;
        Ok(())
    }

    pub fn update_widget_pinned(conn: &Mutex<Connection>, id: &str, is_pinned: bool) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE widget_instances SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![if is_pinned { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn update_widget_collapsed(conn: &Mutex<Connection>, id: &str, is_collapsed: bool) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE widget_instances SET is_collapsed = ?1, updated_at = ?2 WHERE id = ?3",
            params![if is_collapsed { 1 } else { 0 }, now, id],
        )?;
        Ok(())
    }

    pub fn update_widget_visibility_mode(conn: &Mutex<Connection>, id: &str, mode: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE widget_instances SET visibility_mode = ?1, updated_at = ?2 WHERE id = ?3",
            params![mode, now, id],
        )?;
        Ok(())
    }

    pub fn delete_widget(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM widget_instances WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- TASKS ----------------

    pub fn get_all_tasks(conn: &Mutex<Connection>) -> Result<Vec<Task>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, description, is_completed, priority, due_date, created_at, updated_at 
             FROM tasks ORDER BY is_completed ASC, created_at DESC",
        )?;

        let tasks = stmt
            .query_map([], |row| {
                Ok(Task {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    is_completed: row.get::<_, i32>(3)? != 0,
                    priority: row.get(4)?,
                    due_date: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(tasks)
    }

    pub fn save_task(conn: &Mutex<Connection>, task: &Task) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO tasks (id, title, description, is_completed, priority, due_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                is_completed = excluded.is_completed,
                priority = excluded.priority,
                due_date = excluded.due_date,
                updated_at = excluded.updated_at",
            params![
                task.id,
                task.title,
                task.description,
                if task.is_completed { 1 } else { 0 },
                task.priority,
                task.due_date,
                task.created_at,
                task.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_task(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- NOTES ----------------

    pub fn get_all_notes(conn: &Mutex<Connection>) -> Result<Vec<Note>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC",
        )?;

        let notes = stmt
            .query_map([], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(notes)
    }

    pub fn save_note(conn: &Mutex<Connection>, note: &Note) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO notes (id, title, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                updated_at = excluded.updated_at",
            params![note.id, note.title, note.content, note.created_at, note.updated_at],
        )?;
        Ok(())
    }

    pub fn delete_note(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- FOCUS SESSIONS ----------------

    pub fn get_focus_session(conn: &Mutex<Connection>) -> Result<FocusSession> {
        let lock = conn.lock().unwrap();
        let existing = lock
            .query_row(
                "SELECT id, duration_minutes, break_minutes, state, remaining_seconds, is_running, updated_at 
                 FROM focus_sessions LIMIT 1",
                [],
                |row| {
                    Ok(FocusSession {
                        id: row.get(0)?,
                        duration_minutes: row.get(1)?,
                        break_minutes: row.get(2)?,
                        state: row.get(3)?,
                        remaining_seconds: row.get(4)?,
                        is_running: row.get::<_, i32>(5)? != 0,
                        updated_at: row.get(6)?,
                    })
                },
            )
            .optional()?;

        if let Some(session) = existing {
            return Ok(session);
        }

        // Default session
        let default_session = FocusSession {
            id: "default".to_string(),
            duration_minutes: 25,
            break_minutes: 5,
            state: "idle".to_string(),
            remaining_seconds: 25 * 60,
            is_running: false,
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        lock.execute(
            "INSERT OR REPLACE INTO focus_sessions (id, duration_minutes, break_minutes, state, remaining_seconds, is_running, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                default_session.id,
                default_session.duration_minutes,
                default_session.break_minutes,
                default_session.state,
                default_session.remaining_seconds,
                if default_session.is_running { 1 } else { 0 },
                default_session.updated_at,
            ],
        )?;
        Ok(default_session)
    }

    pub fn save_focus_session(conn: &Mutex<Connection>, session: &FocusSession) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO focus_sessions (id, duration_minutes, break_minutes, state, remaining_seconds, is_running, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                duration_minutes = excluded.duration_minutes,
                break_minutes = excluded.break_minutes,
                state = excluded.state,
                remaining_seconds = excluded.remaining_seconds,
                is_running = excluded.is_running,
                updated_at = excluded.updated_at",
            params![
                session.id,
                session.duration_minutes,
                session.break_minutes,
                session.state,
                session.remaining_seconds,
                if session.is_running { 1 } else { 0 },
                session.updated_at,
            ],
        )?;
        Ok(())
    }

    // ---------------- DEADLINES ----------------

    pub fn get_all_deadlines(conn: &Mutex<Connection>) -> Result<Vec<Deadline>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, due_date, category, is_completed, created_at, updated_at 
             FROM deadlines ORDER BY is_completed ASC, due_date ASC",
        )?;

        let deadlines = stmt
            .query_map([], |row| {
                Ok(Deadline {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    due_date: row.get(2)?,
                    category: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(deadlines)
    }

    pub fn save_deadline(conn: &Mutex<Connection>, deadline: &Deadline) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO deadlines (id, title, due_date, category, is_completed, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                due_date = excluded.due_date,
                category = excluded.category,
                is_completed = excluded.is_completed,
                updated_at = excluded.updated_at",
            params![
                deadline.id,
                deadline.title,
                deadline.due_date,
                deadline.category,
                if deadline.is_completed { 1 } else { 0 },
                deadline.created_at,
                deadline.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_deadline(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM deadlines WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- DAILY GOALS ----------------

    pub fn get_all_goals(conn: &Mutex<Connection>) -> Result<Vec<DailyGoal>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, target_count, current_count, is_completed, date_str, created_at, updated_at 
             FROM daily_goals ORDER BY is_completed ASC, created_at ASC",
        )?;

        let goals = stmt
            .query_map([], |row| {
                Ok(DailyGoal {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    target_count: row.get(2)?,
                    current_count: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    date_str: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(goals)
    }

    pub fn save_goal(conn: &Mutex<Connection>, goal: &DailyGoal) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO daily_goals (id, title, target_count, current_count, is_completed, date_str, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                target_count = excluded.target_count,
                current_count = excluded.current_count,
                is_completed = excluded.is_completed,
                date_str = excluded.date_str,
                updated_at = excluded.updated_at",
            params![
                goal.id,
                goal.title,
                goal.target_count,
                goal.current_count,
                if goal.is_completed { 1 } else { 0 },
                goal.date_str,
                goal.created_at,
                goal.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn delete_goal(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM daily_goals WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- APP SETTINGS ----------------

    pub fn get_app_settings(conn: &Mutex<Connection>) -> Result<AppSettings> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare("SELECT key, value FROM app_settings")?;

        let mut settings = AppSettings::default();
        let rows = stmt.query_map([], |row| {
            let key: String = row.get(0)?;
            let value: String = row.get(1)?;
            Ok((key, value))
        })?;

        for r in rows.flatten() {
            match r.0.as_str() {
                "launch_at_login" => settings.launch_at_login = r.1 == "true",
                "close_to_tray" => settings.close_to_tray = r.1 == "true",
                "time_format_24h" => settings.time_format_24h = r.1 == "true",
                "default_visibility_mode" => settings.default_visibility_mode = r.1,
                "theme" => settings.theme = r.1,
                _ => {}
            }
        }

        Ok(settings)
    }

    pub fn save_app_settings(conn: &Mutex<Connection>, settings: &AppSettings) -> Result<()> {
        let lock = conn.lock().unwrap();
        let pairs = [
            ("launch_at_login", if settings.launch_at_login { "true" } else { "false" }),
            ("close_to_tray", if settings.close_to_tray { "true" } else { "false" }),
            ("time_format_24h", if settings.time_format_24h { "true" } else { "false" }),
            ("default_visibility_mode", settings.default_visibility_mode.as_str()),
            ("theme", settings.theme.as_str()),
        ];

        for (k, v) in pairs {
            lock.execute(
                "INSERT INTO app_settings (key, value) VALUES (?1, ?2)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                params![k, v],
            )?;
        }

        Ok(())
    }
}
