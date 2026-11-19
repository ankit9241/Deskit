use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyGoal {
    pub id: String,
    pub title: String,
    pub target_count: i32,
    pub current_count: i32,
    pub is_completed: bool,
    pub date_str: String, // "YYYY-MM-DD"
    pub created_at: String,
    pub updated_at: String,
}
