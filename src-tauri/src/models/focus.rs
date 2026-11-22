use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

fn default_25() -> i32 {
    25
}

fn default_5() -> i32 {
    5
}

fn default_idle() -> String {
    "idle".to_string()
}

fn default_1500() -> i32 {
    1500
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum FocusTransition {
    None,
    CompletedFocus,
    CompletedBreak,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FocusSession {
    #[serde(default)]
    pub id: String,
    #[serde(default = "default_25")]
    pub duration_minutes: i32,
    #[serde(default = "default_5")]
    pub break_minutes: i32,
    #[serde(default = "default_idle")]
    pub state: String, // "idle", "focus", "break", "paused"
    #[serde(default = "default_1500")]
    pub remaining_seconds: i32,
    #[serde(default)]
    pub is_running: bool,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub ends_at: Option<String>,
}

impl FocusSession {
    pub fn new_default() -> Self {
        Self {
            id: "default".to_string(),
            duration_minutes: 25,
            break_minutes: 5,
            state: "idle".to_string(),
            remaining_seconds: 25 * 60,
            is_running: false,
            updated_at: Utc::now().to_rfc3339(),
            ends_at: None,
        }
    }

    /// Reconciles the session against `now`.
    /// If running:
    /// - If `now >= ends_at`, completes the session and transitions mode exactly once.
    /// - If `now < ends_at`, calculates exact remaining seconds from the absolute UTC deadline.
    /// If not running:
    /// - Clears any stale ends_at and ensures non-negative remaining seconds.
    pub fn reconcile(&mut self, now: DateTime<Utc>) -> FocusTransition {
        if !self.is_running {
            self.ends_at = None;
            return FocusTransition::None;
        }

        let ends_at_dt = match &self.ends_at {
            Some(ts) => match DateTime::parse_from_rfc3339(ts) {
                Ok(dt) => dt.with_timezone(&Utc),
                Err(_) => {
                    let dt = now + chrono::Duration::seconds(self.remaining_seconds.max(0) as i64);
                    self.ends_at = Some(dt.to_rfc3339());
                    dt
                }
            },
            None => {
                let dt = now + chrono::Duration::seconds(self.remaining_seconds.max(0) as i64);
                self.ends_at = Some(dt.to_rfc3339());
                dt
            }
        };

        if now >= ends_at_dt {
            // Timer has reached or passed zero: complete session exactly once
            self.is_running = false;
            self.ends_at = None;
            self.updated_at = now.to_rfc3339();

            if self.state == "focus" {
                self.state = "break".to_string();
                self.remaining_seconds = self.break_minutes * 60;
                FocusTransition::CompletedFocus
            } else if self.state == "break" {
                self.state = "idle".to_string();
                self.remaining_seconds = self.duration_minutes * 60;
                FocusTransition::CompletedBreak
            } else {
                self.state = "idle".to_string();
                self.remaining_seconds = self.duration_minutes * 60;
                FocusTransition::CompletedFocus
            }
        } else {
            let rem = (ends_at_dt - now).num_seconds();
            self.remaining_seconds = rem.max(0) as i32;
            self.updated_at = now.to_rfc3339();
            FocusTransition::None
        }
    }

    /// Starts or resumes the timer.
    pub fn start(&mut self, now: DateTime<Utc>) {
        // Reconcile in case it was already running and reached deadline
        let transition = self.reconcile(now);
        if transition != FocusTransition::None {
            // Already transitioned to next mode
            return;
        }

        let target_state = if self.state == "idle" || self.state == "paused" {
            "focus".to_string()
        } else {
            self.state.clone()
        };

        let duration_secs = if target_state == "break" {
            self.break_minutes * 60
        } else {
            self.duration_minutes * 60
        };

        let rem = if self.remaining_seconds > 0 {
            self.remaining_seconds
        } else {
            duration_secs
        };

        self.state = target_state;
        self.is_running = true;
        self.remaining_seconds = rem;
        let deadline = now + chrono::Duration::seconds(rem as i64);
        self.ends_at = Some(deadline.to_rfc3339());
        self.updated_at = now.to_rfc3339();
    }

    /// Pauses the running timer, saving the exact remaining duration.
    pub fn pause(&mut self, now: DateTime<Utc>) {
        if !self.is_running {
            return;
        }

        let transition = self.reconcile(now);
        if transition != FocusTransition::None {
            return;
        }

        self.is_running = false;
        self.ends_at = None;
        self.state = "paused".to_string();
        self.updated_at = now.to_rfc3339();
    }

    /// Resets the timer back to the configured duration in idle state.
    pub fn reset(&mut self, now: DateTime<Utc>) {
        self.is_running = false;
        self.ends_at = None;
        self.state = "idle".to_string();
        self.remaining_seconds = self.duration_minutes * 60;
        self.updated_at = now.to_rfc3339();
    }

    /// Adds minutes (e.g. +5 min) to the current active session.
    pub fn add_minutes(&mut self, minutes: i32, now: DateTime<Utc>) {
        if minutes <= 0 {
            return;
        }

        let added_seconds = minutes * 60;

        if self.is_running {
            let transition = self.reconcile(now);
            if transition == FocusTransition::None && self.is_running {
                let current_ends = match &self.ends_at {
                    Some(ts) => DateTime::parse_from_rfc3339(ts)
                        .map(|dt| dt.with_timezone(&Utc))
                        .unwrap_or(now),
                    None => now,
                };
                let new_ends = current_ends + chrono::Duration::seconds(added_seconds as i64);
                self.ends_at = Some(new_ends.to_rfc3339());
                self.remaining_seconds = (new_ends - now).num_seconds().max(0) as i32;
                self.updated_at = now.to_rfc3339();
                return;
            }
        }

        // Not running or completed during reconcile
        self.remaining_seconds += added_seconds;
        self.ends_at = None;
        self.updated_at = now.to_rfc3339();
    }

    /// Explicitly switches between "focus" and "break" mode.
    pub fn switch_mode(&mut self, mode: &str, now: DateTime<Utc>) {
        self.is_running = false;
        self.ends_at = None;
        if mode == "break" {
            self.state = "break".to_string();
            self.remaining_seconds = self.break_minutes * 60;
        } else {
            self.state = "focus".to_string();
            self.remaining_seconds = self.duration_minutes * 60;
        }
        self.updated_at = now.to_rfc3339();
    }

    /// Configures the base durations for focus and break sessions.
    pub fn set_durations(&mut self, focus_mins: i32, break_mins: i32, now: DateTime<Utc>) {
        let f = focus_mins.clamp(1, 240);
        let b = break_mins.clamp(1, 60);

        self.duration_minutes = f;
        self.break_minutes = b;
        self.is_running = false;
        self.ends_at = None;
        self.state = "idle".to_string();
        self.remaining_seconds = f * 60;
        self.updated_at = now.to_rfc3339();
    }
}
