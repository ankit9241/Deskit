use std::sync::{Arc, Mutex};
use rusqlite::Connection;
use chrono::Datelike;

use deskit_lib::models::{
    get_timezone_offset_seconds, utc_to_local, validate_iana_timezone, Alarm, AlarmTriggerKind,
    AppSettings, DailyGoal, Deadline, DeadlineNotificationKind, FocusSession, Note, Task,
    VisibilityMode, WidgetInstance, WidgetType, Workspace, WorkspaceWidgetLayout, WorldClock,
};
use deskit_lib::persistence::migrations::run_migrations;
use deskit_lib::persistence::Repositories;

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
    let db = Arc::new(setup_in_memory_db());

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
    let db = Arc::new(setup_in_memory_db());

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
fn test_task_editing() {
    let db = Arc::new(setup_in_memory_db());

    let task = Task {
        id: "task-edit-1".to_string(),
        title: "Initial Title".to_string(),
        description: Some("Initial Description".to_string()),
        is_completed: false,
        priority: "low".to_string(),
        due_date: Some("2026-11-20T10:00:00".to_string()),
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };
    Repositories::save_task(&db, &task).expect("save initial task");

    // Edit the task: title, description, priority, due date
    let edited_task = Task {
        id: "task-edit-1".to_string(),
        title: "Updated Title".to_string(),
        description: Some("Updated Description".to_string()),
        is_completed: false,
        priority: "high".to_string(),
        due_date: Some("2026-11-25T15:30:00".to_string()),
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-19T14:00:00Z".to_string(),
    };
    Repositories::save_task(&db, &edited_task).expect("save edited task");

    let loaded = Repositories::get_all_tasks(&db).expect("get tasks");
    assert_eq!(loaded.len(), 1);
    let t = &loaded[0];
    assert_eq!(t.id, "task-edit-1");
    assert_eq!(t.title, "Updated Title");
    assert_eq!(t.description, Some("Updated Description".to_string()));
    assert_eq!(t.priority, "high");
    assert_eq!(t.due_date, Some("2026-11-25T15:30:00".to_string()));
    assert_eq!(t.created_at, "2026-11-18T12:00:00Z");
}

#[test]
fn test_task_due_date_persistence_and_completion() {
    let db = Arc::new(setup_in_memory_db());

    let task = Task {
        id: "task-due-1".to_string(),
        title: "Important Milestone".to_string(),
        description: Some("Detailed checklist".to_string()),
        is_completed: false,
        priority: "high".to_string(),
        due_date: Some("2026-11-21T18:00:00".to_string()),
        created_at: "2026-11-20T10:00:00Z".to_string(),
        updated_at: "2026-11-20T10:00:00Z".to_string(),
    };
    Repositories::save_task(&db, &task).expect("save task");

    // Toggle complete
    let completed = Repositories::toggle_task(&db, "task-due-1").expect("toggle task");
    assert_eq!(completed.is_completed, true);
    // Crucial: completed tasks MUST retain due-date and description info
    assert_eq!(completed.due_date, Some("2026-11-21T18:00:00".to_string()));
    assert_eq!(completed.description, Some("Detailed checklist".to_string()));

    // Verify in db
    let all = Repositories::get_all_tasks(&db).expect("get tasks");
    assert_eq!(all[0].is_completed, true);
    assert_eq!(all[0].due_date, Some("2026-11-21T18:00:00".to_string()));

    // Toggle back to active
    let active = Repositories::toggle_task(&db, "task-due-1").expect("toggle task back");
    assert_eq!(active.is_completed, false);
    assert_eq!(active.due_date, Some("2026-11-21T18:00:00".to_string()));
}

#[test]
fn test_task_sorting_order() {
    let db = Arc::new(setup_in_memory_db());

    // 1. Overdue task (incomplete, due 2026-11-10)
    let t_overdue = Task {
        id: "t-overdue".to_string(),
        title: "Overdue Task".to_string(),
        description: None,
        is_completed: false,
        priority: "low".to_string(),
        due_date: Some("2026-11-10T09:00:00".to_string()),
        created_at: "2026-11-01T10:00:00Z".to_string(),
        updated_at: "2026-11-01T10:00:00Z".to_string(),
    };
    // 2. Today task (incomplete, due 2026-11-21)
    let t_today = Task {
        id: "t-today".to_string(),
        title: "Today Task".to_string(),
        description: None,
        is_completed: false,
        priority: "medium".to_string(),
        due_date: Some("2026-11-21T14:00:00".to_string()),
        created_at: "2026-11-02T10:00:00Z".to_string(),
        updated_at: "2026-11-02T10:00:00Z".to_string(),
    };
    // 3. Tomorrow task (incomplete, due 2026-11-22)
    let t_tomorrow = Task {
        id: "t-tomorrow".to_string(),
        title: "Tomorrow Task".to_string(),
        description: None,
        is_completed: false,
        priority: "high".to_string(),
        due_date: Some("2026-11-22T10:00:00".to_string()),
        created_at: "2026-11-03T10:00:00Z".to_string(),
        updated_at: "2026-11-03T10:00:00Z".to_string(),
    };
    // 4. No due date high priority
    let t_nodue_high = Task {
        id: "t-nodue-high".to_string(),
        title: "No Due High".to_string(),
        description: None,
        is_completed: false,
        priority: "high".to_string(),
        due_date: None,
        created_at: "2026-11-04T10:00:00Z".to_string(),
        updated_at: "2026-11-04T10:00:00Z".to_string(),
    };
    // 5. No due date low priority
    let t_nodue_low = Task {
        id: "t-nodue-low".to_string(),
        title: "No Due Low".to_string(),
        description: None,
        is_completed: false,
        priority: "low".to_string(),
        due_date: None,
        created_at: "2026-11-05T10:00:00Z".to_string(),
        updated_at: "2026-11-05T10:00:00Z".to_string(),
    };
    // 6. Completed task (even with older due date, must be at the bottom)
    let t_completed = Task {
        id: "t-completed".to_string(),
        title: "Completed Task".to_string(),
        description: None,
        is_completed: true,
        priority: "high".to_string(),
        due_date: Some("2026-11-09T08:00:00".to_string()),
        created_at: "2026-11-01T08:00:00Z".to_string(),
        updated_at: "2026-11-20T10:00:00Z".to_string(),
    };

    // Save in arbitrary order
    Repositories::save_task(&db, &t_nodue_low).unwrap();
    Repositories::save_task(&db, &t_completed).unwrap();
    Repositories::save_task(&db, &t_today).unwrap();
    Repositories::save_task(&db, &t_overdue).unwrap();
    Repositories::save_task(&db, &t_nodue_high).unwrap();
    Repositories::save_task(&db, &t_tomorrow).unwrap();

    let sorted = Repositories::get_all_tasks(&db).expect("get sorted tasks");
    assert_eq!(sorted.len(), 6);
    // Order must be: overdue, today, tomorrow, nodue_high, nodue_low, completed
    assert_eq!(sorted[0].id, "t-overdue");
    assert_eq!(sorted[1].id, "t-today");
    assert_eq!(sorted[2].id, "t-tomorrow");
    assert_eq!(sorted[3].id, "t-nodue-high");
    assert_eq!(sorted[4].id, "t-nodue-low");
    assert_eq!(sorted[5].id, "t-completed");
}

