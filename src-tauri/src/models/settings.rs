use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub close_to_tray: bool,
    pub time_format_24h: bool,
    #[serde(default = "default_true")]
    pub show_seconds: bool,
    pub default_visibility_mode: String,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: true,
            close_to_tray: true,
            time_format_24h: false,
            show_seconds: true,
            default_visibility_mode: "always_on_top".to_string(),
            theme: "dark".to_string(),
        }
    }
}
