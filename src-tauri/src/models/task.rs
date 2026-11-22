use serde::{Deserialize, Serialize};

fn default_priority() -> String {
    "medium".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub is_completed: bool,
    #[serde(default = "default_priority")]
    pub priority: String, // "low", "medium", "high"
    pub due_date: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
