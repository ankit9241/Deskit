use serde::{Deserialize, Serialize};
use crate::models::{VisibilityMode, WidgetType};

fn default_config_json() -> String {
    "{}".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorkspaceWidgetLayout {
    pub widget_id: String,
    pub widget_type: WidgetType,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    #[serde(default = "default_true")]
    pub is_pinned: bool,
    #[serde(default)]
    pub visibility_mode: VisibilityMode,
    #[serde(default)]
    pub is_collapsed: bool,
    #[serde(default)]
    pub lock_position: bool,
    #[serde(default = "default_config_json")]
    pub config_json: String,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub is_active: bool,
    #[serde(default)]
    pub widgets: Vec<WorkspaceWidgetLayout>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}
