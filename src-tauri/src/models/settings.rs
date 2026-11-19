use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub close_to_tray: bool,
    pub time_format_24h: bool,
    pub default_visibility_mode: String,
    pub theme: String,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            launch_at_login: false,
            close_to_tray: true,
            time_format_24h: false,
            default_visibility_mode: "always_on_top".to_string(),
            theme: "dark".to_string(),
        }
    }
}
