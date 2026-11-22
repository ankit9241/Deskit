use chrono::Datelike;
use rusqlite::{params, Connection, OptionalExtension, Result};
use std::sync::Mutex;

use crate::models::{
    validate_iana_timezone, Alarm, AlarmTriggerKind, AppSettings, DailyGoal, Deadline,
    DeadlineNotificationKind, FocusSession, GoalHistoryEntry, Note, Task, VisibilityMode,
    WidgetInstance, WidgetType, Workspace, WorkspaceWidgetLayout, WorldClock,
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

    pub fn update_widget_position(
        conn: &Mutex<Connection>,
        id: &str,
        x: f64,
        y: f64,
    ) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE widget_instances SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4",
            params![x, y, now, id],
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
        let mut lock = conn.lock().unwrap();
        let tx = lock.transaction()?;
        tx.execute("DELETE FROM workspace_widgets WHERE widget_id = ?1", params![id])?;
        tx.execute("DELETE FROM widget_instances WHERE id = ?1", params![id])?;
        tx.commit()?;
        Ok(())
    }

    // ---------------- TASKS ----------------

    pub fn get_all_tasks(conn: &Mutex<Connection>) -> Result<Vec<Task>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, description, is_completed, priority, due_date, created_at, updated_at 
             FROM tasks 
             ORDER BY 
                 is_completed ASC,
                 CASE 
                     WHEN is_completed = 0 AND due_date IS NOT NULL AND due_date != '' THEN 0 
                     WHEN is_completed = 0 THEN 1
                     ELSE 2
                 END ASC,
                 CASE WHEN is_completed = 0 THEN due_date ELSE NULL END ASC,
                 CASE WHEN is_completed = 0 THEN
                     CASE priority
                         WHEN 'high' THEN 1
                         WHEN 'medium' THEN 2
                         WHEN 'low' THEN 3
                         ELSE 4
                     END
                 ELSE NULL END ASC,
                 CASE WHEN is_completed = 1 THEN updated_at END DESC,
                 created_at DESC",
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

    pub fn toggle_task(conn: &Mutex<Connection>, id: &str) -> Result<Task> {
        let lock = conn.lock().unwrap();
        let mut task = lock.query_row(
            "SELECT id, title, description, is_completed, priority, due_date, created_at, updated_at 
             FROM tasks WHERE id = ?1",
            params![id],
            |row| {
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
            },
        )?;

        task.is_completed = !task.is_completed;
        task.updated_at = chrono::Utc::now().to_rfc3339();

        lock.execute(
            "UPDATE tasks SET is_completed = ?1, updated_at = ?2 WHERE id = ?3",
            params![if task.is_completed { 1 } else { 0 }, task.updated_at, task.id],
        )?;

        Ok(task)
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
            "SELECT id, title, content, is_pinned, created_at, updated_at 
             FROM notes 
             ORDER BY is_pinned DESC, updated_at DESC",
        )?;

        let notes = stmt
            .query_map([], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    is_pinned: row.get::<_, i32>(3)? != 0,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(notes)
    }

    pub fn save_note(conn: &Mutex<Connection>, note: &Note) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO notes (id, title, content, is_pinned, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                is_pinned = excluded.is_pinned,
                updated_at = excluded.updated_at",
            params![
                note.id,
                note.title,
                note.content,
                if note.is_pinned { 1 } else { 0 },
                note.created_at,
                note.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn toggle_pin_note(conn: &Mutex<Connection>, id: &str) -> Result<Note> {
        let lock = conn.lock().unwrap();
        let mut note = lock.query_row(
            "SELECT id, title, content, is_pinned, created_at, updated_at 
             FROM notes WHERE id = ?1",
            params![id],
            |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    is_pinned: row.get::<_, i32>(3)? != 0,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            },
        )?;

        note.is_pinned = !note.is_pinned;
        note.updated_at = chrono::Utc::now().to_rfc3339();

        lock.execute(
            "UPDATE notes SET is_pinned = ?1, updated_at = ?2 WHERE id = ?3",
            params![if note.is_pinned { 1 } else { 0 }, note.updated_at, note.id],
        )?;

        Ok(note)
    }

    pub fn search_notes(conn: &Mutex<Connection>, query: &str) -> Result<Vec<Note>> {
        let lock = conn.lock().unwrap();
        let pattern = format!("%{}%", query);
        let mut stmt = lock.prepare(
            "SELECT id, title, content, is_pinned, created_at, updated_at 
             FROM notes 
             WHERE title LIKE ?1 OR content LIKE ?1 
             ORDER BY is_pinned DESC, updated_at DESC",
        )?;

        let notes = stmt
            .query_map(params![pattern], |row| {
                Ok(Note {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    is_pinned: row.get::<_, i32>(3)? != 0,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(notes)
    }

    pub fn delete_note(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- FOCUS SESSIONS ----------------

    pub fn reconcile_focus_session(
        conn: &Mutex<Connection>,
        now: chrono::DateTime<chrono::Utc>,
    ) -> Result<(FocusSession, crate::models::focus::FocusTransition)> {
        let lock = conn.lock().unwrap();
        let existing = lock
            .query_row(
                "SELECT id, duration_minutes, break_minutes, state, remaining_seconds, is_running, updated_at, ends_at 
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
                        ends_at: row.get(7)?,
                    })
                },
            )
            .optional()?;

        let mut session = if let Some(s) = existing {
            s
        } else {
            let default_session = FocusSession::new_default();
            lock.execute(
                "INSERT OR REPLACE INTO focus_sessions (id, duration_minutes, break_minutes, state, remaining_seconds, is_running, updated_at, ends_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    default_session.id,
                    default_session.duration_minutes,
                    default_session.break_minutes,
                    default_session.state,
                    default_session.remaining_seconds,
                    if default_session.is_running { 1 } else { 0 },
                    default_session.updated_at,
                    default_session.ends_at,
                ],
            )?;
            default_session
        };

        let transition = session.reconcile(now);

        lock.execute(
            "UPDATE focus_sessions SET duration_minutes = ?1, break_minutes = ?2, state = ?3, remaining_seconds = ?4, is_running = ?5, updated_at = ?6, ends_at = ?7 WHERE id = ?8",
            params![
                session.duration_minutes,
                session.break_minutes,
                session.state,
                session.remaining_seconds,
                if session.is_running { 1 } else { 0 },
                session.updated_at,
                session.ends_at,
                session.id,
            ],
        )?;

        Ok((session, transition))
    }

    pub fn get_focus_session(conn: &Mutex<Connection>) -> Result<FocusSession> {
        let (session, _) = Self::reconcile_focus_session(conn, chrono::Utc::now())?;
        Ok(session)
    }

    pub fn save_focus_session(conn: &Mutex<Connection>, session: &FocusSession) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "INSERT INTO focus_sessions (id, duration_minutes, break_minutes, state, remaining_seconds, is_running, updated_at, ends_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
                duration_minutes = excluded.duration_minutes,
                break_minutes = excluded.break_minutes,
                state = excluded.state,
                remaining_seconds = excluded.remaining_seconds,
                is_running = excluded.is_running,
                updated_at = excluded.updated_at,
                ends_at = excluded.ends_at",
            params![
                session.id,
                session.duration_minutes,
                session.break_minutes,
                session.state,
                session.remaining_seconds,
                if session.is_running { 1 } else { 0 },
                session.updated_at,
                session.ends_at,
            ],
        )?;
        Ok(())
    }

    // ---------------- DEADLINES ----------------

    pub fn parse_due_date_to_utc(due_date_str: &str) -> Option<chrono::DateTime<chrono::Utc>> {
        use chrono::TimeZone;
        // 1. Try RFC3339 / ISO 8601 with explicit timezone (e.g. "2026-11-21T18:00:00Z" or "2026-11-21T18:00:00+05:30")
        if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(due_date_str) {
            return Some(dt.with_timezone(&chrono::Utc));
        }
        // 2. Try naive datetime with seconds (e.g. "2026-11-21T18:00:00")
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(due_date_str, "%Y-%m-%dT%H:%M:%S") {
            if let Some(local_dt) = chrono::Local.from_local_datetime(&naive).single() {
                return Some(local_dt.with_timezone(&chrono::Utc));
            } else {
                return Some(chrono::DateTime::from_naive_utc_and_offset(naive, chrono::Utc));
            }
        }
        // 3. Try naive datetime without seconds (e.g. from <input type="datetime-local" />: "2026-11-21T18:00")
        if let Ok(naive) = chrono::NaiveDateTime::parse_from_str(due_date_str, "%Y-%m-%dT%H:%M") {
            if let Some(local_dt) = chrono::Local.from_local_datetime(&naive).single() {
                return Some(local_dt.with_timezone(&chrono::Utc));
            } else {
                return Some(chrono::DateTime::from_naive_utc_and_offset(naive, chrono::Utc));
            }
        }
        // 4. Try date-only (e.g. "2026-11-21") -> end of day 23:59:59
        if let Ok(naive_date) = chrono::NaiveDate::parse_from_str(due_date_str, "%Y-%m-%d") {
            if let Some(naive_dt) = naive_date.and_hms_opt(23, 59, 59) {
                if let Some(local_dt) = chrono::Local.from_local_datetime(&naive_dt).single() {
                    return Some(local_dt.with_timezone(&chrono::Utc));
                } else {
                    return Some(chrono::DateTime::from_naive_utc_and_offset(naive_dt, chrono::Utc));
                }
            }
        }
        None
    }

    pub fn get_all_deadlines(conn: &Mutex<Connection>) -> Result<Vec<Deadline>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, due_date, category, is_completed, notify_lead_minutes, notified_lead, notified_due, created_at, updated_at 
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
                    notify_lead_minutes: row.get(5)?,
                    notified_lead: row.get::<_, i32>(6)? != 0,
                    notified_due: row.get::<_, i32>(7)? != 0,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(deadlines)
    }

    pub fn get_deadline_by_id(conn: &Mutex<Connection>, id: &str) -> Result<Option<Deadline>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, due_date, category, is_completed, notify_lead_minutes, notified_lead, notified_due, created_at, updated_at 
             FROM deadlines WHERE id = ?1",
        )?;

        let mut rows = stmt.query_map(params![id], |row| {
            Ok(Deadline {
                id: row.get(0)?,
                title: row.get(1)?,
                due_date: row.get(2)?,
                category: row.get(3)?,
                is_completed: row.get::<_, i32>(4)? != 0,
                notify_lead_minutes: row.get(5)?,
                notified_lead: row.get::<_, i32>(6)? != 0,
                notified_due: row.get::<_, i32>(7)? != 0,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        if let Some(res) = rows.next() {
            Ok(Some(res?))
        } else {
            Ok(None)
        }
    }

    pub fn save_deadline(conn: &Mutex<Connection>, deadline: &Deadline) -> Result<()> {
        let lock = conn.lock().unwrap();

        // Check if existing deadline had a different due date or if completed changed
        let existing: Option<(String, bool, bool, bool)> = lock
            .query_row(
                "SELECT due_date, is_completed, notified_lead, notified_due FROM deadlines WHERE id = ?1",
                params![deadline.id],
                |row| Ok((row.get(0)?, row.get::<_, i32>(1)? != 0, row.get::<_, i32>(2)? != 0, row.get::<_, i32>(3)? != 0)),
            )
            .optional()?;

        let mut notified_lead = deadline.notified_lead;
        let mut notified_due = deadline.notified_due;

        if let Some((old_due, old_completed, old_notified_lead, old_notified_due)) = existing {
            if deadline.is_completed {
                // If marked completed, suppress any future notifications
                notified_lead = true;
                notified_due = true;
            } else if old_completed && !deadline.is_completed {
                // Uncompleted again: check if due date is in future
                if let Some(due_utc) = Self::parse_due_date_to_utc(&deadline.due_date) {
                    if due_utc > chrono::Utc::now() {
                        notified_lead = false;
                        notified_due = false;
                    }
                }
            } else if old_due != deadline.due_date {
                // Due date rescheduled: if in future, reset notifications so user is reminded again
                if let Some(due_utc) = Self::parse_due_date_to_utc(&deadline.due_date) {
                    if due_utc > chrono::Utc::now() {
                        notified_lead = false;
                        notified_due = false;
                    }
                }
            } else {
                // Retain existing notification flags if not overwritten by caller
                notified_lead = notified_lead || old_notified_lead;
                notified_due = notified_due || old_notified_due;
            }
        }

        lock.execute(
            "INSERT INTO deadlines (id, title, due_date, category, is_completed, notify_lead_minutes, notified_lead, notified_due, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                due_date = excluded.due_date,
                category = excluded.category,
                is_completed = excluded.is_completed,
                notify_lead_minutes = excluded.notify_lead_minutes,
                notified_lead = excluded.notified_lead,
                notified_due = excluded.notified_due,
                updated_at = excluded.updated_at",
            params![
                deadline.id,
                deadline.title,
                deadline.due_date,
                deadline.category,
                if deadline.is_completed { 1 } else { 0 },
                deadline.notify_lead_minutes,
                if notified_lead { 1 } else { 0 },
                if notified_due { 1 } else { 0 },
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

    pub fn reconcile_deadlines_notifications(
        conn: &Mutex<Connection>,
        now_utc: chrono::DateTime<chrono::Utc>,
    ) -> Result<Vec<(Deadline, DeadlineNotificationKind)>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, due_date, category, is_completed, notify_lead_minutes, notified_lead, notified_due, created_at, updated_at 
             FROM deadlines WHERE is_completed = 0",
        )?;

        let deadlines: Vec<Deadline> = stmt
            .query_map([], |row| {
                Ok(Deadline {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    due_date: row.get(2)?,
                    category: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    notify_lead_minutes: row.get(5)?,
                    notified_lead: row.get::<_, i32>(6)? != 0,
                    notified_due: row.get::<_, i32>(7)? != 0,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        let mut triggered: Vec<(Deadline, DeadlineNotificationKind)> = Vec::new();

        for mut d in deadlines {
            let due_utc = match Self::parse_due_date_to_utc(&d.due_date) {
                Some(utc) => utc,
                None => {
                    log::warn!("Invalid deadline due_date string for ID {}: {}", d.id, d.due_date);
                    continue;
                }
            };

            if now_utc >= due_utc {
                // Deadline is due or overdue
                if !d.notified_due {
                    let is_missed = (now_utc - due_utc).num_minutes() > 60;
                    let kind = if is_missed {
                        DeadlineNotificationKind::Missed
                    } else {
                        DeadlineNotificationKind::Due
                    };

                    d.notified_lead = true;
                    d.notified_due = true;
                    let now_str = now_utc.to_rfc3339();
                    d.updated_at = now_str.clone();

                    lock.execute(
                        "UPDATE deadlines SET notified_lead = 1, notified_due = 1, updated_at = ?1 WHERE id = ?2",
                        params![now_str, d.id],
                    )?;

                    triggered.push((d, kind));
                }
            } else {
                // Deadline is in future: check lead time
                if d.notify_lead_minutes > 0 && !d.notified_lead {
                    let lead_duration = chrono::Duration::minutes(d.notify_lead_minutes as i64);
                    let lead_time = due_utc - lead_duration;

                    if now_utc >= lead_time {
                        d.notified_lead = true;
                        let now_str = now_utc.to_rfc3339();
                        d.updated_at = now_str.clone();

                        lock.execute(
                            "UPDATE deadlines SET notified_lead = 1, updated_at = ?1 WHERE id = ?2",
                            params![now_str, d.id],
                        )?;

                        triggered.push((d, DeadlineNotificationKind::Approaching));
                    }
                }
            }
        }

        Ok(triggered)
    }

    pub fn reset_deadline_notification(
        conn: &Mutex<Connection>,
        id: &str,
        kind: &DeadlineNotificationKind,
    ) -> Result<()> {
        let lock = conn.lock().unwrap();
        match kind {
            DeadlineNotificationKind::Approaching => {
                lock.execute(
                    "UPDATE deadlines SET notified_lead = 0 WHERE id = ?1",
                    params![id],
                )?;
            }
            DeadlineNotificationKind::Due | DeadlineNotificationKind::Missed => {
                lock.execute(
                    "UPDATE deadlines SET notified_due = 0 WHERE id = ?1",
                    params![id],
                )?;
            }
        }
        Ok(())
    }


    // ---------------- DAILY GOALS ----------------

    fn get_completed_dates_for_goal(
        lock: &Connection,
        goal_id: &str,
    ) -> Result<std::collections::BTreeSet<chrono::NaiveDate>> {
        let mut stmt = lock.prepare(
            "SELECT date_str FROM goal_history WHERE goal_id = ?1 AND is_completed = 1",
        )?;

        let mut set = std::collections::BTreeSet::new();
        let rows = stmt.query_map(params![goal_id], |row| {
            let s: String = row.get(0)?;
            Ok(s)
        })?;

        for r in rows.flatten() {
            if let Ok(d) = chrono::NaiveDate::parse_from_str(&r, "%Y-%m-%d") {
                set.insert(d);
            }
        }

        Ok(set)
    }

    pub fn reconcile_daily_goals(
        conn: &Mutex<Connection>,
        today_str: &str,
    ) -> Result<Vec<DailyGoal>> {
        let lock = conn.lock().unwrap();
        Self::reconcile_daily_goals_locked(&lock, today_str)
    }

    pub fn reconcile_daily_goals_locked(
        lock: &Connection,
        today_str: &str,
    ) -> Result<Vec<DailyGoal>> {
        let today = chrono::NaiveDate::parse_from_str(today_str, "%Y-%m-%d")
            .unwrap_or_else(|_| chrono::Local::now().date_naive());

        let mut stmt = lock.prepare(
            "SELECT id, title, target_count, current_count, is_completed, date_str, current_streak, longest_streak, created_at, updated_at 
             FROM daily_goals ORDER BY is_completed ASC, created_at ASC",
        )?;

        let mut goals: Vec<DailyGoal> = stmt
            .query_map([], |row| {
                Ok(DailyGoal {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    target_count: row.get(2)?,
                    current_count: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    date_str: row.get(5)?,
                    current_streak: row.get::<_, i32>(6).unwrap_or(0),
                    longest_streak: row.get::<_, i32>(7).unwrap_or(0),
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        let now_utc = chrono::Utc::now().to_rfc3339();

        for goal in &mut goals {
            let mut completed_dates = Self::get_completed_dates_for_goal(&lock, &goal.id)?;

            if goal.date_str.as_str() < today_str {
                // Calendar date has changed: archive previous day's progress into goal_history
                if !goal.date_str.is_empty() {
                    let history_id = format!("{}-{}", goal.id, goal.date_str);
                    let was_completed = goal.is_completed || goal.current_count >= goal.target_count;

                    lock.execute(
                        "INSERT INTO goal_history (id, goal_id, date_str, target_count, current_count, is_completed, recorded_at)
                         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
                         ON CONFLICT(goal_id, date_str) DO UPDATE SET
                            target_count = excluded.target_count,
                            current_count = excluded.current_count,
                            is_completed = excluded.is_completed,
                            recorded_at = excluded.recorded_at",
                        params![
                            history_id,
                            goal.id,
                            goal.date_str,
                            goal.target_count,
                            goal.current_count,
                            if was_completed { 1 } else { 0 },
                            now_utc,
                        ],
                    )?;

                    if was_completed {
                        if let Ok(prev_date) = chrono::NaiveDate::parse_from_str(&goal.date_str, "%Y-%m-%d") {
                            completed_dates.insert(prev_date);
                        }
                    }
                }

                // Reset progress for the new calendar date
                goal.current_count = 0;
                goal.is_completed = false;
                goal.date_str = today_str.to_string();
                goal.updated_at = now_utc.clone();

                let (cur, long) = DailyGoal::compute_streaks(&completed_dates, today, false);
                goal.current_streak = cur;
                goal.longest_streak = long;

                lock.execute(
                    "UPDATE daily_goals SET current_count = 0, is_completed = 0, date_str = ?1, current_streak = ?2, longest_streak = ?3, updated_at = ?4 WHERE id = ?5",
                    params![goal.date_str, goal.current_streak, goal.longest_streak, goal.updated_at, goal.id],
                )?;
            } else {
                // Same day: recalculate streaks with current progress
                let is_comp = goal.is_completed || goal.current_count >= goal.target_count;
                let (cur, long) = DailyGoal::compute_streaks(&completed_dates, today, is_comp);
                if cur != goal.current_streak || long != goal.longest_streak {
                    goal.current_streak = cur;
                    goal.longest_streak = long;
                    lock.execute(
                        "UPDATE daily_goals SET current_streak = ?1, longest_streak = ?2 WHERE id = ?3",
                        params![goal.current_streak, goal.longest_streak, goal.id],
                    )?;
                }
            }
        }

        Ok(goals)
    }

    pub fn get_all_goals(conn: &Mutex<Connection>) -> Result<Vec<DailyGoal>> {
        let today = chrono::Local::now().format("%Y-%m-%d").to_string();
        Self::reconcile_daily_goals(conn, &today)
    }

    pub fn save_goal(conn: &Mutex<Connection>, goal: &DailyGoal) -> Result<DailyGoal> {
        let lock = conn.lock().unwrap();
        Self::save_goal_locked(&lock, goal)
    }

    pub fn save_goal_locked(lock: &Connection, goal: &DailyGoal) -> Result<DailyGoal> {
        let today_str = if goal.date_str.is_empty() {
            chrono::Local::now().format("%Y-%m-%d").to_string()
        } else {
            goal.date_str.clone()
        };
        let today = chrono::NaiveDate::parse_from_str(&today_str, "%Y-%m-%d")
            .unwrap_or_else(|_| chrono::Local::now().date_naive());

        let is_comp = goal.is_completed || goal.current_count >= goal.target_count;
        let completed_dates = Self::get_completed_dates_for_goal(lock, &goal.id)?;
        let (cur, long) = DailyGoal::compute_streaks(&completed_dates, today, is_comp);

        let mut to_save = goal.clone();
        to_save.date_str = today_str.clone();
        to_save.is_completed = is_comp;
        to_save.current_streak = cur;
        to_save.longest_streak = long;
        if to_save.created_at.is_empty() {
            to_save.created_at = chrono::Utc::now().to_rfc3339();
        }
        to_save.updated_at = chrono::Utc::now().to_rfc3339();

        lock.execute(
            "INSERT INTO daily_goals (id, title, target_count, current_count, is_completed, date_str, current_streak, longest_streak, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                target_count = excluded.target_count,
                current_count = excluded.current_count,
                is_completed = excluded.is_completed,
                date_str = excluded.date_str,
                current_streak = excluded.current_streak,
                longest_streak = excluded.longest_streak,
                updated_at = excluded.updated_at",
            params![
                to_save.id,
                to_save.title,
                to_save.target_count,
                to_save.current_count,
                if to_save.is_completed { 1 } else { 0 },
                to_save.date_str,
                to_save.current_streak,
                to_save.longest_streak,
                to_save.created_at,
                to_save.updated_at,
            ],
        )?;

        // Also upsert snapshot in goal_history for this date
        let history_id = format!("{}-{}", to_save.id, today_str);
        lock.execute(
            "INSERT INTO goal_history (id, goal_id, date_str, target_count, current_count, is_completed, recorded_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(goal_id, date_str) DO UPDATE SET
                target_count = excluded.target_count,
                current_count = excluded.current_count,
                is_completed = excluded.is_completed,
                recorded_at = excluded.recorded_at",
            params![
                history_id,
                to_save.id,
                today_str,
                to_save.target_count,
                to_save.current_count,
                if to_save.is_completed { 1 } else { 0 },
                to_save.updated_at,
            ],
        )?;

        Ok(to_save)
    }

    pub fn increment_goal(conn: &Mutex<Connection>, id: &str) -> Result<DailyGoal> {
        let lock = conn.lock().unwrap();
        let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
        let _ = Self::reconcile_daily_goals_locked(&lock, &today_str)?;

        let mut goal = lock.query_row(
            "SELECT id, title, target_count, current_count, is_completed, date_str, current_streak, longest_streak, created_at, updated_at 
             FROM daily_goals WHERE id = ?1",
            params![id],
            |row| {
                Ok(DailyGoal {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    target_count: row.get(2)?,
                    current_count: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    date_str: row.get(5)?,
                    current_streak: row.get::<_, i32>(6).unwrap_or(0),
                    longest_streak: row.get::<_, i32>(7).unwrap_or(0),
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )?;

        goal.current_count += 1;
        goal.is_completed = goal.current_count >= goal.target_count;
        Self::save_goal_locked(&lock, &goal)
    }

    pub fn decrement_goal(conn: &Mutex<Connection>, id: &str) -> Result<DailyGoal> {
        let lock = conn.lock().unwrap();
        let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
        let _ = Self::reconcile_daily_goals_locked(&lock, &today_str)?;

        let mut goal = lock.query_row(
            "SELECT id, title, target_count, current_count, is_completed, date_str, current_streak, longest_streak, created_at, updated_at 
             FROM daily_goals WHERE id = ?1",
            params![id],
            |row| {
                Ok(DailyGoal {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    target_count: row.get(2)?,
                    current_count: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    date_str: row.get(5)?,
                    current_streak: row.get::<_, i32>(6).unwrap_or(0),
                    longest_streak: row.get::<_, i32>(7).unwrap_or(0),
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )?;

        goal.current_count = (goal.current_count - 1).max(0);
        goal.is_completed = goal.current_count >= goal.target_count;
        Self::save_goal_locked(&lock, &goal)
    }

    pub fn toggle_goal(conn: &Mutex<Connection>, id: &str) -> Result<DailyGoal> {
        let lock = conn.lock().unwrap();
        let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
        let _ = Self::reconcile_daily_goals_locked(&lock, &today_str)?;

        let mut goal = lock.query_row(
            "SELECT id, title, target_count, current_count, is_completed, date_str, current_streak, longest_streak, created_at, updated_at 
             FROM daily_goals WHERE id = ?1",
            params![id],
            |row| {
                Ok(DailyGoal {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    target_count: row.get(2)?,
                    current_count: row.get(3)?,
                    is_completed: row.get::<_, i32>(4)? != 0,
                    date_str: row.get(5)?,
                    current_streak: row.get::<_, i32>(6).unwrap_or(0),
                    longest_streak: row.get::<_, i32>(7).unwrap_or(0),
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )?;

        let new_comp = !goal.is_completed;
        goal.is_completed = new_comp;
        goal.current_count = if new_comp {
            goal.current_count.max(goal.target_count)
        } else {
            0
        };
        Self::save_goal_locked(&lock, &goal)
    }

    pub fn delete_goal(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM daily_goals WHERE id = ?1", params![id])?;
        lock.execute("DELETE FROM goal_history WHERE goal_id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_goal_history(conn: &Mutex<Connection>, goal_id: &str) -> Result<Vec<GoalHistoryEntry>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, goal_id, date_str, target_count, current_count, is_completed, recorded_at 
             FROM goal_history WHERE goal_id = ?1 ORDER BY date_str ASC",
        )?;

        let entries = stmt
            .query_map(params![goal_id], |row| {
                Ok(GoalHistoryEntry {
                    id: row.get(0)?,
                    goal_id: row.get(1)?,
                    date_str: row.get(2)?,
                    target_count: row.get(3)?,
                    current_count: row.get(4)?,
                    is_completed: row.get::<_, i32>(5)? != 0,
                    recorded_at: row.get(6)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(entries)
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
                "show_seconds" => settings.show_seconds = r.1 == "true",
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
            ("show_seconds", if settings.show_seconds { "true" } else { "false" }),
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

    // ---------------- WORKSPACES ----------------

    fn get_workspace_widgets_internal(lock: &Connection, workspace_id: &str) -> Result<Vec<WorkspaceWidgetLayout>> {
        let mut stmt = lock.prepare(
            "SELECT widget_id, widget_type, title, x, y, width, height, is_pinned, visibility_mode, is_collapsed, lock_position, config_json
             FROM workspace_widgets WHERE workspace_id = ?1 ORDER BY created_at ASC",
        )?;

        let widgets = stmt
            .query_map(params![workspace_id], |row| {
                let type_str: String = row.get(1)?;
                let mode_str: String = row.get(8)?;
                let widget_type = WidgetType::from_str(&type_str).unwrap_or(WidgetType::Clock);
                let visibility_mode = VisibilityMode::from_str(&mode_str);

                Ok(WorkspaceWidgetLayout {
                    widget_id: row.get(0)?,
                    widget_type,
                    title: row.get(2)?,
                    x: row.get(3)?,
                    y: row.get(4)?,
                    width: row.get(5)?,
                    height: row.get(6)?,
                    is_pinned: row.get::<_, i32>(7)? != 0,
                    visibility_mode,
                    is_collapsed: row.get::<_, i32>(9)? != 0,
                    lock_position: row.get::<_, i32>(10)? != 0,
                    config_json: row.get(11)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(widgets)
    }

    pub fn get_all_workspaces(conn: &Mutex<Connection>) -> Result<Vec<Workspace>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, name, description, is_active, created_at, updated_at
             FROM workspaces ORDER BY created_at ASC",
        )?;

        let mut workspaces: Vec<Workspace> = stmt
            .query_map([], |row| {
                Ok(Workspace {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    is_active: row.get::<_, i32>(3)? != 0,
                    widgets: Vec::new(),
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        for ws in &mut workspaces {
            ws.widgets = Self::get_workspace_widgets_internal(&lock, &ws.id)?;
        }

        Ok(workspaces)
    }

    pub fn get_workspace_by_id(conn: &Mutex<Connection>, id: &str) -> Result<Option<Workspace>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, name, description, is_active, created_at, updated_at
             FROM workspaces WHERE id = ?1",
        )?;

        let mut row_iter = stmt.query_map(params![id], |row| {
            Ok(Workspace {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                is_active: row.get::<_, i32>(3)? != 0,
                widgets: Vec::new(),
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?;

        if let Some(res) = row_iter.next() {
            let mut ws = res?;
            drop(row_iter);
            drop(stmt);
            ws.widgets = Self::get_workspace_widgets_internal(&lock, &ws.id)?;
            Ok(Some(ws))
        } else {
            Ok(None)
        }
    }

    pub fn get_active_workspace(conn: &Mutex<Connection>) -> Result<Workspace> {
        let lock = conn.lock().unwrap();
        let active_opt: Option<Workspace> = lock
            .query_row(
                "SELECT id, name, description, is_active, created_at, updated_at FROM workspaces WHERE is_active = 1 LIMIT 1",
                [],
                |row| {
                    Ok(Workspace {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        is_active: row.get::<_, i32>(3)? != 0,
                        widgets: Vec::new(),
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )
            .optional()?;

        if let Some(mut ws) = active_opt {
            ws.widgets = Self::get_workspace_widgets_internal(&lock, &ws.id)?;
            return Ok(ws);
        }

        // Fallback: pick first workspace or create default
        let first_id: Option<String> = lock
            .query_row("SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 1", [], |r| r.get(0))
            .optional()?;

        if let Some(id) = first_id {
            lock.execute("UPDATE workspaces SET is_active = 1 WHERE id = ?1", params![id])?;
            let mut ws = lock.query_row(
                "SELECT id, name, description, is_active, created_at, updated_at FROM workspaces WHERE id = ?1",
                params![id],
                |row| {
                    Ok(Workspace {
                        id: row.get(0)?,
                        name: row.get(1)?,
                        description: row.get(2)?,
                        is_active: true,
                        widgets: Vec::new(),
                        created_at: row.get(4)?,
                        updated_at: row.get(5)?,
                    })
                },
            )?;
            ws.widgets = Self::get_workspace_widgets_internal(&lock, &ws.id)?;
            Ok(ws)
        } else {
            let now = chrono::Utc::now().to_rfc3339();
            let def_ws = Workspace {
                id: "default".to_string(),
                name: "Default Workspace".to_string(),
                description: "Primary workspace layout".to_string(),
                is_active: true,
                widgets: Vec::new(),
                created_at: now.clone(),
                updated_at: now.clone(),
            };
            lock.execute(
                "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?5)",
                params![def_ws.id, def_ws.name, def_ws.description, now, now],
            )?;
            Ok(def_ws)
        }
    }

    pub fn save_workspace(conn: &Mutex<Connection>, ws: &Workspace) -> Result<Workspace> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let mut to_save = ws.clone();
        if to_save.id.is_empty() {
            to_save.id = uuid::Uuid::new_v4().to_string();
        }
        if to_save.created_at.is_empty() {
            to_save.created_at = now.clone();
        }
        to_save.updated_at = now.clone();

        lock.execute(
            "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                description = excluded.description,
                is_active = excluded.is_active,
                updated_at = excluded.updated_at",
            params![
                to_save.id,
                to_save.name,
                to_save.description,
                if to_save.is_active { 1 } else { 0 },
                to_save.created_at,
                to_save.updated_at,
            ],
        )?;

        // Replace workspace_widgets with new layout
        lock.execute("DELETE FROM workspace_widgets WHERE workspace_id = ?1", params![to_save.id])?;

        for w in &to_save.widgets {
            let row_id = format!("{}-{}", to_save.id, w.widget_id);
            lock.execute(
                "INSERT INTO workspace_widgets (
                    id, workspace_id, widget_id, widget_type, title, x, y, width, height,
                    is_pinned, visibility_mode, is_collapsed, lock_position, config_json, created_at, updated_at
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)",
                params![
                    row_id,
                    to_save.id,
                    w.widget_id,
                    w.widget_type.as_str(),
                    w.title,
                    w.x,
                    w.y,
                    w.width,
                    w.height,
                    if w.is_pinned { 1 } else { 0 },
                    w.visibility_mode.as_str(),
                    if w.is_collapsed { 1 } else { 0 },
                    if w.lock_position { 1 } else { 0 },
                    w.config_json,
                    now,
                    now,
                ],
            )?;
        }

        Ok(to_save)
    }

    pub fn set_active_workspace(conn: &Mutex<Connection>, id: &str) -> Result<Workspace> {
        let lock = conn.lock().unwrap();
        lock.execute("UPDATE workspaces SET is_active = 0", [])?;
        let rows_affected = lock.execute("UPDATE workspaces SET is_active = 1 WHERE id = ?1", params![id])?;
        if rows_affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        drop(lock);
        Self::get_active_workspace(conn)
    }

    pub fn delete_workspace(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        // Prevent deleting active workspace or last workspace
        let is_active: bool = lock
            .query_row("SELECT is_active FROM workspaces WHERE id = ?1", params![id], |r| r.get::<_, i32>(0))
            .map(|val| val != 0)
            .unwrap_or(false);

        if is_active {
            return Err(rusqlite::Error::ToSqlConversionFailure(
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, "Cannot delete the active workspace")),
            ));
        }

        let total: i64 = lock.query_row("SELECT COUNT(*) FROM workspaces", [], |r| r.get(0))?;
        if total <= 1 {
            return Err(rusqlite::Error::ToSqlConversionFailure(
                Box::new(std::io::Error::new(std::io::ErrorKind::Other, "Cannot delete the last remaining workspace")),
            ));
        }

        lock.execute("DELETE FROM workspace_widgets WHERE workspace_id = ?1", params![id])?;
        lock.execute("DELETE FROM workspaces WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn update_workspace_widget_geometry(
        conn: &Mutex<Connection>,
        workspace_id: &str,
        widget_id: &str,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE workspace_widgets SET x = ?1, y = ?2, width = ?3, height = ?4, updated_at = ?5 WHERE workspace_id = ?6 AND widget_id = ?7",
            params![x, y, width, height, now, workspace_id, widget_id],
        )?;
        lock.execute(
            "UPDATE widget_instances SET x = ?1, y = ?2, width = ?3, height = ?4, updated_at = ?5 WHERE id = ?6",
            params![x, y, width, height, now, widget_id],
        )?;
        Ok(())
    }

    pub fn update_workspace_widget_position(
        conn: &Mutex<Connection>,
        workspace_id: &str,
        widget_id: &str,
        x: f64,
        y: f64,
    ) -> Result<()> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        lock.execute(
            "UPDATE workspace_widgets SET x = ?1, y = ?2, updated_at = ?3 WHERE workspace_id = ?4 AND widget_id = ?5",
            params![x, y, now, workspace_id, widget_id],
        )?;
        lock.execute(
            "UPDATE widget_instances SET x = ?1, y = ?2, updated_at = ?3 WHERE id = ?4",
            params![x, y, now, widget_id],
        )?;
        Ok(())
    }

    // ---------------- WORLD CLOCK ----------------

    pub fn get_world_clocks(conn: &Mutex<Connection>) -> Result<Vec<WorldClock>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, city_name, timezone, sort_order, created_at, updated_at
             FROM world_clocks ORDER BY sort_order ASC, created_at ASC",
        )?;

        let clocks = stmt
            .query_map([], |row| {
                Ok(WorldClock {
                    id: row.get(0)?,
                    city_name: row.get(1)?,
                    timezone: row.get(2)?,
                    sort_order: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: row.get(5)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(clocks)
    }

    pub fn save_world_clock(conn: &Mutex<Connection>, clock: &WorldClock) -> Result<WorldClock> {
        if !validate_iana_timezone(&clock.timezone) {
            return Err(rusqlite::Error::ToSqlConversionFailure(
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, format!("Invalid IANA timezone: {}", clock.timezone))),
            ));
        }

        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let mut to_save = clock.clone();
        if to_save.id.is_empty() {
            to_save.id = uuid::Uuid::new_v4().to_string();
        }
        if to_save.created_at.is_empty() {
            to_save.created_at = now.clone();
        }
        to_save.updated_at = now.clone();

        lock.execute(
            "INSERT INTO world_clocks (id, city_name, timezone, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(id) DO UPDATE SET
                city_name = excluded.city_name,
                timezone = excluded.timezone,
                sort_order = excluded.sort_order,
                updated_at = excluded.updated_at",
            params![
                to_save.id,
                to_save.city_name,
                to_save.timezone,
                to_save.sort_order,
                to_save.created_at,
                to_save.updated_at,
            ],
        )?;

        Ok(to_save)
    }

    pub fn delete_world_clock(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM world_clocks WHERE id = ?1", params![id])?;
        Ok(())
    }

    // ---------------- ALARMS ----------------

    pub fn get_alarms(conn: &Mutex<Connection>) -> Result<Vec<Alarm>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, time_str, days_of_week, is_enabled, is_recurring, one_time_date, last_triggered_at, created_at, updated_at
             FROM alarms ORDER BY time_str ASC, created_at ASC",
        )?;

        let alarms = stmt
            .query_map([], |row| {
                let days_raw: String = row.get(3)?;
                let days_of_week: Vec<u8> = serde_json::from_str(&days_raw).unwrap_or_default();
                Ok(Alarm {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    time_str: row.get(2)?,
                    days_of_week,
                    is_enabled: row.get::<_, i32>(4)? != 0,
                    is_recurring: row.get::<_, i32>(5)? != 0,
                    one_time_date: row.get(6)?,
                    last_triggered_at: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();

        Ok(alarms)
    }

    pub fn save_alarm(conn: &Mutex<Connection>, alarm: &Alarm) -> Result<Alarm> {
        // Validate time format "HH:MM"
        let parts: Vec<&str> = alarm.time_str.split(':').collect();
        if parts.len() != 2 {
            return Err(rusqlite::Error::ToSqlConversionFailure(
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Alarm time must be in HH:MM format")),
            ));
        }
        match (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
            (Ok(h), Ok(m)) if h < 24 && m < 60 => {}
            _ => {
                return Err(rusqlite::Error::ToSqlConversionFailure(
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Alarm time hours must be 0-23 and minutes 0-59")),
                ));
            }
        }

        // Validate recurrence
        if alarm.is_recurring && alarm.days_of_week.is_empty() {
            return Err(rusqlite::Error::ToSqlConversionFailure(
                Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Recurring alarm must specify at least one day of week")),
            ));
        }
        for day in &alarm.days_of_week {
            if *day < 1 || *day > 7 {
                return Err(rusqlite::Error::ToSqlConversionFailure(
                    Box::new(std::io::Error::new(std::io::ErrorKind::InvalidInput, "Day of week must be between 1 (Monday) and 7 (Sunday)")),
                ));
            }
        }

        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let mut to_save = alarm.clone();
        if to_save.id.is_empty() {
            to_save.id = uuid::Uuid::new_v4().to_string();
        }
        if to_save.created_at.is_empty() {
            to_save.created_at = now.clone();
        }
        to_save.updated_at = now.clone();
        let days_json = serde_json::to_string(&to_save.days_of_week).unwrap_or_else(|_| "[]".to_string());

        lock.execute(
            "INSERT INTO alarms (id, title, time_str, days_of_week, is_enabled, is_recurring, one_time_date, last_triggered_at, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                time_str = excluded.time_str,
                days_of_week = excluded.days_of_week,
                is_enabled = excluded.is_enabled,
                is_recurring = excluded.is_recurring,
                one_time_date = excluded.one_time_date,
                last_triggered_at = excluded.last_triggered_at,
                updated_at = excluded.updated_at",
            params![
                to_save.id,
                to_save.title,
                to_save.time_str,
                days_json,
                if to_save.is_enabled { 1 } else { 0 },
                if to_save.is_recurring { 1 } else { 0 },
                to_save.one_time_date,
                to_save.last_triggered_at,
                to_save.created_at,
                to_save.updated_at,
            ],
        )?;

        Ok(to_save)
    }

    pub fn toggle_alarm(conn: &Mutex<Connection>, id: &str) -> Result<Alarm> {
        let lock = conn.lock().unwrap();
        let now = chrono::Utc::now().to_rfc3339();
        let current_enabled: i32 = lock
            .query_row("SELECT is_enabled FROM alarms WHERE id = ?1", params![id], |r| r.get(0))?;
        let new_enabled = if current_enabled != 0 { 0 } else { 1 };

        lock.execute(
            "UPDATE alarms SET is_enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_enabled, now, id],
        )?;

        let mut stmt = lock.prepare(
            "SELECT id, title, time_str, days_of_week, is_enabled, is_recurring, one_time_date, last_triggered_at, created_at, updated_at
             FROM alarms WHERE id = ?1",
        )?;

        let alarm = stmt.query_row(params![id], |row| {
            let days_raw: String = row.get(3)?;
            let days_of_week: Vec<u8> = serde_json::from_str(&days_raw).unwrap_or_default();
            Ok(Alarm {
                id: row.get(0)?,
                title: row.get(1)?,
                time_str: row.get(2)?,
                days_of_week,
                is_enabled: row.get::<_, i32>(4)? != 0,
                is_recurring: row.get::<_, i32>(5)? != 0,
                one_time_date: row.get(6)?,
                last_triggered_at: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        Ok(alarm)
    }

    pub fn delete_alarm(conn: &Mutex<Connection>, id: &str) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute("DELETE FROM alarms WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn reconcile_alarms(
        conn: &Mutex<Connection>,
        now_local: chrono::DateTime<chrono::Local>,
    ) -> Result<Vec<(Alarm, AlarmTriggerKind)>> {
        let lock = conn.lock().unwrap();
        let mut stmt = lock.prepare(
            "SELECT id, title, time_str, days_of_week, is_enabled, is_recurring, one_time_date, last_triggered_at, created_at, updated_at
             FROM alarms WHERE is_enabled = 1",
        )?;

        let alarms: Vec<Alarm> = stmt
            .query_map([], |row| {
                let days_raw: String = row.get(3)?;
                let days_of_week: Vec<u8> = serde_json::from_str(&days_raw).unwrap_or_default();
                Ok(Alarm {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    time_str: row.get(2)?,
                    days_of_week,
                    is_enabled: row.get::<_, i32>(4)? != 0,
                    is_recurring: row.get::<_, i32>(5)? != 0,
                    one_time_date: row.get(6)?,
                    last_triggered_at: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })?
            .filter_map(|r| r.ok())
            .collect();
        drop(stmt);

        let mut triggered = Vec::new();
        let now_date_str = now_local.format("%Y-%m-%d").to_string();
        let now_naive = now_local.naive_local();
        let current_weekday = now_local.weekday().number_from_monday() as u8;

        for alarm in alarms {
            // Check recurrence eligibility
            if alarm.is_recurring {
                if !alarm.days_of_week.contains(&current_weekday) {
                    continue;
                }
            } else if let Some(ref o_date) = alarm.one_time_date {
                if o_date != &now_date_str {
                    continue;
                }
            }

            // Parse alarm time "HH:MM"
            let parts: Vec<&str> = alarm.time_str.split(':').collect();
            if parts.len() != 2 {
                continue;
            }
            let (h, m) = match (parts[0].parse::<u32>(), parts[1].parse::<u32>()) {
                (Ok(h), Ok(m)) if h < 24 && m < 60 => (h, m),
                _ => continue,
            };

            let target_dt = match now_local.date_naive().and_hms_opt(h, m, 0) {
                Some(dt) => dt,
                None => continue,
            };

            // Check if already triggered today (within 12 hours)
            let already_triggered_today = alarm.last_triggered_at.as_ref().map_or(false, |last| {
                if last.starts_with(&now_date_str) {
                    return true;
                }
                if let Ok(last_dt) = chrono::DateTime::parse_from_rfc3339(last) {
                    let diff = now_local.signed_duration_since(last_dt.with_timezone(&chrono::Local));
                    diff.num_hours() < 12
                } else {
                    false
                }
            });

            if already_triggered_today {
                continue;
            }

            // Check if alarm is Due or Missed
            if now_naive >= target_dt && now_naive <= target_dt + chrono::Duration::minutes(2) {
                // Due now
                triggered.push((alarm.clone(), AlarmTriggerKind::Due));
                let now_rfc = now_local.to_rfc3339();
                let new_enabled = if alarm.is_recurring { 1 } else { 0 };
                lock.execute(
                    "UPDATE alarms SET is_enabled = ?1, last_triggered_at = ?2, updated_at = ?2 WHERE id = ?3",
                    params![new_enabled, now_rfc, alarm.id],
                )?;
            } else if now_naive > target_dt + chrono::Duration::minutes(2) {
                // Missed while app was closed or PC was asleep
                let target_dt_str = target_dt.format("%Y-%m-%dT%H:%M:%S").to_string();
                let was_created_before = alarm.created_at.as_str() < target_dt_str.as_str();
                if was_created_before {
                    triggered.push((alarm.clone(), AlarmTriggerKind::Missed));
                    let now_rfc = now_local.to_rfc3339();
                    let new_enabled = if alarm.is_recurring { 1 } else { 0 };
                    lock.execute(
                        "UPDATE alarms SET is_enabled = ?1, last_triggered_at = ?2, updated_at = ?2 WHERE id = ?3",
                        params![new_enabled, now_rfc, alarm.id],
                    )?;
                }
            }
        }

        Ok(triggered)
    }

    pub fn reset_alarm_trigger(
        conn: &Mutex<Connection>,
        id: &str,
        _was_recurring: bool,
    ) -> Result<()> {
        let lock = conn.lock().unwrap();
        lock.execute(
            "UPDATE alarms SET is_enabled = 1, last_triggered_at = NULL WHERE id = ?1",
            params![id],
        )?;
        Ok(())
    }
}
