use std::sync::Mutex;
use rusqlite::Connection;

use pinned_lib::models::{
    AppSettings, DailyGoal, Deadline, FocusSession, Note, Task, VisibilityMode, WidgetInstance,
    WidgetType,
};
use pinned_lib::persistence::migrations::run_migrations;
use pinned_lib::persistence::Repositories;

fn setup_in_memory_db() -> Mutex<Connection> {
    let mut conn = Connection::open_in_memory().expect("failed to open in-memory db");
    run_migrations(&mut conn).expect("failed to run migrations");
    Mutex::new(conn)
}

#[test]
fn test_widget_type_attributes() {
    assert_eq!(WidgetType::Clock.default_dimensions(), (260.0, 140.0));
    assert_eq!(WidgetType::Tasks.default_dimensions(), (320.0, 420.0));
    assert_eq!(WidgetType::Focus.default_dimensions(), (280.0, 220.0));
    assert_eq!(WidgetType::Notes.default_dimensions(), (320.0, 360.0));
    assert_eq!(WidgetType::Deadlines.default_dimensions(), (320.0, 380.0));
    assert_eq!(WidgetType::Goals.default_dimensions(), (320.0, 380.0));

    assert_eq!(WidgetType::Clock.as_str(), "clock");
    assert_eq!(WidgetType::from_str("clock"), Some(WidgetType::Clock));
}

#[test]
fn test_widget_crud() {
    let db = setup_in_memory_db();

    let widget = WidgetInstance {
        id: "widget-clock".to_string(),
        widget_type: WidgetType::Clock,
        title: "Desktop Clock".to_string(),
        x: 100.0,
        y: 150.0,
        width: 260.0,
        height: 140.0,
        is_pinned: true,
        visibility_mode: VisibilityMode::AlwaysOnTop,
        is_collapsed: false,
        config_json: "{}".to_string(),
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_widget(&db, &widget).expect("save widget");

    let loaded = Repositories::get_widget_by_id(&db, "widget-clock")
        .expect("get widget")
        .expect("widget should exist");

    assert_eq!(loaded.id, "widget-clock");
    assert_eq!(loaded.title, "Desktop Clock");
    assert_eq!(loaded.is_pinned, true);
    assert_eq!(loaded.width, 260.0);

    let all = Repositories::get_all_widgets(&db).expect("get all widgets");
    assert_eq!(all.len(), 1);

    Repositories::update_widget_geometry(&db, "widget-clock", 200.0, 250.0, 260.0, 140.0)
        .expect("update geometry");
    let updated = Repositories::get_widget_by_id(&db, "widget-clock").unwrap().unwrap();
    assert_eq!(updated.x, 200.0);
    assert_eq!(updated.y, 250.0);

    Repositories::delete_widget(&db, "widget-clock").expect("delete widget");
    let after_delete = Repositories::get_widget_by_id(&db, "widget-clock").unwrap();
    assert!(after_delete.is_none());
}

#[test]
fn test_task_crud() {
    let db = setup_in_memory_db();

    let task = Task {
        id: "task-1".to_string(),
        title: "Test Task 1".to_string(),
        description: Some("Task description".to_string()),
        is_completed: false,
        priority: "high".to_string(),
        due_date: Some("2026-11-19T10:00:00Z".to_string()),
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_task(&db, &task).expect("save task");

    let all_tasks = Repositories::get_all_tasks(&db).expect("get all tasks");
    assert_eq!(all_tasks.len(), 1);
    assert_eq!(all_tasks[0].title, "Test Task 1");
    assert_eq!(all_tasks[0].priority, "high");

    Repositories::delete_task(&db, "task-1").expect("delete task");
    let after_delete = Repositories::get_all_tasks(&db).expect("get all tasks");
    assert_eq!(after_delete.len(), 0);
}

#[test]
fn test_note_crud() {
    let db = setup_in_memory_db();

    let note = Note {
        id: "note-1".to_string(),
        title: "Draft Ideas".to_string(),
        content: "Build PINNED desktop widget architecture.".to_string(),
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_note(&db, &note).expect("save note");

    let all_notes = Repositories::get_all_notes(&db).expect("get all notes");
    assert_eq!(all_notes.len(), 1);
    assert_eq!(all_notes[0].content, "Build PINNED desktop widget architecture.");

    Repositories::delete_note(&db, "note-1").expect("delete note");
    let after_delete = Repositories::get_all_notes(&db).expect("get all notes");
    assert_eq!(after_delete.len(), 0);
}

#[test]
fn test_focus_session() {
    let db = setup_in_memory_db();

    // First call initializes default
    let default_session = Repositories::get_focus_session(&db).expect("get default session");
    assert_eq!(default_session.duration_minutes, 25);
    assert_eq!(default_session.break_minutes, 5);
    assert_eq!(default_session.remaining_seconds, 1500);

    let updated_session = FocusSession {
        id: "default".to_string(),
        duration_minutes: 30,
        break_minutes: 10,
        state: "running".to_string(),
        remaining_seconds: 1200,
        is_running: true,
        updated_at: "2026-11-18T12:30:00Z".to_string(),
    };

    Repositories::save_focus_session(&db, &updated_session).expect("save focus session");

    let loaded = Repositories::get_focus_session(&db).expect("get updated session");
    assert_eq!(loaded.duration_minutes, 30);
    assert_eq!(loaded.remaining_seconds, 1200);
    assert_eq!(loaded.is_running, true);
}

#[test]
fn test_deadlines_crud() {
    let db = setup_in_memory_db();

    let dl = Deadline {
        id: "dl-1".to_string(),
        title: "Phase 1 Review".to_string(),
        due_date: "2026-11-18T18:00:00Z".to_string(),
        category: "Milestone".to_string(),
        is_completed: false,
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_deadline(&db, &dl).expect("save deadline");
    let all = Repositories::get_all_deadlines(&db).expect("get deadlines");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].title, "Phase 1 Review");

    Repositories::delete_deadline(&db, "dl-1").expect("delete deadline");
    assert_eq!(Repositories::get_all_deadlines(&db).unwrap().len(), 0);
}

#[test]
fn test_goals_crud() {
    let db = setup_in_memory_db();

    let goal = DailyGoal {
        id: "goal-1".to_string(),
        title: "Review PRs".to_string(),
        target_count: 5,
        current_count: 3,
        is_completed: false,
        date_str: "2026-11-18".to_string(),
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_goal(&db, &goal).expect("save goal");
    let all = Repositories::get_all_goals(&db).expect("get goals");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].current_count, 3);

    Repositories::delete_goal(&db, "goal-1").expect("delete goal");
    assert_eq!(Repositories::get_all_goals(&db).unwrap().len(), 0);
}

#[test]
fn test_app_settings() {
    let db = setup_in_memory_db();

    // Default settings check
    let default_settings = Repositories::get_app_settings(&db).expect("get default settings");
    assert_eq!(default_settings.launch_at_login, false);
    assert_eq!(default_settings.close_to_tray, true);
    assert_eq!(default_settings.time_format_24h, false);

    let modified_settings = AppSettings {
        launch_at_login: true,
        close_to_tray: false,
        time_format_24h: true,
        default_visibility_mode: "always_on_top".to_string(),
        theme: "dark".to_string(),
    };

    Repositories::save_app_settings(&db, &modified_settings).expect("save settings");
    let loaded = Repositories::get_app_settings(&db).expect("get modified settings");
    assert_eq!(loaded.launch_at_login, true);
    assert_eq!(loaded.close_to_tray, false);
    assert_eq!(loaded.time_format_24h, true);
}
