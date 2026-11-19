use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deadline {
    pub id: String,
    pub title: String,
    pub due_date: String,
    pub category: String,
    pub is_completed: bool,
    pub created_at: String,
    pub updated_at: String,
}
