use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;

fn default_one() -> i32 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DailyGoal {
    #[serde(default)]
    pub id: String,
    pub title: String,
    #[serde(default = "default_one")]
    pub target_count: i32,
    #[serde(default)]
    pub current_count: i32,
    #[serde(default)]
    pub is_completed: bool,
    #[serde(default)]
    pub date_str: String, // "YYYY-MM-DD"
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
    #[serde(default)]
    pub current_streak: i32,
    #[serde(default)]
    pub longest_streak: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GoalHistoryEntry {
    pub id: String,
    pub goal_id: String,
    pub date_str: String,
    pub target_count: i32,
    pub current_count: i32,
    pub is_completed: bool,
    pub recorded_at: String,
}

impl DailyGoal {
    /// Computes (current_streak, longest_streak) given historical completed dates and today's status.
    pub fn compute_streaks(
        completed_dates: &BTreeSet<NaiveDate>,
        today: NaiveDate,
        is_completed_today: bool,
    ) -> (i32, i32) {
        let mut all_completed = completed_dates.clone();
        if is_completed_today {
            all_completed.insert(today);
        }

        if all_completed.is_empty() {
            return (0, 0);
        }

        // 1. Current streak calculation
        let current_streak = if all_completed.contains(&today) {
            let mut streak = 1;
            let mut check_date = today - chrono::Duration::days(1);
            while all_completed.contains(&check_date) {
                streak += 1;
                check_date = check_date - chrono::Duration::days(1);
            }
            streak
        } else {
            // Today is not completed yet; check if yesterday was completed
            let yesterday = today - chrono::Duration::days(1);
            if all_completed.contains(&yesterday) {
                let mut streak = 1;
                let mut check_date = yesterday - chrono::Duration::days(1);
                while all_completed.contains(&check_date) {
                    streak += 1;
                    check_date = check_date - chrono::Duration::days(1);
                }
                streak
            } else {
                0
            }
        };

        // 2. Longest streak calculation across all time
        let mut longest_streak = 0;
        let mut current_run = 0;
        let mut prev_opt: Option<NaiveDate> = None;

        for d in &all_completed {
            match prev_opt {
                Some(prev) => {
                    if *d == prev + chrono::Duration::days(1) {
                        current_run += 1;
                    } else if *d == prev {
                        // ignore duplicate date
                    } else {
                        current_run = 1;
                    }
                }
                None => {
                    current_run = 1;
                }
            }
            longest_streak = longest_streak.max(current_run);
            prev_opt = Some(*d);
        }

        longest_streak = longest_streak.max(current_streak);

        (current_streak, longest_streak)
    }
}
