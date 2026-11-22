use serde::{Deserialize, Serialize};

fn default_category() -> String {
    "General".to_string()
}

fn default_notify_lead_minutes() -> i32 {
    15
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DeadlineNotificationKind {
    Approaching,
    Due,
    Missed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Deadline {
    #[serde(default)]
    pub id: String,
    pub title: String,
    pub due_date: String,
    #[serde(default = "default_category")]
    pub category: String,
    #[serde(default)]
    pub is_completed: bool,
    #[serde(default = "default_notify_lead_minutes")]
    pub notify_lead_minutes: i32,
    #[serde(default)]
    pub notified_lead: bool,
    #[serde(default)]
    pub notified_due: bool,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
