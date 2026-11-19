use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FocusSession {
    pub id: String,
    pub duration_minutes: i32,
    pub break_minutes: i32,
    pub state: String, // "idle", "focus", "break", "paused"
    pub remaining_seconds: i32,
    pub is_running: bool,
    pub updated_at: String,
}
