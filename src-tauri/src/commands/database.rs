use tauri::{AppHandle, Emitter, State};

use crate::models::{DailyGoal, Deadline, FocusSession, GoalHistoryEntry, Note, Task};
use crate::persistence::{DbState, Repositories};

// ---------------- TASKS ----------------

#[tauri::command]
pub fn get_tasks(db: State<'_, DbState>) -> Result<Vec<Task>, String> {
    Repositories::get_all_tasks(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_task(app: AppHandle, db: State<'_, DbState>, task: Task) -> Result<Task, String> {
    if task.title.trim().is_empty() {
        return Err("Task title cannot be empty".to_string());
    }
    let mut task_to_save = task;
    task_to_save.title = task_to_save.title.trim().to_string();
    if let Some(desc) = &task_to_save.description {
        let trimmed = desc.trim().to_string();
        task_to_save.description = if trimmed.is_empty() { None } else { Some(trimmed) };
    }
    if let Some(due) = &task_to_save.due_date {
        let trimmed = due.trim().to_string();
        task_to_save.due_date = if trimmed.is_empty() { None } else { Some(trimmed) };
    }
    let p = task_to_save.priority.to_lowercase();
    task_to_save.priority = if p == "high" || p == "low" { p } else { "medium".to_string() };

    let now = chrono::Utc::now().to_rfc3339();
    if task_to_save.id.is_empty() {
        task_to_save.id = uuid::Uuid::new_v4().to_string();
        task_to_save.created_at = now.clone();
    } else if task_to_save.created_at.is_empty() {
        task_to_save.created_at = now.clone();
    }
    task_to_save.updated_at = now;

    Repositories::save_task(&db.0, &task_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-updated", &task_to_save);
    Ok(task_to_save)
}

#[tauri::command]
pub fn toggle_task(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<Task, String> {
    let task = Repositories::toggle_task(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-updated", &task);
    Ok(task)
}

#[tauri::command]
pub fn delete_task(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_task(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-updated", &id);
    Ok(())
}

// ---------------- NOTES ----------------

#[tauri::command]
pub fn get_notes(db: State<'_, DbState>) -> Result<Vec<Note>, String> {
    Repositories::get_all_notes(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_note(app: AppHandle, db: State<'_, DbState>, note: Note) -> Result<Note, String> {
    let mut note_to_save = note;
    let now = chrono::Utc::now().to_rfc3339();
    if note_to_save.id.is_empty() {
        note_to_save.id = uuid::Uuid::new_v4().to_string();
        note_to_save.created_at = now.clone();
    } else if note_to_save.created_at.is_empty() {
        note_to_save.created_at = now.clone();
    }
    note_to_save.updated_at = now;

    Repositories::save_note(&db.0, &note_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-updated", &note_to_save);
    Ok(note_to_save)
}

#[tauri::command]
pub fn toggle_pin_note(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<Note, String> {
    let updated = Repositories::toggle_pin_note(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-updated", &updated);
    Ok(updated)
}

#[tauri::command]
pub fn search_notes(db: State<'_, DbState>, query: String) -> Result<Vec<Note>, String> {
    Repositories::search_notes(&db.0, &query).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_note(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_note(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-updated", &id);
    Ok(())
}

// ---------------- FOCUS ----------------

#[tauri::command]
pub fn get_focus_session(app: AppHandle, db: State<'_, DbState>) -> Result<FocusSession, String> {
    let (session, transition) = Repositories::reconcile_focus_session(&db.0, chrono::Utc::now())
        .map_err(|e| e.to_string())?;

    if transition != crate::models::focus::FocusTransition::None {
        let _ = app.emit("focus-completed", &transition);
        let _ = app.emit("focus-updated", &session);
    }
    Ok(session)
}

#[tauri::command]
pub fn start_focus_timer(app: AppHandle, db: State<'_, DbState>) -> Result<FocusSession, String> {
    let mut session = Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())?;
    session.start(chrono::Utc::now());
    Repositories::save_focus_session(&db.0, &session).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session);
    Ok(session)
}

#[tauri::command]
pub fn pause_focus_timer(app: AppHandle, db: State<'_, DbState>) -> Result<FocusSession, String> {
    let mut session = Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())?;
    session.pause(chrono::Utc::now());
    Repositories::save_focus_session(&db.0, &session).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session);
    Ok(session)
}

#[tauri::command]
pub fn reset_focus_timer(app: AppHandle, db: State<'_, DbState>) -> Result<FocusSession, String> {
    let mut session = Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())?;
    session.reset(chrono::Utc::now());
    Repositories::save_focus_session(&db.0, &session).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session);
    Ok(session)
}

#[tauri::command]
pub fn add_focus_minutes(
    app: AppHandle,
    db: State<'_, DbState>,
    minutes: i32,
) -> Result<FocusSession, String> {
    let mut session = Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())?;
    session.add_minutes(minutes, chrono::Utc::now());
    Repositories::save_focus_session(&db.0, &session).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session);
    Ok(session)
}

#[tauri::command]
pub fn switch_focus_mode(
    app: AppHandle,
    db: State<'_, DbState>,
    mode: String,
) -> Result<FocusSession, String> {
    let mut session = Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())?;
    session.switch_mode(&mode, chrono::Utc::now());
    Repositories::save_focus_session(&db.0, &session).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session);
    Ok(session)
}

#[tauri::command]
pub fn set_focus_durations(
    app: AppHandle,
    db: State<'_, DbState>,
    focus_mins: i32,
    break_mins: i32,
) -> Result<FocusSession, String> {
    let mut session = Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())?;
    session.set_durations(focus_mins, break_mins, chrono::Utc::now());
    Repositories::save_focus_session(&db.0, &session).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session);
    Ok(session)
}

#[tauri::command]
pub fn tick_focus_timer(app: AppHandle, db: State<'_, DbState>) -> Result<FocusSession, String> {
    let (session, transition) = Repositories::reconcile_focus_session(&db.0, chrono::Utc::now())
        .map_err(|e| e.to_string())?;

    if transition != crate::models::focus::FocusTransition::None {
        let _ = app.emit("focus-completed", &transition);
        let _ = app.emit("focus-updated", &session);
    }
    Ok(session)
}

#[tauri::command]
pub fn save_focus_session(
    app: AppHandle,
    db: State<'_, DbState>,
    session: FocusSession,
) -> Result<FocusSession, String> {
    let mut session_to_save = session;
    session_to_save.updated_at = chrono::Utc::now().to_rfc3339();

    Repositories::save_focus_session(&db.0, &session_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("focus-updated", &session_to_save);
    Ok(session_to_save)
}

// ---------------- DEADLINES ----------------

#[tauri::command]
pub fn get_deadlines(db: State<'_, DbState>) -> Result<Vec<Deadline>, String> {
    Repositories::get_all_deadlines(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_deadline(
    app: AppHandle,
    db: State<'_, DbState>,
    deadline: Deadline,
) -> Result<Deadline, String> {
    let mut deadline_to_save = deadline;
    let now = chrono::Utc::now().to_rfc3339();
    if deadline_to_save.id.is_empty() {
        deadline_to_save.id = uuid::Uuid::new_v4().to_string();
        deadline_to_save.created_at = now.clone();
    }
    deadline_to_save.updated_at = now;

    Repositories::save_deadline(&db.0, &deadline_to_save).map_err(|e| e.to_string())?;
    let saved = Repositories::get_deadline_by_id(&db.0, &deadline_to_save.id)
        .map_err(|e| e.to_string())?
        .unwrap_or(deadline_to_save);

    let _ = app.emit("deadlines-updated", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn delete_deadline(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_deadline(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("deadlines-updated", &id);
    Ok(())
}

// ---------------- DAILY GOALS ----------------

#[tauri::command]
pub fn get_goals(db: State<'_, DbState>) -> Result<Vec<DailyGoal>, String> {
    Repositories::get_all_goals(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_goal(
    app: AppHandle,
    db: State<'_, DbState>,
    goal: DailyGoal,
) -> Result<DailyGoal, String> {
    let mut goal_to_save = goal;
    let now = chrono::Utc::now().to_rfc3339();
    if goal_to_save.id.is_empty() {
        goal_to_save.id = uuid::Uuid::new_v4().to_string();
        goal_to_save.created_at = now.clone();
    }
    goal_to_save.updated_at = now;

    let saved = Repositories::save_goal(&db.0, &goal_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &saved);
    Ok(saved)
}

#[tauri::command]
pub fn increment_goal(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
) -> Result<DailyGoal, String> {
    let updated = Repositories::increment_goal(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &updated);
    Ok(updated)
}

#[tauri::command]
pub fn decrement_goal(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
) -> Result<DailyGoal, String> {
    let updated = Repositories::decrement_goal(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &updated);
    Ok(updated)
}

#[tauri::command]
pub fn toggle_goal(
    app: AppHandle,
    db: State<'_, DbState>,
    id: String,
) -> Result<DailyGoal, String> {
    let updated = Repositories::toggle_goal(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &updated);
    Ok(updated)
}

#[tauri::command]
pub fn delete_goal(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_goal(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &id);
    Ok(())
}

#[tauri::command]
pub fn get_goal_history(
    db: State<'_, DbState>,
    goal_id: String,
) -> Result<Vec<GoalHistoryEntry>, String> {
    Repositories::get_goal_history(&db.0, &goal_id).map_err(|e| e.to_string())
}
