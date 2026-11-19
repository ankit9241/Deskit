use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub is_completed: bool,
    pub priority: String, // "low", "medium", "high"
    pub due_date: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
