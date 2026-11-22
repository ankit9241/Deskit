use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum WidgetType {
    Clock,
    Tasks,
    Focus,
    Notes,
    Deadlines,
    Goals,
}

impl WidgetType {
    pub fn as_str(&self) -> &'static str {
        match self {
            WidgetType::Clock => "clock",
            WidgetType::Tasks => "tasks",
            WidgetType::Focus => "focus",
            WidgetType::Notes => "notes",
            WidgetType::Deadlines => "deadlines",
            WidgetType::Goals => "goals",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "clock" => Some(WidgetType::Clock),
            "tasks" => Some(WidgetType::Tasks),
            "focus" => Some(WidgetType::Focus),
            "notes" => Some(WidgetType::Notes),
            "deadlines" => Some(WidgetType::Deadlines),
            "goals" => Some(WidgetType::Goals),
            _ => None,
        }
    }

    pub fn default_dimensions(&self) -> (f64, f64) {
        match self {
            WidgetType::Clock => (260.0, 140.0),
            WidgetType::Tasks => (320.0, 420.0),
            WidgetType::Focus => (280.0, 220.0),
            WidgetType::Notes => (320.0, 360.0),
            WidgetType::Deadlines => (320.0, 380.0),
            WidgetType::Goals => (320.0, 380.0),
        }
    }

    pub fn min_dimensions(&self) -> (f64, f64) {
        match self {
            WidgetType::Clock => (200.0, 100.0),
            WidgetType::Tasks => (280.0, 260.0),
            WidgetType::Focus => (240.0, 180.0),
            WidgetType::Notes => (260.0, 220.0),
            WidgetType::Deadlines => (260.0, 240.0),
            WidgetType::Goals => (260.0, 240.0),
        }
    }

    pub fn max_dimensions(&self) -> (f64, f64) {
        match self {
            WidgetType::Clock => (1600.0, 1200.0),
            WidgetType::Tasks => (1600.0, 1200.0),
            WidgetType::Focus => (1200.0, 1000.0),
            WidgetType::Notes => (1600.0, 1200.0),
            WidgetType::Deadlines => (1600.0, 1200.0),
            WidgetType::Goals => (1600.0, 1200.0),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum VisibilityMode {
    AlwaysOnTop,
    DesktopOnly, // Experimental / Unsupported in Phase 1
    Smart,       // Configurable future behavior
}

impl Default for VisibilityMode {
    fn default() -> Self {
        VisibilityMode::AlwaysOnTop
    }
}

impl VisibilityMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            VisibilityMode::AlwaysOnTop => "always_on_top",
            VisibilityMode::DesktopOnly => "desktop_only",
            VisibilityMode::Smart => "smart",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "desktop_only" => VisibilityMode::DesktopOnly,
            "smart" => VisibilityMode::Smart,
            _ => VisibilityMode::AlwaysOnTop,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetInstance {
    pub id: String,
    pub widget_type: WidgetType,
    pub title: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_pinned: bool,
    pub visibility_mode: VisibilityMode,
    pub is_collapsed: bool,
    pub config_json: String,
    pub created_at: String,
    pub updated_at: String,
}