#[test]
fn test_task_concurrent_updates() {
    use std::thread;

    let db = Arc::new(setup_in_memory_db());

    let task = Task {
        id: "task-thread-safe".to_string(),
        title: "Thread-Safe Task".to_string(),
        description: Some("Testing concurrent locks".to_string()),
        is_completed: false,
        priority: "medium".to_string(),
        due_date: Some("2026-11-25T12:00:00".to_string()),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    Repositories::save_task(&db, &task).unwrap();

    let mut handles = Vec::new();
    for _ in 0..10 {
        let db_clone = Arc::clone(&db);
        handles.push(thread::spawn(move || {
            Repositories::toggle_task(&db_clone, "task-thread-safe").expect("toggle");
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let all = Repositories::get_all_tasks(&db).unwrap();
    assert_eq!(all.len(), 1);
    // 10 toggles from false -> even number of toggles leaves it false
    assert_eq!(all[0].is_completed, false);
    assert_eq!(all[0].title, "Thread-Safe Task");
    assert_eq!(all[0].due_date, Some("2026-11-25T12:00:00".to_string()));
}

#[test]
fn test_task_restart_recovery_and_migration() {
    let mut conn = rusqlite::Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    // Verify migration 4 was recorded
    let version: i32 = conn
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
        .unwrap();
    assert!(version >= 4);

    let db = Mutex::new(conn);
    let task = Task {
        id: "persisted-task".to_string(),
        title: "Survives Restart".to_string(),
        description: Some("Data is safe".to_string()),
        is_completed: false,
        priority: "high".to_string(),
        due_date: Some("2026-12-01T09:00:00".to_string()),
        created_at: "2026-11-21T10:00:00Z".to_string(),
        updated_at: "2026-11-21T10:00:00Z".to_string(),
    };
    Repositories::save_task(&db, &task).unwrap();

    let loaded = Repositories::get_all_tasks(&db).unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].title, "Survives Restart");
    assert_eq!(loaded[0].due_date, Some("2026-12-01T09:00:00".to_string()));
}

#[test]
fn test_note_crud() {
    let db = Arc::new(setup_in_memory_db());

    let note = Note {
        id: "note-1".to_string(),
        title: "Draft Ideas".to_string(),
        content: "Build DESKIT desktop widget architecture.".to_string(),
        is_pinned: false,
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_note(&db, &note).expect("save note");

    let all_notes = Repositories::get_all_notes(&db).expect("get all notes");
    assert_eq!(all_notes.len(), 1);
    assert_eq!(all_notes[0].content, "Build DESKIT desktop widget architecture.");

    Repositories::delete_note(&db, "note-1").expect("delete note");
    let after_delete = Repositories::get_all_notes(&db).expect("get all notes");
    assert_eq!(after_delete.len(), 0);
}

#[test]
fn test_notes_markdown_persistence() {
    let db = Arc::new(setup_in_memory_db());

    let markdown_body = r#"# Architecture Design
## Subheading
This is a **bold statement** and an *italic note* with `inline code`.
Here is a [reference link](https://github.com/ankit/deskit).

> Blockquote insight

```rust
fn main() {
    println!("Hello DESKIT");
}
```
"#;

    let note = Note {
        id: "note-md".to_string(),
        title: "Markdown Spec".to_string(),
        content: markdown_body.to_string(),
        is_pinned: false,
        created_at: "2026-11-20T10:00:00Z".to_string(),
        updated_at: "2026-11-20T10:00:00Z".to_string(),
    };
    Repositories::save_note(&db, &note).expect("save markdown note");

    let loaded = Repositories::get_all_notes(&db).expect("get notes");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].content, markdown_body);
}

#[test]
fn test_notes_checklist_persistence_and_toggle() {
    let db = Arc::new(setup_in_memory_db());

    let initial_content = "- [ ] Finish documentation\n- [x] Write integration tests\n- [ ] Deploy release";
    let note = Note {
        id: "note-checklists".to_string(),
        title: "Release Checklist".to_string(),
        content: initial_content.to_string(),
        is_pinned: false,
        created_at: "2026-11-21T08:00:00Z".to_string(),
        updated_at: "2026-11-21T08:00:00Z".to_string(),
    };
    Repositories::save_note(&db, &note).expect("save checklist note");

    // Simulate toggling the first item from - [ ] to - [x]
    let mut lines: Vec<&str> = initial_content.lines().collect();
    let updated_first_line = "- [x] Finish documentation";
    lines[0] = updated_first_line;
    let updated_content = lines.join("\n");

    let updated_note = Note {
        id: "note-checklists".to_string(),
        title: "Release Checklist".to_string(),
        content: updated_content.clone(),
        is_pinned: false,
        created_at: "2026-11-21T08:00:00Z".to_string(),
        updated_at: "2026-11-21T08:05:00Z".to_string(),
    };
    Repositories::save_note(&db, &updated_note).expect("save toggled checklist");

    let loaded = Repositories::get_all_notes(&db).expect("get notes");
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].content, "- [x] Finish documentation\n- [x] Write integration tests\n- [ ] Deploy release");
}

#[test]
fn test_notes_pin_ordering() {
    let db = Arc::new(setup_in_memory_db());

    // 1. Note A: unpinned, updated 10:00
    let note_a = Note {
        id: "note-a".to_string(),
        title: "Note A".to_string(),
        content: "Content A".to_string(),
        is_pinned: false,
        created_at: "2026-11-20T10:00:00Z".to_string(),
        updated_at: "2026-11-20T10:00:00Z".to_string(),
    };
    // 2. Note B: pinned, updated 09:00
    let note_b = Note {
        id: "note-b".to_string(),
        title: "Note B".to_string(),
        content: "Content B".to_string(),
        is_pinned: true,
        created_at: "2026-11-20T09:00:00Z".to_string(),
        updated_at: "2026-11-20T09:00:00Z".to_string(),
    };
    // 3. Note C: unpinned, updated 11:00
    let note_c = Note {
        id: "note-c".to_string(),
        title: "Note C".to_string(),
        content: "Content C".to_string(),
        is_pinned: false,
        created_at: "2026-11-20T11:00:00Z".to_string(),
        updated_at: "2026-11-20T11:00:00Z".to_string(),
    };
    // 4. Note D: pinned, updated 12:00
    let note_d = Note {
        id: "note-d".to_string(),
        title: "Note D".to_string(),
        content: "Content D".to_string(),
        is_pinned: true,
        created_at: "2026-11-20T12:00:00Z".to_string(),
        updated_at: "2026-11-20T12:00:00Z".to_string(),
    };

    Repositories::save_note(&db, &note_a).unwrap();
    Repositories::save_note(&db, &note_b).unwrap();
    Repositories::save_note(&db, &note_c).unwrap();
    Repositories::save_note(&db, &note_d).unwrap();

    let all = Repositories::get_all_notes(&db).expect("get notes");
    assert_eq!(all.len(), 4);
    // Pinned notes appear first (sorted by updated_at desc: D then B), then unpinned (C then A)
    assert_eq!(all[0].id, "note-d");
    assert_eq!(all[1].id, "note-b");
    assert_eq!(all[2].id, "note-c");
    assert_eq!(all[3].id, "note-a");

    // Toggle pin on Note C
    let toggled = Repositories::toggle_pin_note(&db, "note-c").expect("toggle pin");
    assert_eq!(toggled.is_pinned, true);

    let after_pin = Repositories::get_all_notes(&db).expect("get notes");
    // Now C is pinned and updated most recently, so it should be at the very top
    assert_eq!(after_pin[0].id, "note-c");
}

#[test]
fn test_notes_search() {
    let db = Arc::new(setup_in_memory_db());

    let n1 = Note {
        id: "n-1".to_string(),
        title: "Rust SQLite Engine".to_string(),
        content: "High performance database queries".to_string(),
        is_pinned: false,
        created_at: "2026-11-21T01:00:00Z".to_string(),
        updated_at: "2026-11-21T01:00:00Z".to_string(),
    };
    let n2 = Note {
        id: "n-2".to_string(),
        title: "Shopping List".to_string(),
        content: "Almond milk, bananas, coffee".to_string(),
        is_pinned: false,
        created_at: "2026-11-21T02:00:00Z".to_string(),
        updated_at: "2026-11-21T02:00:00Z".to_string(),
    };
    let n3 = Note {
        id: "n-3".to_string(),
        title: "Daily Journal".to_string(),
        content: "Implemented Rust thread safety today".to_string(),
        is_pinned: true,
        created_at: "2026-11-21T03:00:00Z".to_string(),
        updated_at: "2026-11-21T03:00:00Z".to_string(),
    };

    Repositories::save_note(&db, &n1).unwrap();
    Repositories::save_note(&db, &n2).unwrap();
    Repositories::save_note(&db, &n3).unwrap();

    // Search by title or content
    let rust_matches = Repositories::search_notes(&db, "Rust").expect("search rust");
    assert_eq!(rust_matches.len(), 2);
    // n3 is pinned, so it appears before n1
    assert_eq!(rust_matches[0].id, "n-3");
    assert_eq!(rust_matches[1].id, "n-1");

    let milk_matches = Repositories::search_notes(&db, "milk").expect("search milk");
    assert_eq!(milk_matches.len(), 1);
    assert_eq!(milk_matches[0].id, "n-2");

    let empty_matches = Repositories::search_notes(&db, "nonexistent_query").expect("search none");
    assert_eq!(empty_matches.len(), 0);
}

#[test]
fn test_notes_concurrent_edits() {
    use std::thread;

    let db = Arc::new(setup_in_memory_db());

    let note = Note {
        id: "concurrent-note".to_string(),
        title: "Concurrent Note".to_string(),
        content: "0".to_string(),
        is_pinned: false,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    Repositories::save_note(&db, &note).unwrap();

    let mut handles = Vec::new();
    for i in 0..10 {
        let db_clone = Arc::clone(&db);
        handles.push(thread::spawn(move || {
            let note_update = Note {
                id: "concurrent-note".to_string(),
                title: format!("Concurrent Note Edit {}", i),
                content: format!("Content iteration {}", i),
                is_pinned: i % 2 == 0,
                created_at: "2026-11-21T00:00:00Z".to_string(),
                updated_at: chrono::Utc::now().to_rfc3339(),
            };
            Repositories::save_note(&db_clone, &note_update).expect("save concurrent note");
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let all = Repositories::get_all_notes(&db).unwrap();
    assert_eq!(all.len(), 1);
    assert!(all[0].title.starts_with("Concurrent Note Edit"));
}

#[test]
fn test_notes_restart_recovery_and_migration() {
    let mut conn = rusqlite::Connection::open_in_memory().unwrap();
    run_migrations(&mut conn).unwrap();

    // Verify migration 5 was recorded
    let version: i32 = conn
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| row.get(0))
        .unwrap();
    assert!(version >= 5);

    let db = Mutex::new(conn);
    let note = Note {
        id: "persisted-pinned-note".to_string(),
        title: "Important Notice".to_string(),
        content: "Must survive restarts".to_string(),
        is_pinned: true,
        created_at: "2026-11-21T10:00:00Z".to_string(),
        updated_at: "2026-11-21T10:00:00Z".to_string(),
    };
    Repositories::save_note(&db, &note).unwrap();

    let loaded = Repositories::get_all_notes(&db).unwrap();
    assert_eq!(loaded.len(), 1);
    assert_eq!(loaded[0].is_pinned, true);
    assert_eq!(loaded[0].title, "Important Notice");
}

#[test]
fn test_focus_session() {
    let db = Arc::new(setup_in_memory_db());

    // First call initializes default
    let default_session = Repositories::get_focus_session(&db).expect("get default session");
    assert_eq!(default_session.duration_minutes, 25);
    assert_eq!(default_session.break_minutes, 5);
    assert_eq!(default_session.remaining_seconds, 1500);

    let updated_session = FocusSession {
        id: "default".to_string(),
        duration_minutes: 30,
        break_minutes: 10,
        state: "paused".to_string(),
        remaining_seconds: 1200,
        is_running: false,
        updated_at: "2026-11-18T12:30:00Z".to_string(),
        ends_at: None,
    };

    Repositories::save_focus_session(&db, &updated_session).expect("save focus session");

    let loaded = Repositories::get_focus_session(&db).expect("get updated session");
    assert_eq!(loaded.duration_minutes, 30);
    assert_eq!(loaded.remaining_seconds, 1200);
    assert_eq!(loaded.is_running, false);
}

// ---------------- PRODUCTION-READY FOCUS ENGINE TESTS ----------------

#[test]
fn test_focus_engine_start() {
    let mut session = FocusSession::new_default();
    let now = chrono::Utc::now();

    session.start(now);
    assert!(session.is_running);
    assert_eq!(session.state, "focus");
    assert_eq!(session.remaining_seconds, 1500);
    assert!(session.ends_at.is_some());

    let ends = chrono::DateTime::parse_from_rfc3339(session.ends_at.as_ref().unwrap()).unwrap();
    let diff = (ends.with_timezone(&chrono::Utc) - now).num_seconds();
    assert_eq!(diff, 1500);
}

#[test]
fn test_focus_engine_pause_and_resume() {
    let mut session = FocusSession::new_default();
    let t0 = chrono::Utc::now();

    session.start(t0);
    assert!(session.is_running);

    // Advance 500s and pause
    let t1 = t0 + chrono::Duration::seconds(500);
    session.pause(t1);

    assert!(!session.is_running);
    assert_eq!(session.state, "paused");
    assert_eq!(session.remaining_seconds, 1000);
    assert!(session.ends_at.is_none());

    // Advance 200s in paused state, then resume
    let t2 = t1 + chrono::Duration::seconds(200);
    session.start(t2);

    assert!(session.is_running);
    assert_eq!(session.state, "focus");
    assert_eq!(session.remaining_seconds, 1000);
    assert!(session.ends_at.is_some());

    let ends = chrono::DateTime::parse_from_rfc3339(session.ends_at.as_ref().unwrap()).unwrap();
    let diff = (ends.with_timezone(&chrono::Utc) - t2).num_seconds();
    assert_eq!(diff, 1000);
}

#[test]
fn test_focus_engine_reset() {
    let mut session = FocusSession::new_default();
    let t0 = chrono::Utc::now();

    session.start(t0);
    assert!(session.is_running);

    let t1 = t0 + chrono::Duration::seconds(300);
    session.reset(t1);

    assert!(!session.is_running);
    assert_eq!(session.state, "idle");
    assert_eq!(session.remaining_seconds, 1500);
    assert!(session.ends_at.is_none());
}

#[test]
fn test_focus_engine_add_five_minutes() {
    let mut session = FocusSession::new_default();
    let t0 = chrono::Utc::now();

    session.start(t0);
    // 500s elapsed (1000s left)
    let t1 = t0 + chrono::Duration::seconds(500);
    session.add_minutes(5, t1);

    assert!(session.is_running);
    assert_eq!(session.remaining_seconds, 1300); // 1000 + 300

    let ends = chrono::DateTime::parse_from_rfc3339(session.ends_at.as_ref().unwrap()).unwrap();
    let diff = (ends.with_timezone(&chrono::Utc) - t1).num_seconds();
    assert_eq!(diff, 1300);

    // Test adding minutes while paused
    session.pause(t1);
    assert_eq!(session.remaining_seconds, 1300);
    session.add_minutes(5, t1);
    assert_eq!(session.remaining_seconds, 1600);
    assert!(!session.is_running);
    assert!(session.ends_at.is_none());
}

#[test]
fn test_focus_engine_focus_to_break_completion() {
    use deskit_lib::models::focus::FocusTransition;

    let mut session = FocusSession::new_default();
    let t0 = chrono::Utc::now();

    session.start(t0);

    // Reconcile before completion
    let t_mid = t0 + chrono::Duration::seconds(1000);
    let trans_mid = session.reconcile(t_mid);
    assert_eq!(trans_mid, FocusTransition::None);
    assert_eq!(session.remaining_seconds, 500);
    assert!(session.is_running);

    // Reconcile at exact completion
    let t_done = t0 + chrono::Duration::seconds(1500);
    let trans_done = session.reconcile(t_done);
    assert_eq!(trans_done, FocusTransition::CompletedFocus);
    assert_eq!(session.state, "break");
    assert_eq!(session.remaining_seconds, 300); // 5 min break
    assert!(!session.is_running);
    assert!(session.ends_at.is_none());

    // Start break session
    session.start(t_done);
    assert!(session.is_running);
    assert_eq!(session.state, "break");
    assert_eq!(session.remaining_seconds, 300);

    // Break finishes 300s later
    let t_break_done = t_done + chrono::Duration::seconds(300);
    let trans_break = session.reconcile(t_break_done);
    assert_eq!(trans_break, FocusTransition::CompletedBreak);
    assert_eq!(session.state, "idle");
    assert_eq!(session.remaining_seconds, 1500);
    assert!(!session.is_running);
}

#[test]
fn test_focus_engine_restart_recovery() {
    let db = Arc::new(setup_in_memory_db());
    let t0 = chrono::Utc::now();

    let mut session = FocusSession::new_default();
    session.start(t0);
    Repositories::save_focus_session(&db, &session).expect("save running session");

    // Simulate process terminating and app starting at t0 + 400s
    let t1 = t0 + chrono::Duration::seconds(400);
    let (recovered, trans) = Repositories::reconcile_focus_session(&db, t1).expect("reconcile");

    assert_eq!(trans, deskit_lib::models::focus::FocusTransition::None);
    assert!(recovered.is_running);
    assert_eq!(recovered.state, "focus");
    assert_eq!(recovered.remaining_seconds, 1100);
}

#[test]
fn test_focus_engine_sleep_wake_recovery() {
    let db = Arc::new(setup_in_memory_db());
    let t0 = chrono::Utc::now();

    let mut session = FocusSession::new_default();
    session.start(t0);
    Repositories::save_focus_session(&db, &session).expect("save running session");

    // Machine slept for 2 hours (7200s), wakes up way past 1500s deadline
    let t_wake = t0 + chrono::Duration::seconds(7200);
    let (recovered, trans) = Repositories::reconcile_focus_session(&db, t_wake).expect("reconcile");

    assert_eq!(trans, deskit_lib::models::focus::FocusTransition::CompletedFocus);
    assert!(!recovered.is_running);
    assert_eq!(recovered.state, "break");
    assert_eq!(recovered.remaining_seconds, 300);
    assert!(recovered.ends_at.is_none());
}

#[test]
fn test_focus_engine_duplicate_completion_prevention() {
    use deskit_lib::models::focus::FocusTransition;

    let mut session = FocusSession::new_default();
    let t0 = chrono::Utc::now();

    session.start(t0);

    let t_after = t0 + chrono::Duration::seconds(1550);
    let trans1 = session.reconcile(t_after);
    assert_eq!(trans1, FocusTransition::CompletedFocus);

    // Consecutive calls at future times must not re-trigger completion
    let trans2 = session.reconcile(t_after + chrono::Duration::seconds(10));
    assert_eq!(trans2, FocusTransition::None);

    let trans3 = session.reconcile(t_after + chrono::Duration::seconds(100));
    assert_eq!(trans3, FocusTransition::None);
}

#[test]
fn test_focus_engine_concurrent_state_change() {
    use std::sync::Arc;
    use std::thread;

    let db = Arc::new(setup_in_memory_db());
    let mut handles = vec![];

    for i in 0..10 {
        let db_clone = Arc::clone(&db);
        handles.push(thread::spawn(move || {
            let t = chrono::Utc::now() + chrono::Duration::seconds(i * 10);
            let mut session = Repositories::get_focus_session(&db_clone).expect("get");
            if i % 3 == 0 {
                session.start(t);
            } else if i % 3 == 1 {
                session.pause(t);
            } else {
                session.add_minutes(1, t);
            }
            Repositories::save_focus_session(&db_clone, &session).expect("save");
        }));
    }

    for h in handles {
        h.join().expect("thread join");
    }

    let final_session = Repositories::get_focus_session(&db).expect("final get");
    assert!(final_session.remaining_seconds >= 0);
}

#[test]
fn test_focus_engine_persistence_correctness() {
    let db = Arc::new(setup_in_memory_db());
    let now = chrono::Utc::now();

    let custom = FocusSession {
        id: "default".to_string(),
        duration_minutes: 50,
        break_minutes: 15,
        state: "focus".to_string(),
        remaining_seconds: 2800,
        is_running: true,
        updated_at: now.to_rfc3339(),
        ends_at: Some((now + chrono::Duration::seconds(2800)).to_rfc3339()),
    };

    Repositories::save_focus_session(&db, &custom).expect("save custom session");

    let loaded = Repositories::get_focus_session(&db).expect("load session");
    assert_eq!(loaded.duration_minutes, 50);
    assert_eq!(loaded.break_minutes, 15);
    assert_eq!(loaded.state, "focus");
    assert!(loaded.is_running);
    assert!(loaded.ends_at.is_some());
}

#[test]
fn test_deadlines_crud() {
    let db = Arc::new(setup_in_memory_db());

    let dl = Deadline {
        id: "dl-1".to_string(),
        title: "Phase 1 Review".to_string(),
        due_date: "2026-11-18T18:00:00Z".to_string(),
        category: "Milestone".to_string(),
        is_completed: false,
        notify_lead_minutes: 15,
        notified_lead: false,
        notified_due: false,
        created_at: "2026-11-18T12:00:00Z".to_string(),
        updated_at: "2026-11-18T12:00:00Z".to_string(),
    };

    Repositories::save_deadline(&db, &dl).expect("save deadline");
    let all = Repositories::get_all_deadlines(&db).expect("get deadlines");
    assert_eq!(all.len(), 1);
    assert_eq!(all[0].title, "Phase 1 Review");
    assert_eq!(all[0].notify_lead_minutes, 15);
    assert!(!all[0].notified_lead);
    assert!(!all[0].notified_due);

    let retrieved = Repositories::get_deadline_by_id(&db, "dl-1").expect("get by id");
    assert!(retrieved.is_some());
    assert_eq!(retrieved.unwrap().id, "dl-1");

    Repositories::delete_deadline(&db, "dl-1").expect("delete deadline");
    assert_eq!(Repositories::get_all_deadlines(&db).unwrap().len(), 0);
}

#[test]
fn test_deadlines_notification_scheduling_and_lead_time() {
    let db = Arc::new(setup_in_memory_db());

    let now_utc = chrono::Utc::now();
    let due_utc = now_utc + chrono::Duration::minutes(30);

    let dl = Deadline {
        id: "dl-sched-1".to_string(),
        title: "Sprint Review".to_string(),
        due_date: due_utc.to_rfc3339(),
        category: "Work".to_string(),
        is_completed: false,
        notify_lead_minutes: 15,
        notified_lead: false,
        notified_due: false,
        created_at: now_utc.to_rfc3339(),
        updated_at: now_utc.to_rfc3339(),
    };

    Repositories::save_deadline(&db, &dl).expect("save deadline");

    // 1. Check at now (30 min before due): outside 15 min lead window
    let triggered_now = Repositories::reconcile_deadlines_notifications(&db, now_utc).expect("reconcile now");
    assert!(triggered_now.is_empty(), "Should not notify 30 mins before when lead is 15 mins");

    // 2. Check at 14 mins before due: inside lead window
    let t_approaching = due_utc - chrono::Duration::minutes(14);
    let triggered_approaching = Repositories::reconcile_deadlines_notifications(&db, t_approaching).expect("reconcile approaching");
    assert_eq!(triggered_approaching.len(), 1);
    assert_eq!(triggered_approaching[0].1, DeadlineNotificationKind::Approaching);
    assert_eq!(triggered_approaching[0].0.id, "dl-sched-1");

    // Verify row was updated in SQLite
    let updated_dl = Repositories::get_deadline_by_id(&db, "dl-sched-1").unwrap().unwrap();
    assert!(updated_dl.notified_lead);
    assert!(!updated_dl.notified_due);

    // 3. Repeated poll inside lead window: must not duplicate
    let t_approaching_again = due_utc - chrono::Duration::minutes(10);
    let triggered_repeat = Repositories::reconcile_deadlines_notifications(&db, t_approaching_again).expect("reconcile repeat");
    assert!(triggered_repeat.is_empty(), "Must not send duplicate approaching notification");

    // 4. Check at due time: triggers Due notification
    let triggered_due = Repositories::reconcile_deadlines_notifications(&db, due_utc).expect("reconcile due");
    assert_eq!(triggered_due.len(), 1);
    assert_eq!(triggered_due[0].1, DeadlineNotificationKind::Due);

    // Verify both notified_lead and notified_due are now true in SQLite
    let due_saved = Repositories::get_deadline_by_id(&db, "dl-sched-1").unwrap().unwrap();
    assert!(due_saved.notified_lead);
    assert!(due_saved.notified_due);

    // 5. Subsequent poll after due time: must not duplicate
    let t_after = due_utc + chrono::Duration::minutes(5);
    let triggered_after = Repositories::reconcile_deadlines_notifications(&db, t_after).expect("reconcile after");
    assert!(triggered_after.is_empty(), "Must not send duplicate due notification");
}

#[test]
fn test_deadlines_duplicate_notification_prevention() {
    let db = Arc::new(setup_in_memory_db());
    let now_utc = chrono::Utc::now();

    let dl = Deadline {
        id: "dl-dup-1".to_string(),
        title: "Immediate Due".to_string(),
        due_date: now_utc.to_rfc3339(),
        category: "General".to_string(),
        is_completed: false,
        notify_lead_minutes: 0,
        notified_lead: false,
        notified_due: false,
        created_at: now_utc.to_rfc3339(),
        updated_at: now_utc.to_rfc3339(),
    };

    Repositories::save_deadline(&db, &dl).expect("save");

    // Call reconcile 5 times in a row
    let first = Repositories::reconcile_deadlines_notifications(&db, now_utc).unwrap();
    assert_eq!(first.len(), 1);

    for _ in 0..4 {
        let subsequent = Repositories::reconcile_deadlines_notifications(&db, now_utc).unwrap();
        assert!(subsequent.is_empty(), "Subsequent rapid polls must return empty");
    }
}

#[test]
fn test_deadlines_missed_and_overdue_reconciliation() {
    let db = Arc::new(setup_in_memory_db());
    let now_utc = chrono::Utc::now();

    // Deadline was due 3 hours ago (app was closed/sleeping)
    let past_due = now_utc - chrono::Duration::hours(3);

    let dl = Deadline {
        id: "dl-missed-1".to_string(),
        title: "Missed Project Submission".to_string(),
        due_date: past_due.to_rfc3339(),
        category: "Urgent".to_string(),
        is_completed: false,
        notify_lead_minutes: 15,
        notified_lead: false,
        notified_due: false,
        created_at: past_due.to_rfc3339(),
        updated_at: past_due.to_rfc3339(),
    };

    Repositories::save_deadline(&db, &dl).expect("save");

    // App launches and reconciles
    let triggered = Repositories::reconcile_deadlines_notifications(&db, now_utc).unwrap();
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0].1, DeadlineNotificationKind::Missed);
    assert_eq!(triggered[0].0.id, "dl-missed-1");

    // Database is updated so it never notifies again
    let saved = Repositories::get_deadline_by_id(&db, "dl-missed-1").unwrap().unwrap();
    assert!(saved.notified_lead);
    assert!(saved.notified_due);

    let next_check = Repositories::reconcile_deadlines_notifications(&db, now_utc + chrono::Duration::seconds(10)).unwrap();
    assert!(next_check.is_empty());
}

#[test]
fn test_deadlines_completed_and_deleted_suppression() {
    let db = Arc::new(setup_in_memory_db());
    let now_utc = chrono::Utc::now();

    let dl1 = Deadline {
        id: "dl-comp-1".to_string(),
        title: "Completed Task".to_string(),
        due_date: now_utc.to_rfc3339(),
        category: "General".to_string(),
        is_completed: true, // Marked completed!
        notify_lead_minutes: 15,
        notified_lead: false,
        notified_due: false,
        created_at: now_utc.to_rfc3339(),
        updated_at: now_utc.to_rfc3339(),
    };

    Repositories::save_deadline(&db, &dl1).expect("save");

    // Even though due time has arrived, completed deadline must NOT trigger notification
    let triggered = Repositories::reconcile_deadlines_notifications(&db, now_utc).unwrap();
    assert!(triggered.is_empty(), "Completed deadline must not trigger notifications");

    // Now test deleted deadline
    let dl2 = Deadline {
        id: "dl-del-1".to_string(),
        title: "To Be Deleted".to_string(),
        due_date: now_utc.to_rfc3339(),
        category: "General".to_string(),
        is_completed: false,
        notify_lead_minutes: 0,
        notified_lead: false,
        notified_due: false,
        created_at: now_utc.to_rfc3339(),
        updated_at: now_utc.to_rfc3339(),
    };
    Repositories::save_deadline(&db, &dl2).expect("save dl2");
    Repositories::delete_deadline(&db, "dl-del-1").expect("delete dl2");

    let triggered_del = Repositories::reconcile_deadlines_notifications(&db, now_utc).unwrap();
    assert!(triggered_del.is_empty(), "Deleted deadline must not trigger notifications");
}

#[test]
fn test_deadlines_due_date_edit_resets_notifications() {
    let db = Arc::new(setup_in_memory_db());
    let now_utc = chrono::Utc::now();

    // Already notified deadline
    let mut dl = Deadline {
        id: "dl-edit-1".to_string(),
        title: "Rescheduled Meeting".to_string(),
        due_date: (now_utc - chrono::Duration::minutes(5)).to_rfc3339(),
        category: "Work".to_string(),
        is_completed: false,
        notify_lead_minutes: 15,
        notified_lead: true,
        notified_due: true,
        created_at: now_utc.to_rfc3339(),
        updated_at: now_utc.to_rfc3339(),
    };

    Repositories::save_deadline(&db, &dl).expect("save");

    // User reschedules due_date to 2 hours in the future
    let new_due = now_utc + chrono::Duration::hours(2);
    dl.due_date = new_due.to_rfc3339();

    Repositories::save_deadline(&db, &dl).expect("save rescheduled");

    // Verify notifications were automatically re-armed in SQLite!
    let reloaded = Repositories::get_deadline_by_id(&db, "dl-edit-1").unwrap().unwrap();
    assert!(!reloaded.notified_due, "Rescheduling into future must reset notified_due");
    assert!(!reloaded.notified_lead, "Rescheduling into future must reset notified_lead");

    // Advance to 10 minutes before new due date
    let t_new_lead = new_due - chrono::Duration::minutes(10);
    let triggered = Repositories::reconcile_deadlines_notifications(&db, t_new_lead).unwrap();
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0].1, DeadlineNotificationKind::Approaching);
}

#[test]
fn test_deadlines_concurrent_updates() {
    let db = Arc::new(setup_in_memory_db());

    let mut handles = Vec::new();
    for i in 0..10 {
        let db_clone = Arc::clone(&db);
        let handle = std::thread::spawn(move || {
            let dl = Deadline {
                id: format!("dl-concurrent-{i}"),
                title: format!("Concurrent Task {i}"),
                due_date: format!("2026-11-22T{i:02}:00:00Z"),
                category: "Concurrent".to_string(),
                is_completed: i % 2 == 0,
                notify_lead_minutes: 15,
                notified_lead: false,
                notified_due: false,
                created_at: "2026-11-21T00:00:00Z".to_string(),
                updated_at: "2026-11-21T00:00:00Z".to_string(),
            };
            Repositories::save_deadline(&db_clone, &dl).expect("save concurrent");
            let _ = Repositories::get_all_deadlines(&db_clone).expect("query concurrent");
        });
        handles.push(handle);
    }

    for h in handles {
        h.join().expect("thread join");
    }

    let all = Repositories::get_all_deadlines(&db).expect("all deadlines");
    assert_eq!(all.len(), 10);
}


#[test]
fn test_goals_crud() {
    let db = Arc::new(setup_in_memory_db());

    let today_str = chrono::Local::now().format("%Y-%m-%d").to_string();
    let goal = DailyGoal {
        id: "goal-1".to_string(),
        title: "Review PRs".to_string(),
        target_count: 5,
        current_count: 3,
        is_completed: false,
        date_str: today_str,
        current_streak: 0,
        longest_streak: 0,
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
fn test_goals_midnight_rollover() {
    let db = Arc::new(setup_in_memory_db());

    let goal = DailyGoal {
        id: "g-rollover".to_string(),
        title: "Workout".to_string(),
        target_count: 1,
        current_count: 1,
        is_completed: true,
        date_str: "2026-11-18".to_string(),
        current_streak: 1,
        longest_streak: 1,
        created_at: "2026-11-18T08:00:00Z".to_string(),
        updated_at: "2026-11-18T08:00:00Z".to_string(),
    };
    Repositories::save_goal(&db, &goal).expect("save initial goal");

    // Reconcile on new calendar day (midnight rollover)
    let goals_next_day = Repositories::reconcile_daily_goals(&db, "2026-11-19").expect("reconcile");
    assert_eq!(goals_next_day.len(), 1);
    let g = &goals_next_day[0];
    assert_eq!(g.date_str, "2026-11-19");
    assert_eq!(g.current_count, 0);
    assert_eq!(g.is_completed, false);
    // Yesterday was completed, so today's pending streak is 1
    assert_eq!(g.current_streak, 1);
    assert_eq!(g.longest_streak, 1);

    // Verify history preserved snapshot of yesterday
    let history = Repositories::get_goal_history(&db, "g-rollover").expect("get history");
    assert_eq!(history.len(), 1);
    assert_eq!(history[0].date_str, "2026-11-18");
    assert_eq!(history[0].current_count, 1);
    assert_eq!(history[0].is_completed, true);
}

#[test]
fn test_goals_missed_days() {
    let db = Arc::new(setup_in_memory_db());

    // Day 1: 2026-11-10 (completed)
    let goal = DailyGoal {
        id: "g-missed".to_string(),
        title: "Read 10 pages".to_string(),
        target_count: 1,
        current_count: 1,
        is_completed: true,
        date_str: "2026-11-10".to_string(),
        current_streak: 1,
        longest_streak: 1,
        created_at: "2026-11-10T10:00:00Z".to_string(),
        updated_at: "2026-11-10T10:00:00Z".to_string(),
    };
    Repositories::save_goal(&db, &goal).expect("save day 1");

    // Rollover to Day 2: 2026-11-11
    let mut g2 = Repositories::reconcile_daily_goals(&db, "2026-11-11").unwrap();
    // Complete Day 2
    g2[0].current_count = 1;
    g2[0].is_completed = true;
    Repositories::save_goal(&db, &g2[0]).unwrap();

    // Rollover to Day 3: 2026-11-12 (not completed, 0 count)
    let _ = Repositories::reconcile_daily_goals(&db, "2026-11-12").unwrap();

    // Skip ahead: user opens app on Day 5: 2026-11-14
    let g5 = Repositories::reconcile_daily_goals(&db, "2026-11-14").unwrap();
    assert_eq!(g5[0].date_str, "2026-11-14");
    assert_eq!(g5[0].current_count, 0);
    // Yesterday (2026-11-13) was not completed, so current streak broken to 0
    assert_eq!(g5[0].current_streak, 0);
    // Longest streak was 2 days (2026-11-10 and 2026-11-11)
    assert_eq!(g5[0].longest_streak, 2);
}

#[test]
fn test_goals_restart_recovery() {
    let db = Arc::new(setup_in_memory_db());

    // App closed on 2026-11-01 with 5/5 completed
    let goal = DailyGoal {
        id: "g-recovery".to_string(),
        title: "Meditate".to_string(),
        target_count: 5,
        current_count: 5,
        is_completed: true,
        date_str: "2026-11-01".to_string(),
        current_streak: 1,
        longest_streak: 1,
        created_at: "2026-11-01T08:00:00Z".to_string(),
        updated_at: "2026-11-01T08:00:00Z".to_string(),
    };
    Repositories::save_goal(&db, &goal).expect("save closed state");

    // App restarts 4 days later on 2026-11-05
    let goals = Repositories::reconcile_daily_goals(&db, "2026-11-05").expect("restart reconcile");
    assert_eq!(goals[0].date_str, "2026-11-05");
    assert_eq!(goals[0].current_count, 0);
    assert_eq!(goals[0].is_completed, false);
    assert_eq!(goals[0].longest_streak, 1);

    // History record for 2026-11-01 intact
    let hist = Repositories::get_goal_history(&db, "g-recovery").unwrap();
    assert_eq!(hist.len(), 1);
    assert_eq!(hist[0].date_str, "2026-11-01");
    assert_eq!(hist[0].is_completed, true);
}

#[test]
fn test_goals_streak_calculation() {
    use chrono::NaiveDate;
    use std::collections::BTreeSet;

    let d = |s: &str| NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap();

    let mut completed = BTreeSet::new();
    let today = d("2026-11-20");

    // 1. Empty history, today not completed -> 0, 0
    assert_eq!(DailyGoal::compute_streaks(&completed, today, false), (0, 0));

    // 2. Empty history, today completed -> 1, 1
    assert_eq!(DailyGoal::compute_streaks(&completed, today, true), (1, 1));

    // 3. Yesterday completed, today not completed -> 1, 1
    completed.insert(d("2026-11-19"));
    assert_eq!(DailyGoal::compute_streaks(&completed, today, false), (1, 1));

    // 4. Yesterday completed, today completed -> 2, 2
    assert_eq!(DailyGoal::compute_streaks(&completed, today, true), (2, 2));

    // 5. Gap: 2026-11-17 completed, 2026-11-18 completed, 2026-11-19 MISSED
    let mut gap_set = BTreeSet::new();
    gap_set.insert(d("2026-11-17"));
    gap_set.insert(d("2026-11-18"));
    // Today not completed -> current streak 0, longest streak 2
    assert_eq!(DailyGoal::compute_streaks(&gap_set, today, false), (0, 2));
    // Today completed -> current streak restarts at 1, longest streak 2
    assert_eq!(DailyGoal::compute_streaks(&gap_set, today, true), (1, 2));

    // 6. 5 consecutive days completed
    let mut consecutive = BTreeSet::new();
    consecutive.insert(d("2026-11-15"));
    consecutive.insert(d("2026-11-16"));
    consecutive.insert(d("2026-11-17"));
    consecutive.insert(d("2026-11-18"));
    consecutive.insert(d("2026-11-19"));
    assert_eq!(DailyGoal::compute_streaks(&consecutive, today, true), (6, 6));
}

#[test]
fn test_goals_duplicate_reset_idempotency() {
    let db = Arc::new(setup_in_memory_db());

    let goal = DailyGoal {
        id: "g-idempotent".to_string(),
        title: "Drink Water".to_string(),
        target_count: 8,
        current_count: 8,
        is_completed: true,
        date_str: "2026-11-18".to_string(),
        current_streak: 1,
        longest_streak: 1,
        created_at: "2026-11-18T06:00:00Z".to_string(),
        updated_at: "2026-11-18T06:00:00Z".to_string(),
    };
    Repositories::save_goal(&db, &goal).unwrap();

    // Reconcile 5 times on 2026-11-19
    for _ in 0..5 {
        let g = Repositories::reconcile_daily_goals(&db, "2026-11-19").unwrap();
        assert_eq!(g[0].date_str, "2026-11-19");
        assert_eq!(g[0].current_count, 0);
    }

    // Ensure exactly 1 history row exists for 2026-11-18
    let hist = Repositories::get_goal_history(&db, "g-idempotent").unwrap();
    assert_eq!(hist.len(), 1);
    assert_eq!(hist[0].date_str, "2026-11-18");
    assert_eq!(hist[0].current_count, 8);
}

#[test]
fn test_goals_concurrent_updates() {
    use std::sync::Arc;
    use std::thread;

    let db = Arc::new(setup_in_memory_db());

    let goal = DailyGoal {
        id: "g-conc".to_string(),
        title: "Pushups".to_string(),
        target_count: 50,
        current_count: 0,
        is_completed: false,
        date_str: chrono::Local::now().format("%Y-%m-%d").to_string(),
        current_streak: 0,
        longest_streak: 0,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    Repositories::save_goal(&db, &goal).unwrap();

    let mut handles = Vec::new();
    for _ in 0..10 {
        let db_clone = Arc::clone(&db);
        handles.push(thread::spawn(move || {
            Repositories::increment_goal(&db_clone, "g-conc").expect("increment");
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let all = Repositories::get_all_goals(&db).unwrap();
    let updated = all.iter().find(|g| g.id == "g-conc").unwrap();
    assert_eq!(updated.current_count, 10);
}

#[test]
fn test_app_settings() {
    let db = Arc::new(setup_in_memory_db());

    // Default settings check: launch_at_login is true by default so pinned widgets survive reboots
    let default_settings = Repositories::get_app_settings(&db).expect("get default settings");
    assert_eq!(default_settings.launch_at_login, true);
    assert_eq!(default_settings.close_to_tray, true);
    assert_eq!(default_settings.time_format_24h, false);

    let modified_settings = AppSettings {
        launch_at_login: false,
        close_to_tray: false,
        time_format_24h: true,
        show_seconds: false,
        default_visibility_mode: "always_on_top".to_string(),
        theme: "dark".to_string(),
    };

    Repositories::save_app_settings(&db, &modified_settings).expect("save settings");
    let loaded = Repositories::get_app_settings(&db).expect("get modified settings");
    assert_eq!(loaded.launch_at_login, false);
    assert_eq!(loaded.close_to_tray, false);
    assert_eq!(loaded.time_format_24h, true);
    assert_eq!(loaded.show_seconds, false);
}

#[test]
fn test_workspace_crud_and_persistence() {
    let db = Arc::new(setup_in_memory_db());

    // Verify seeded workspaces exist from Migration 7
    let all = Repositories::get_all_workspaces(&db).expect("get all workspaces");
    assert!(all.len() >= 4, "Should have default, study, developer, and minimal workspaces");
    let default_ws = all.iter().find(|w| w.id == "default").expect("default workspace exists");
    assert!(default_ws.is_active, "default workspace should be initially active");

    // Create a new custom workspace with widgets
    let custom = Workspace {
        id: "ws-custom-1".to_string(),
        name: "Sprint Workspace".to_string(),
        description: "Custom sprint layout".to_string(),
        is_active: false,
        widgets: vec![
            WorkspaceWidgetLayout {
                widget_id: "widget-clock".to_string(),
                widget_type: WidgetType::Clock,
                title: "Sprint Clock".to_string(),
                x: 120.0,
                y: 140.0,
                width: 260.0,
                height: 140.0,
                is_pinned: true,
                visibility_mode: VisibilityMode::AlwaysOnTop,
                is_collapsed: false,
                lock_position: false,
                config_json: "{}".to_string(),
            },
            WorkspaceWidgetLayout {
                widget_id: "widget-tasks".to_string(),
                widget_type: WidgetType::Tasks,
                title: "Sprint Tasks".to_string(),
                x: 420.0,
                y: 140.0,
                width: 320.0,
                height: 420.0,
                is_pinned: true,
                visibility_mode: VisibilityMode::AlwaysOnTop,
                is_collapsed: false,
                lock_position: true,
                config_json: "{}".to_string(),
            },
        ],
        created_at: "2026-11-21T10:00:00Z".to_string(),
        updated_at: "2026-11-21T10:00:00Z".to_string(),
    };

    let saved = Repositories::save_workspace(&db, &custom).expect("save workspace");
    assert_eq!(saved.id, "ws-custom-1");
    assert_eq!(saved.widgets.len(), 2);

    // Fetch by ID
    let fetched = Repositories::get_workspace_by_id(&db, "ws-custom-1")
        .expect("get workspace")
        .expect("should exist");
    assert_eq!(fetched.name, "Sprint Workspace");
    assert_eq!(fetched.widgets.len(), 2);
    let task_layout = fetched.widgets.iter().find(|w| w.widget_id == "widget-tasks").unwrap();
    assert_eq!(task_layout.x, 420.0);
    assert_eq!(task_layout.lock_position, true);

    // Try deleting active workspace: should fail safely
    let err = Repositories::delete_workspace(&db, "default");
    assert!(err.is_err(), "Cannot delete the active workspace");

    // Delete custom workspace: should succeed
    Repositories::delete_workspace(&db, "ws-custom-1").expect("delete workspace");
    let after_delete = Repositories::get_workspace_by_id(&db, "ws-custom-1").expect("get workspace");
    assert!(after_delete.is_none(), "Workspace should be removed");
}

#[test]
fn test_workspace_widget_layout_persistence() {
    let db = Arc::new(setup_in_memory_db());

    // Update geometry of clock inside study workspace
    Repositories::update_workspace_widget_geometry(&db, "study", "study-clock", 250.0, 350.0, 280.0, 160.0)
        .expect("update geometry");

    let ws = Repositories::get_workspace_by_id(&db, "study").unwrap().unwrap();
    let clock_layout = ws.widgets.iter().find(|w| w.widget_id == "study-clock").unwrap();
    assert_eq!(clock_layout.x, 250.0);
    assert_eq!(clock_layout.y, 350.0);
    assert_eq!(clock_layout.width, 280.0);
    assert_eq!(clock_layout.height, 160.0);

    // Update position only (e.g. collapsed pill movement)
    Repositories::update_workspace_widget_position(&db, "study", "study-clock", 500.0, 600.0)
        .expect("update position");

    let ws2 = Repositories::get_workspace_by_id(&db, "study").unwrap().unwrap();
    let clock_layout2 = ws2.widgets.iter().find(|w| w.widget_id == "study-clock").unwrap();
    assert_eq!(clock_layout2.x, 500.0);
    assert_eq!(clock_layout2.y, 600.0);
    // Width and height preserved
    assert_eq!(clock_layout2.width, 280.0);
    assert_eq!(clock_layout2.height, 160.0);
}

#[test]
fn test_workspace_startup_session_recovery() {
    let db = Arc::new(setup_in_memory_db());

    // Switch active workspace to study
    Repositories::set_active_workspace(&db, "study").expect("set active workspace");

    // Verify study is the active workspace
    let active = Repositories::get_active_workspace(&db).expect("get active");
    assert_eq!(active.id, "study");
    assert_eq!(active.is_active, true);
    assert!(active.widgets.len() >= 4, "Study workspace should have clock, tasks, focus, goals");

    // All other workspaces must have is_active = false
    let all = Repositories::get_all_workspaces(&db).unwrap();
    for ws in all {
        if ws.id == "study" {
            assert!(ws.is_active);
        } else {
            assert!(!ws.is_active, "Workspace {} should not be active", ws.id);
        }
    }
}

#[test]
fn test_workspace_rapid_switching_and_idempotency() {
    let db = Arc::new(setup_in_memory_db());

    // Switch rapidly across all presets
    let sequence = vec!["study", "developer", "minimal", "default", "study", "minimal"];
    for target in sequence {
        Repositories::set_active_workspace(&db, target).expect("switch workspace");
        let active = Repositories::get_active_workspace(&db).unwrap();
        assert_eq!(active.id, target);
    }

    // Ensure database remains in an exact 1-active state
    let count: i64 = db.lock().unwrap()
        .query_row("SELECT COUNT(*) FROM workspaces WHERE is_active = 1", [], |r| r.get(0))
        .unwrap();
    assert_eq!(count, 1, "Exactly one workspace must be active");
}

#[test]
fn test_workspace_duplicate_window_prevention() {
    let db = Arc::new(setup_in_memory_db());

    // Check widget instances table and workspace widgets table
    let study = Repositories::get_workspace_by_id(&db, "study").unwrap().unwrap();
    let dev = Repositories::get_workspace_by_id(&db, "developer").unwrap().unwrap();

    let study_clock = study.widgets.iter().find(|w| w.widget_type == WidgetType::Clock);
    let dev_clock = dev.widgets.iter().find(|w| w.widget_type == WidgetType::Clock);
    assert!(study_clock.is_some());
    assert!(dev_clock.is_some());

    // Verify saving workspace with duplicate widget replaces/updates rather than inserting duplicates
    let mut custom = Workspace {
        id: "ws-dup-test".to_string(),
        name: "Dup Test".to_string(),
        description: "".to_string(),
        is_active: false,
        widgets: vec![
            WorkspaceWidgetLayout {
                widget_id: "widget-clock".to_string(),
                widget_type: WidgetType::Clock,
                title: "Clock 1".to_string(),
                x: 100.0,
                y: 100.0,
                width: 260.0,
                height: 140.0,
                is_pinned: true,
                visibility_mode: VisibilityMode::AlwaysOnTop,
                is_collapsed: false,
                lock_position: false,
                config_json: "{}".to_string(),
            },
        ],
        created_at: "2026-11-21T10:00:00Z".to_string(),
        updated_at: "2026-11-21T10:00:00Z".to_string(),
    };
    Repositories::save_workspace(&db, &custom).unwrap();

    // Re-saving custom with updated coordinates
    custom.widgets[0].x = 200.0;
    Repositories::save_workspace(&db, &custom).unwrap();

    let loaded = Repositories::get_workspace_by_id(&db, "ws-dup-test").unwrap().unwrap();
    assert_eq!(loaded.widgets.len(), 1, "Must never duplicate widgets in workspace");
    assert_eq!(loaded.widgets[0].x, 200.0);
}

#[test]
fn test_workspace_monitor_clamping_and_bounds() {
    use deskit_lib::windows::WindowPositioning;

    // Test sanitizing extreme negative, oversize, or tiny dimensions
    let (cx, cy, cw, ch) = WindowPositioning::sanitize_bounds(
        &WidgetType::Clock,
        -500.0,
        -300.0,
        50.0,
        20.0,
    );
    assert!(cx >= -200.0, "x should be clamped to valid range");
    assert!(cy >= 0.0, "y should be clamped non-negative");
    assert!(cw >= 200.0, "clock width should be clamped to min width");
    assert!(ch >= 100.0, "clock height should be clamped to min height");

    // Test maximum oversize bounds
    let (_, _, max_w, max_h) = WindowPositioning::sanitize_bounds(
        &WidgetType::Clock,
        100.0,
        100.0,
        5000.0,
        4000.0,
    );
    assert_eq!(max_w, 1600.0, "clock width should not exceed max width");
    assert_eq!(max_h, 1200.0, "clock height should not exceed max height");
}

#[test]
fn test_workspace_corrupted_layout_recovery() {
    let db = Arc::new(setup_in_memory_db());

    // Insert a malformed row directly into workspace_widgets (missing json config or strange values)
    {
        let conn = db.lock().unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name, description, is_active, created_at, updated_at) VALUES ('ws-corrupt', 'Corrupt WS', '', 0, '2026-01-01', '2026-01-01')",
            [],
        ).unwrap();
        conn.execute(
            "INSERT INTO workspace_widgets (id, workspace_id, widget_id, widget_type, title, x, y, width, height, is_pinned, visibility_mode, is_collapsed, lock_position, config_json, created_at, updated_at)
             VALUES ('ww-corrupt-1', 'ws-corrupt', 'widget-bad', 'clock', 'Corrupt Clock', 0.0, 0.0, 0.0, 0.0, 1, 'unknown_mode', 0, 0, '{bad_json}', '2026-01-01', '2026-01-01')",
            [],
        ).unwrap();
    }

    // Fetching must recover gracefully with default VisibilityMode and not panic or crash
    let ws = Repositories::get_workspace_by_id(&db, "ws-corrupt").expect("recovery from corrupt record");
    assert!(ws.is_some());
    let loaded = ws.unwrap();
    assert_eq!(loaded.widgets.len(), 1);
    assert_eq!(loaded.widgets[0].visibility_mode, VisibilityMode::AlwaysOnTop);
}

#[test]
fn test_workspace_concurrent_geometry_updates() {
    use std::thread;

    let db = Arc::new(setup_in_memory_db());

    let mut handles = Vec::new();
    for i in 0..20 {
        let db_clone = Arc::clone(&db);
        handles.push(thread::spawn(move || {
            let offset = i as f64 * 5.0;
            Repositories::update_workspace_widget_geometry(
                &db_clone,
                "study",
                "study-clock",
                100.0 + offset,
                150.0 + offset,
                260.0,
                140.0,
            ).expect("concurrent update");
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let ws = Repositories::get_workspace_by_id(&db, "study").unwrap().unwrap();
    let clock = ws.widgets.iter().find(|w| w.widget_id == "study-clock").unwrap();
    assert!(clock.x >= 100.0 && clock.x <= 200.0);
    assert_eq!(clock.width, 260.0);
}

// ---------------- TASK 07: CLOCK, WORLD CLOCK & ALARMS TESTS ----------------

#[test]
fn test_clock_preference_persistence() {
    let db = Arc::new(setup_in_memory_db());

    // Migration 8 seeds show_seconds as true by default
    let initial = Repositories::get_app_settings(&db).expect("get settings");
    assert_eq!(initial.show_seconds, true);
    assert_eq!(initial.time_format_24h, false);

    // Update settings: show_seconds -> false, time_format_24h -> true
    let mut updated = initial.clone();
    updated.show_seconds = false;
    updated.time_format_24h = true;

    Repositories::save_app_settings(&db, &updated).expect("save settings");

    // Re-read and verify persistence
    let loaded = Repositories::get_app_settings(&db).expect("get settings");
    assert_eq!(loaded.show_seconds, false);
    assert_eq!(loaded.time_format_24h, true);
}

#[test]
fn test_world_clock_timezone_conversion() {
    // Valid IANA zones
    assert!(validate_iana_timezone("America/New_York"));
    assert!(validate_iana_timezone("Europe/London"));
    assert!(validate_iana_timezone("Asia/Tokyo"));
    assert!(validate_iana_timezone("Asia/Kolkata"));
    assert!(validate_iana_timezone("Australia/Sydney"));
    assert!(validate_iana_timezone("UTC"));

    // Invalid IANA zones
    assert!(!validate_iana_timezone(""));
    assert!(!validate_iana_timezone("InvalidZone"));
    assert!(!validate_iana_timezone("Fake/Country/City/Extra"));
    assert!(!validate_iana_timezone("123456"));

    // Tokyo: UTC+9 all year (no DST)
    let dt_utc = chrono::DateTime::parse_from_rfc3339("2026-06-15T12:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let tokyo_dt = utc_to_local("Asia/Tokyo", dt_utc).expect("tokyo conversion");
    assert_eq!(tokyo_dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2026-06-15 21:00:00");

    // Kolkata: UTC+05:30 all year (no DST)
    let kolkata_dt = utc_to_local("Asia/Kolkata", dt_utc).expect("kolkata conversion");
    assert_eq!(kolkata_dt.format("%Y-%m-%d %H:%M:%S").to_string(), "2026-06-15 17:30:00");

    // New York Winter (Standard Time EST = UTC-5)
    let winter_utc = chrono::DateTime::parse_from_rfc3339("2026-01-15T12:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let ny_winter = utc_to_local("America/New_York", winter_utc).expect("ny winter conversion");
    assert_eq!(ny_winter.format("%Y-%m-%d %H:%M:%S").to_string(), "2026-01-15 07:00:00");

    // New York Summer (Daylight Saving EDT = UTC-4)
    let summer_utc = chrono::DateTime::parse_from_rfc3339("2026-07-15T12:00:00Z")
        .unwrap()
        .with_timezone(&chrono::Utc);
    let ny_summer = utc_to_local("America/New_York", summer_utc).expect("ny summer conversion");
    assert_eq!(ny_summer.format("%Y-%m-%d %H:%M:%S").to_string(), "2026-07-15 08:00:00");
}

#[test]
fn test_world_clock_daylight_saving_transitions() {
    // US Eastern DST: starts 2026-03-08 at 07:00 UTC, ends 2026-11-01 at 06:00 UTC
    let before_us_dst = chrono::DateTime::parse_from_rfc3339("2026-03-08T06:59:59Z").unwrap().with_timezone(&chrono::Utc);
    let at_us_dst = chrono::DateTime::parse_from_rfc3339("2026-03-08T07:00:00Z").unwrap().with_timezone(&chrono::Utc);
    let before_us_end = chrono::DateTime::parse_from_rfc3339("2026-11-01T05:59:59Z").unwrap().with_timezone(&chrono::Utc);
    let at_us_end = chrono::DateTime::parse_from_rfc3339("2026-11-01T06:00:00Z").unwrap().with_timezone(&chrono::Utc);

    assert_eq!(get_timezone_offset_seconds("America/New_York", before_us_dst).unwrap(), -5 * 3600); // EST
    assert_eq!(get_timezone_offset_seconds("America/New_York", at_us_dst).unwrap(), -4 * 3600);     // EDT
    assert_eq!(get_timezone_offset_seconds("America/New_York", before_us_end).unwrap(), -4 * 3600); // EDT
    assert_eq!(get_timezone_offset_seconds("America/New_York", at_us_end).unwrap(), -5 * 3600);     // EST

    // Europe London DST: starts 2026-03-29 at 01:00 UTC, ends 2026-10-25 at 01:00 UTC
    let before_lon_dst = chrono::DateTime::parse_from_rfc3339("2026-03-29T00:59:59Z").unwrap().with_timezone(&chrono::Utc);
    let at_lon_dst = chrono::DateTime::parse_from_rfc3339("2026-03-29T01:00:00Z").unwrap().with_timezone(&chrono::Utc);
    let before_lon_end = chrono::DateTime::parse_from_rfc3339("2026-10-25T00:59:59Z").unwrap().with_timezone(&chrono::Utc);
    let at_lon_end = chrono::DateTime::parse_from_rfc3339("2026-10-25T01:00:00Z").unwrap().with_timezone(&chrono::Utc);

    assert_eq!(get_timezone_offset_seconds("Europe/London", before_lon_dst).unwrap(), 0);           // GMT
    assert_eq!(get_timezone_offset_seconds("Europe/London", at_lon_dst).unwrap(), 3600);            // BST
    assert_eq!(get_timezone_offset_seconds("Europe/London", before_lon_end).unwrap(), 3600);        // BST
    assert_eq!(get_timezone_offset_seconds("Europe/London", at_lon_end).unwrap(), 0);               // GMT

    // Australia Sydney (Southern hemisphere: DST active in January, inactive in July)
    let sydney_jan = chrono::DateTime::parse_from_rfc3339("2026-01-15T12:00:00Z").unwrap().with_timezone(&chrono::Utc);
    let sydney_jul = chrono::DateTime::parse_from_rfc3339("2026-07-15T12:00:00Z").unwrap().with_timezone(&chrono::Utc);

    assert_eq!(get_timezone_offset_seconds("Australia/Sydney", sydney_jan).unwrap(), 11 * 3600); // AEDT (Summer)
    assert_eq!(get_timezone_offset_seconds("Australia/Sydney", sydney_jul).unwrap(), 10 * 3600); // AEST (Winter)
}

#[test]
fn test_alarm_creation_editing_and_deletion() {
    let db = Arc::new(setup_in_memory_db());

    // 1. Create one-time alarm
    let alarm = Alarm {
        id: "alarm-test-1".to_string(),
        title: "Wake up".to_string(),
        time_str: "07:00".to_string(),
        days_of_week: vec![],
        is_enabled: true,
        is_recurring: false,
        one_time_date: Some("2026-11-21".to_string()),
        last_triggered_at: None,
        created_at: "2026-11-21T06:00:00Z".to_string(),
        updated_at: "2026-11-21T06:00:00Z".to_string(),
    };

    let saved = Repositories::save_alarm(&db, &alarm).expect("save alarm");
    assert_eq!(saved.id, "alarm-test-1");
    assert_eq!(saved.time_str, "07:00");

    // 2. Edit alarm
    let mut modified = saved.clone();
    modified.time_str = "07:30".to_string();
    modified.title = "Morning Standup".to_string();
    Repositories::save_alarm(&db, &modified).expect("edit alarm");

    let all = Repositories::get_alarms(&db).expect("get alarms");
    let found = all.iter().find(|a| a.id == "alarm-test-1").unwrap();
    assert_eq!(found.time_str, "07:30");
    assert_eq!(found.title, "Morning Standup");

    // 3. Toggle alarm
    let toggled = Repositories::toggle_alarm(&db, "alarm-test-1").expect("toggle");
    assert_eq!(toggled.is_enabled, false);

    // 4. Delete alarm
    Repositories::delete_alarm(&db, "alarm-test-1").expect("delete alarm");
    let after_del = Repositories::get_alarms(&db).unwrap();
    assert!(after_del.iter().all(|a| a.id != "alarm-test-1"));
}

#[test]
fn test_alarm_recurring_weekday_scheduling() {
    use chrono::TimeZone;

    let db = Arc::new(setup_in_memory_db());

    // Create recurring alarm for Weekdays: Monday(1) through Friday(5) at 08:30
    let recurring_alarm = Alarm {
        id: "alarm-weekday".to_string(),
        title: "Team Standup".to_string(),
        time_str: "08:30".to_string(),
        days_of_week: vec![1, 2, 3, 4, 5],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: "2026-11-20T00:00:00Z".to_string(),
        updated_at: "2026-11-20T00:00:00Z".to_string(),
    };
    Repositories::save_alarm(&db, &recurring_alarm).unwrap();

    // Test on Saturday 2026-11-21 at 08:30 -> Should NOT trigger
    let sat_date = chrono::NaiveDate::from_ymd_opt(2026, 11, 21).unwrap();
    let sat_time = chrono::NaiveTime::from_hms_opt(8, 30, 0).unwrap();
    let sat_local = chrono::Local.from_local_datetime(&sat_date.and_time(sat_time)).unwrap();

    let sat_triggers = Repositories::reconcile_alarms(&db, sat_local).unwrap();
    assert_eq!(sat_triggers.len(), 0, "Recurring weekday alarm must NOT fire on Saturday");

    // Test on Monday 2026-11-23 at 08:30 -> Should trigger Due
    let mon_date = chrono::NaiveDate::from_ymd_opt(2026, 11, 23).unwrap();
    let mon_time = chrono::NaiveTime::from_hms_opt(8, 30, 0).unwrap();
    let mon_local = chrono::Local.from_local_datetime(&mon_date.and_time(mon_time)).unwrap();

    let mon_triggers = Repositories::reconcile_alarms(&db, mon_local).unwrap();
    assert_eq!(mon_triggers.len(), 1, "Recurring weekday alarm MUST fire on Monday");
    assert_eq!(mon_triggers[0].1, AlarmTriggerKind::Due);
    // Recurring alarm remains enabled for next day
    let loaded = Repositories::get_alarms(&db).unwrap();
    let a = loaded.iter().find(|x| x.id == "alarm-weekday").unwrap();
    assert_eq!(a.is_enabled, true);
}

#[test]
fn test_alarm_duplicate_prevention() {
    use chrono::TimeZone;

    let db = Arc::new(setup_in_memory_db());

    let alarm = Alarm {
        id: "alarm-dup".to_string(),
        title: "Focus Time".to_string(),
        time_str: "10:00".to_string(),
        days_of_week: vec![1, 2, 3, 4, 5, 6, 7],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: "2026-11-20T00:00:00Z".to_string(),
        updated_at: "2026-11-20T00:00:00Z".to_string(),
    };
    Repositories::save_alarm(&db, &alarm).unwrap();

    let date = chrono::NaiveDate::from_ymd_opt(2026, 11, 21).unwrap();
    let time_1 = chrono::NaiveTime::from_hms_opt(10, 0, 0).unwrap();
    let local_1 = chrono::Local.from_local_datetime(&date.and_time(time_1)).unwrap();

    // First trigger
    let triggers_1 = Repositories::reconcile_alarms(&db, local_1).unwrap();
    assert_eq!(triggers_1.len(), 1);

    // Second check 10 seconds later: MUST NOT re-trigger
    let time_2 = chrono::NaiveTime::from_hms_opt(10, 0, 10).unwrap();
    let local_2 = chrono::Local.from_local_datetime(&date.and_time(time_2)).unwrap();
    let triggers_2 = Repositories::reconcile_alarms(&db, local_2).unwrap();
    assert_eq!(triggers_2.len(), 0, "Alarm must not duplicate-trigger on repeat ticks");
}

#[test]
fn test_alarm_restart_and_sleep_wake_recovery() {
    use chrono::TimeZone;

    let db = Arc::new(setup_in_memory_db());

    // Alarm scheduled for 09:00 today, created earlier at 07:00
    let alarm = Alarm {
        id: "alarm-sleep".to_string(),
        title: "Morning Meeting".to_string(),
        time_str: "09:00".to_string(),
        days_of_week: vec![],
        is_enabled: true,
        is_recurring: false,
        one_time_date: Some("2026-11-21".to_string()),
        last_triggered_at: None,
        created_at: "2026-11-21T07:00:00Z".to_string(),
        updated_at: "2026-11-21T07:00:00Z".to_string(),
    };
    Repositories::save_alarm(&db, &alarm).unwrap();

    // PC woke up or app opened at 09:45 (missed by 45 minutes)
    let date = chrono::NaiveDate::from_ymd_opt(2026, 11, 21).unwrap();
    let wake_time = chrono::NaiveTime::from_hms_opt(9, 45, 0).unwrap();
    let wake_local = chrono::Local.from_local_datetime(&date.and_time(wake_time)).unwrap();

    let triggers = Repositories::reconcile_alarms(&db, wake_local).unwrap();
    assert_eq!(triggers.len(), 1);
    assert_eq!(triggers[0].1, AlarmTriggerKind::Missed, "Missed alarm must be reconciled as Missed");

    // One-time alarm is now automatically disabled
    let loaded = Repositories::get_alarms(&db).unwrap();
    let a = loaded.iter().find(|x| x.id == "alarm-sleep").unwrap();
    assert_eq!(a.is_enabled, false);

    // Subsequent tick doesn't re-trigger
    let next_tick = chrono::Local.from_local_datetime(&date.and_time(chrono::NaiveTime::from_hms_opt(9, 46, 0).unwrap())).unwrap();
    let triggers_next = Repositories::reconcile_alarms(&db, next_tick).unwrap();
    assert_eq!(triggers_next.len(), 0);
}

#[test]
fn test_alarm_timezone_and_invalid_inputs() {
    let db = Arc::new(setup_in_memory_db());

    // 1. Invalid time format
    let bad_time = Alarm {
        id: "bad-1".to_string(),
        title: "Bad".to_string(),
        time_str: "25:70".to_string(),
        days_of_week: vec![],
        is_enabled: true,
        is_recurring: false,
        one_time_date: None,
        last_triggered_at: None,
        created_at: "".to_string(),
        updated_at: "".to_string(),
    };
    assert!(Repositories::save_alarm(&db, &bad_time).is_err());

    // 2. Recurring with empty days
    let bad_rec = Alarm {
        id: "bad-2".to_string(),
        title: "Bad Rec".to_string(),
        time_str: "10:00".to_string(),
        days_of_week: vec![],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: "".to_string(),
        updated_at: "".to_string(),
    };
    assert!(Repositories::save_alarm(&db, &bad_rec).is_err());

    // 3. Invalid day of week (day 8)
    let bad_day = Alarm {
        id: "bad-3".to_string(),
        title: "Bad Day".to_string(),
        time_str: "10:00".to_string(),
        days_of_week: vec![8],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: "".to_string(),
        updated_at: "".to_string(),
    };
    assert!(Repositories::save_alarm(&db, &bad_day).is_err());

    // 4. Invalid World Clock timezone
    let bad_clock = WorldClock {
        id: "wc-bad".to_string(),
        city_name: "Mars City".to_string(),
        timezone: "Invalid/Space_Tz".to_string(),
        sort_order: 0,
        created_at: "".to_string(),
        updated_at: "".to_string(),
    };
    assert!(Repositories::save_world_clock(&db, &bad_clock).is_err());

    // 5. Valid World Clock saves properly
    let good_clock = WorldClock {
        id: "wc-good".to_string(),
        city_name: "Sydney".to_string(),
        timezone: "Australia/Sydney".to_string(),
        sort_order: 1,
        created_at: "".to_string(),
        updated_at: "".to_string(),
    };
    assert!(Repositories::save_world_clock(&db, &good_clock).is_ok());
}

#[test]
fn test_audit_delete_widget_cascades_workspace_widgets() {
    let db = Arc::new(setup_in_memory_db());

    let widget = WidgetInstance {
        id: "audit-w1".to_string(),
        widget_type: WidgetType::Notes,
        title: "Audit Note".to_string(),
        x: 100.0,
        y: 100.0,
        width: 320.0,
        height: 360.0,
        is_pinned: true,
        visibility_mode: VisibilityMode::AlwaysOnTop,
        is_collapsed: false,
        config_json: "{}".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    Repositories::save_widget(&db, &widget).expect("save widget");

    // Add layout entry in workspace_widgets
    {
        let lock = db.lock().unwrap();
        lock.execute(
            "INSERT INTO workspace_widgets (
                id, workspace_id, widget_id, widget_type, title, x, y, width, height,
                is_pinned, visibility_mode, is_collapsed, lock_position, config_json, created_at, updated_at
            ) VALUES ('default-audit-w1', 'default', 'audit-w1', 'notes', 'Audit Note', 100, 100, 320, 360, 1, 'always_on_top', 0, 0, '{}', '2026-01-01', '2026-01-01')",
            [],
        ).expect("insert workspace widget");
    }

    // Verify presence in both tables
    let all_w = Repositories::get_all_widgets(&db).unwrap();
    assert!(all_w.iter().any(|w| w.id == "audit-w1"));

    let ws = Repositories::get_workspace_by_id(&db, "default").unwrap().expect("default ws");
    assert!(ws.widgets.iter().any(|w| w.widget_id == "audit-w1"));

    // Delete widget
    Repositories::delete_widget(&db, "audit-w1").expect("delete widget");

    // Verify completely deleted from widget_instances
    let all_after = Repositories::get_all_widgets(&db).unwrap();
    assert!(!all_after.iter().any(|w| w.id == "audit-w1"));

    // Verify cascaded deletion from workspace_widgets
    let ws_after = Repositories::get_workspace_by_id(&db, "default").unwrap().expect("default ws");
    assert!(!ws_after.widgets.iter().any(|w| w.widget_id == "audit-w1"));
}

#[test]
fn test_audit_notification_retry_on_failure() {
    let db = Arc::new(setup_in_memory_db());

    // 1. Deadlines retry test
    let now_utc = chrono::Utc::now();
    let past_due = (now_utc - chrono::Duration::minutes(5)).to_rfc3339();

    let deadline = Deadline {
        id: "dl-retry-test".to_string(),
        title: "Urgent Audit Deadline".to_string(),
        due_date: past_due,
        category: "Work".to_string(),
        is_completed: false,
        notify_lead_minutes: 15,
        notified_lead: false,
        notified_due: false,
        created_at: now_utc.to_rfc3339(),
        updated_at: now_utc.to_rfc3339(),
    };
    Repositories::save_deadline(&db, &deadline).expect("save deadline");

    // First reconciliation triggers the deadline
    let triggered = Repositories::reconcile_deadlines_notifications(&db, now_utc).expect("reconcile");
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0].0.id, "dl-retry-test");

    // Check that it's now marked notified_due = 1
    let dl_db = Repositories::get_deadline_by_id(&db, "dl-retry-test").unwrap().expect("deadline");
    assert!(dl_db.notified_due);

    // If we reconcile again immediately without reset, it must NOT re-trigger
    let triggered_again = Repositories::reconcile_deadlines_notifications(&db, now_utc).expect("reconcile 2");
    assert_eq!(triggered_again.len(), 0);

    // Now simulate notification delivery failure: reset_deadline_notification
    Repositories::reset_deadline_notification(&db, "dl-retry-test", &DeadlineNotificationKind::Due).expect("reset");

    // Verify notified_due is now false again
    let dl_reset = Repositories::get_deadline_by_id(&db, "dl-retry-test").unwrap().expect("deadline");
    assert!(!dl_reset.notified_due);

    // Next reconciliation tick safely retries notification!
    let triggered_retry = Repositories::reconcile_deadlines_notifications(&db, now_utc).expect("reconcile retry");
    assert_eq!(triggered_retry.len(), 1);
    assert_eq!(triggered_retry[0].0.id, "dl-retry-test");

    // 2. Alarms retry test
    let now_local = chrono::Local::now();
    let current_time_str = now_local.format("%H:%M").to_string();

    let alarm = Alarm {
        id: "alm-retry-test".to_string(),
        title: "Audit Wakeup".to_string(),
        time_str: current_time_str,
        days_of_week: vec![now_local.weekday().number_from_monday() as u8],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: (now_local - chrono::Duration::minutes(10)).to_rfc3339(),
        updated_at: (now_local - chrono::Duration::minutes(10)).to_rfc3339(),
    };
    Repositories::save_alarm(&db, &alarm).expect("save alarm");

    let triggered_alarms = Repositories::reconcile_alarms(&db, now_local).expect("reconcile alarms");
    assert_eq!(triggered_alarms.len(), 1);

    // Simulate notification delivery failure: reset_alarm_trigger
    Repositories::reset_alarm_trigger(&db, "alm-retry-test", true).expect("reset alarm");

    // Verify last_triggered_at is reset
    let alarms = Repositories::get_alarms(&db).unwrap();
    let reset_alm = alarms.iter().find(|a| a.id == "alm-retry-test").unwrap();
    assert!(reset_alm.is_enabled);
    assert!(reset_alm.last_triggered_at.is_none());
}

#[test]
fn test_audit_debouncer_flush_and_evict() {
    let db_state = deskit_lib::persistence::DbState::new_in_memory().expect("db state");
    let debouncer = deskit_lib::windows::GeometryDebouncer::new(db_state.clone());

    // Record initial widget in DB
    let widget = WidgetInstance {
        id: "w-deb-test".to_string(),
        widget_type: WidgetType::Clock,
        title: "Debouncer Test Clock".to_string(),
        x: 100.0,
        y: 100.0,
        width: 260.0,
        height: 140.0,
        is_pinned: true,
        visibility_mode: VisibilityMode::AlwaysOnTop,
        is_collapsed: false,
        config_json: "{}".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    Repositories::save_widget(&db_state.0, &widget).expect("save widget");

    // Record debounced moves
    debouncer.record("w-deb-test".to_string(), 450.0, 550.0, 300.0, 200.0, false);
    debouncer.record("w-deleted".to_string(), 10.0, 10.0, 100.0, 100.0, false);

    // Evict deleted widget
    debouncer.evict("w-deleted");

    // Flush all immediately
    debouncer.flush_all(&db_state);

    // Verify that w-deb-test position was saved immediately in DB
    let loaded = Repositories::get_widget_by_id(&db_state.0, "w-deb-test")
        .unwrap()
        .expect("widget found");
    assert_eq!(loaded.x, 450.0);
    assert_eq!(loaded.y, 550.0);
    assert_eq!(loaded.width, 300.0);
    assert_eq!(loaded.height, 200.0);
}

#[test]
fn test_audit_concurrent_database_concurrency_wal() {
    let db_state = deskit_lib::persistence::DbState::new_in_memory().expect("db state");

    let mut handles = Vec::new();
    for i in 0..10 {
        let db_clone = db_state.clone();
        handles.push(std::thread::spawn(move || {
            for j in 0..10 {
                let task = Task {
                    id: format!("audit-task-{}-{}", i, j),
                    title: format!("Audit Task {}-{}", i, j),
                    description: None,
                    is_completed: false,
                    priority: "medium".to_string(),
                    due_date: None,
                    created_at: chrono::Utc::now().to_rfc3339(),
                    updated_at: chrono::Utc::now().to_rfc3339(),
                };
                Repositories::save_task(&db_clone.0, &task).expect("save task concurrent");
                let _ = Repositories::get_all_tasks(&db_clone.0).expect("read tasks concurrent");
            }
        }));
    }

    for h in handles {
        h.join().unwrap();
    }

    let all_tasks = Repositories::get_all_tasks(&db_state.0).unwrap();
    assert_eq!(all_tasks.len(), 100);
}

#[test]
fn test_alarm_one_time_triggering_and_auto_disable() {
    let db = Arc::new(setup_in_memory_db());
    let now_local = chrono::Local::now();
    let current_time_str = now_local.format("%H:%M").to_string();

    let one_time_alarm = Alarm {
        id: "alm-one-time-test".to_string(),
        title: "Doctor Appointment".to_string(),
        time_str: current_time_str,
        days_of_week: vec![],
        is_enabled: true,
        is_recurring: false,
        one_time_date: Some(now_local.format("%Y-%m-%d").to_string()),
        last_triggered_at: None,
        created_at: (now_local - chrono::Duration::minutes(5)).to_rfc3339(),
        updated_at: (now_local - chrono::Duration::minutes(5)).to_rfc3339(),
    };
    Repositories::save_alarm(&db, &one_time_alarm).expect("save alarm");

    // Reconcile: should trigger as Due
    let triggered = Repositories::reconcile_alarms(&db, now_local).expect("reconcile");
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0].0.id, "alm-one-time-test");
    assert_eq!(triggered[0].1, AlarmTriggerKind::Due);

    // Verify it automatically disabled itself in SQLite
    let alarms = Repositories::get_alarms(&db).unwrap();
    let alm_in_db = alarms.iter().find(|a| a.id == "alm-one-time-test").unwrap();
    assert_eq!(alm_in_db.is_enabled, false, "One-time alarm must be disabled after triggering");
    assert!(alm_in_db.last_triggered_at.is_some());

    // Reconcile again: should not trigger
    let triggered_again = Repositories::reconcile_alarms(&db, now_local).expect("reconcile 2");
    assert_eq!(triggered_again.len(), 0);
}

#[test]
fn test_alarm_recurring_weekday_and_no_duplicate_ticks() {
    let db = Arc::new(setup_in_memory_db());
    let now_local = chrono::Local::now();
    let current_time_str = now_local.format("%H:%M").to_string();
    let current_weekday = now_local.weekday().number_from_monday() as u8;

    let recurring_alarm = Alarm {
        id: "alm-recurring-test".to_string(),
        title: "Daily Standup".to_string(),
        time_str: current_time_str,
        days_of_week: vec![current_weekday],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: (now_local - chrono::Duration::minutes(5)).to_rfc3339(),
        updated_at: (now_local - chrono::Duration::minutes(5)).to_rfc3339(),
    };
    Repositories::save_alarm(&db, &recurring_alarm).expect("save alarm");

    // 1st tick: triggers as Due
    let triggered = Repositories::reconcile_alarms(&db, now_local).expect("reconcile 1");
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0].0.id, "alm-recurring-test");
    assert_eq!(triggered[0].1, AlarmTriggerKind::Due);

    // Recurring alarm remains enabled!
    let alarms = Repositories::get_alarms(&db).unwrap();
    let alm_in_db = alarms.iter().find(|a| a.id == "alm-recurring-test").unwrap();
    assert_eq!(alm_in_db.is_enabled, true, "Recurring alarm must stay enabled");
    assert!(alm_in_db.last_triggered_at.is_some());

    // 2nd tick (10 seconds later): no duplicate trigger
    let tick_2 = now_local + chrono::Duration::seconds(10);
    let triggered_2 = Repositories::reconcile_alarms(&db, tick_2).expect("reconcile 2");
    assert_eq!(triggered_2.len(), 0, "No duplicate triggers on subsequent ticks");

    // 3rd tick (30 seconds later): still no duplicate trigger
    let tick_3 = now_local + chrono::Duration::seconds(30);
    let triggered_3 = Repositories::reconcile_alarms(&db, tick_3).expect("reconcile 3");
    assert_eq!(triggered_3.len(), 0);
}

#[test]
fn test_alarm_missed_policy_after_sleep_wake() {
    let db = Arc::new(setup_in_memory_db());
    let now_local = chrono::Local::now();
    // Alarm was scheduled 2 hours ago
    let past_time = (now_local - chrono::Duration::hours(2)).format("%H:%M").to_string();
    let current_weekday = now_local.weekday().number_from_monday() as u8;

    let alarm = Alarm {
        id: "alm-sleep-wake-test".to_string(),
        title: "Morning Routine".to_string(),
        time_str: past_time,
        days_of_week: vec![current_weekday],
        is_enabled: true,
        is_recurring: true,
        one_time_date: None,
        last_triggered_at: None,
        created_at: (now_local - chrono::Duration::hours(3)).to_rfc3339(),
        updated_at: (now_local - chrono::Duration::hours(3)).to_rfc3339(),
    };
    Repositories::save_alarm(&db, &alarm).expect("save alarm");

    // Reconcile on wake: it must be classified as Missed, NOT Due
    let triggered = Repositories::reconcile_alarms(&db, now_local).expect("reconcile");
    assert_eq!(triggered.len(), 1);
    assert_eq!(triggered[0].0.id, "alm-sleep-wake-test");
    assert_eq!(triggered[0].1, AlarmTriggerKind::Missed, "Missed alarm policy must mark Missed, not Due");

    // Marked as triggered today so it does not trigger again
    let alarms = Repositories::get_alarms(&db).unwrap();
    let alm_in_db = alarms.iter().find(|a| a.id == "alm-sleep-wake-test").unwrap();
    assert!(alm_in_db.last_triggered_at.is_some());
}

#[test]
fn test_alarm_dismiss_and_audio_lifecycle() {
    use deskit_lib::windows::audio::{get_ringing_alarm_id, is_alarm_ringing, play_alarm_sound, stop_alarm_sound};

    // Ensure audio state is clean initially
    let _ = stop_alarm_sound();
    assert_eq!(is_alarm_ringing(), false);
    assert_eq!(get_ringing_alarm_id(), None);

    // Play alarm sound
    play_alarm_sound("alarm-unit-1", "Meeting Alert").expect("play alarm");
    assert_eq!(is_alarm_ringing(), true);
    assert_eq!(get_ringing_alarm_id(), Some("alarm-unit-1".to_string()));

    // Idempotent start: calling again with same id does not crash or double-trigger
    play_alarm_sound("alarm-unit-1", "Meeting Alert").expect("replay same alarm");
    assert_eq!(is_alarm_ringing(), true);
    assert_eq!(get_ringing_alarm_id(), Some("alarm-unit-1".to_string()));

    // Stop/dismiss alarm
    stop_alarm_sound().expect("stop alarm");
    assert_eq!(is_alarm_ringing(), false);
    assert_eq!(get_ringing_alarm_id(), None);
}

#[test]
fn test_clock_widget_dimension_constraints() {
    // Clock widget minimum dimensions: 200x100 (allows compact desk display)
    assert_eq!(WidgetType::Clock.min_dimensions(), (200.0, 100.0));
    // Clock widget maximum dimensions: 1600x1200 (allows large display/wall clock)
    assert_eq!(WidgetType::Clock.max_dimensions(), (1600.0, 1200.0));
    // Default dimensions: 260x140
    assert_eq!(WidgetType::Clock.default_dimensions(), (260.0, 140.0));
}

#[test]
fn test_clock_widget_resize_persistence() {
    let db = Arc::new(setup_in_memory_db());

    let widget = WidgetInstance {
        id: "widget-clock-resize".to_string(),
        widget_type: WidgetType::Clock,
        title: "Desktop Clock".to_string(),
        x: 100.0,
        y: 100.0,
        width: 260.0,
        height: 140.0,
        is_pinned: false,
        visibility_mode: VisibilityMode::AlwaysOnTop,
        is_collapsed: false,
        config_json: "{}".to_string(),
        created_at: "2026-11-21T12:00:00Z".to_string(),
        updated_at: "2026-11-21T12:00:00Z".to_string(),
    };
    Repositories::save_widget(&db, &widget).expect("save widget");

    // 1. Resize to compact boundary (200x100)
    Repositories::update_widget_geometry(&db, "widget-clock-resize", 150.0, 120.0, 200.0, 100.0)
        .expect("update geometry compact");
    let loaded = Repositories::get_widget_by_id(&db, "widget-clock-resize").unwrap().unwrap();
    assert_eq!(loaded.width, 200.0);
    assert_eq!(loaded.height, 100.0);
    assert_eq!(loaded.x, 150.0);
    assert_eq!(loaded.y, 120.0);

    // 2. Resize to expanded layout (800x500)
    Repositories::update_widget_geometry(&db, "widget-clock-resize", 200.0, 180.0, 800.0, 500.0)
        .expect("update geometry expanded");
    let loaded_large = Repositories::get_widget_by_id(&db, "widget-clock-resize").unwrap().unwrap();
    assert_eq!(loaded_large.width, 800.0);
    assert_eq!(loaded_large.height, 500.0);

    // 3. Resize to maximum workspace dimension (1600x1200)
    Repositories::update_widget_geometry(&db, "widget-clock-resize", 50.0, 50.0, 1600.0, 1200.0)
        .expect("update geometry max");
    let loaded_max = Repositories::get_widget_by_id(&db, "widget-clock-resize").unwrap().unwrap();
    assert_eq!(loaded_max.width, 1600.0);
    assert_eq!(loaded_max.height, 1200.0);
}





