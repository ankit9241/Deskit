use tauri::{AppHandle, Emitter, State};

use crate::models::{DailyGoal, Deadline, FocusSession, Note, Task};
use crate::persistence::{DbState, Repositories};

// ---------------- TASKS ----------------

#[tauri::command]
pub fn get_tasks(db: State<'_, DbState>) -> Result<Vec<Task>, String> {
    Repositories::get_all_tasks(&db.0).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_task(app: AppHandle, db: State<'_, DbState>, task: Task) -> Result<Task, String> {
    let mut task_to_save = task;
    let now = chrono::Utc::now().to_rfc3339();
    if task_to_save.id.is_empty() {
        task_to_save.id = uuid::Uuid::new_v4().to_string();
        task_to_save.created_at = now.clone();
    }
    task_to_save.updated_at = now;

    Repositories::save_task(&db.0, &task_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("tasks-updated", &task_to_save);
    Ok(task_to_save)
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
    }
    note_to_save.updated_at = now;

    Repositories::save_note(&db.0, &note_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-updated", &note_to_save);
    Ok(note_to_save)
}

#[tauri::command]
pub fn delete_note(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_note(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("notes-updated", &id);
    Ok(())
}

// ---------------- FOCUS ----------------

#[tauri::command]
pub fn get_focus_session(db: State<'_, DbState>) -> Result<FocusSession, String> {
    Repositories::get_focus_session(&db.0).map_err(|e| e.to_string())
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
    let _ = app.emit("deadlines-updated", &deadline_to_save);
    Ok(deadline_to_save)
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

    Repositories::save_goal(&db.0, &goal_to_save).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &goal_to_save);
    Ok(goal_to_save)
}

#[tauri::command]
pub fn delete_goal(app: AppHandle, db: State<'_, DbState>, id: String) -> Result<(), String> {
    Repositories::delete_goal(&db.0, &id).map_err(|e| e.to_string())?;
    let _ = app.emit("goals-updated", &id);
    Ok(())
}
