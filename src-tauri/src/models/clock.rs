use chrono::{DateTime, Datelike, Duration, NaiveDate, NaiveDateTime, Utc, Weekday};
use serde::{Deserialize, Serialize};

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WorldClock {
    pub id: String,
    pub city_name: String,
    pub timezone: String, // IANA identifier, e.g. "America/New_York", "Europe/London", "Asia/Tokyo"
    #[serde(default)]
    pub sort_order: i32,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Alarm {
    pub id: String,
    pub title: String,
    pub time_str: String, // "HH:MM" in 24-hour format, e.g. "07:30"
    #[serde(default)]
    pub days_of_week: Vec<u8>, // 1 = Monday .. 7 = Sunday
    #[serde(default = "default_true")]
    pub is_enabled: bool,
    #[serde(default)]
    pub is_recurring: bool,
    #[serde(default)]
    pub one_time_date: Option<String>, // Optional "YYYY-MM-DD"
    #[serde(default)]
    pub last_triggered_at: Option<String>,
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AlarmTriggerKind {
    Due,
    Missed,
}

// ---------------- TIMEZONE & DST CONVERSIONS ----------------

pub fn validate_iana_timezone(tz: &str) -> bool {
    let trimmed = tz.trim();
    if trimmed.is_empty() {
        return false;
    }

    if trimmed == "UTC" || trimmed == "GMT" || trimmed == "Etc/UTC" || trimmed == "Etc/GMT" {
        return true;
    }

    let parts: Vec<&str> = trimmed.split('/').collect();
    if parts.len() < 2 || parts.len() > 3 {
        return false;
    }

    let valid_regions = [
        "Africa",
        "America",
        "Antarctica",
        "Arctic",
        "Asia",
        "Atlantic",
        "Australia",
        "Europe",
        "Indian",
        "Pacific",
        "Etc",
    ];

    if !valid_regions.contains(&parts[0]) {
        return false;
    }

    // Ensure all parts contain valid ASCII characters (letters, numbers, underscore, hyphen)
    for part in parts {
        if part.is_empty()
            || !part
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-' || c == '+')
        {
            return false;
        }
    }

    true
}

fn nth_sunday_of_month(year: i32, month: u32, n: u32) -> Option<NaiveDate> {
    let mut count = 0;
    for day in 1..=31 {
        if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
            if date.weekday() == Weekday::Sun {
                count += 1;
                if count == n {
                    return Some(date);
                }
            }
        }
    }
    None
}

fn last_sunday_of_month(year: i32, month: u32) -> Option<NaiveDate> {
    for day in (1..=31).rev() {
        if let Some(date) = NaiveDate::from_ymd_opt(year, month, day) {
            if date.weekday() == Weekday::Sun {
                return Some(date);
            }
        }
    }
    None
}

/// Calculate the UTC offset in seconds (including Daylight Saving Time if applicable)
/// for a supported or standard IANA timezone at a specific UTC timestamp.
pub fn get_timezone_offset_seconds(iana_tz: &str, dt_utc: DateTime<Utc>) -> Result<i32, String> {
    if !validate_iana_timezone(iana_tz) {
        return Err(format!("Invalid IANA timezone identifier: \"{}\"", iana_tz));
    }

    let tz_norm = iana_tz.trim();

    // Fixed zones with no DST
    match tz_norm {
        "UTC" | "GMT" | "Etc/UTC" | "Etc/GMT" => return Ok(0),
        "Asia/Tokyo" => return Ok(9 * 3600),
        "Asia/Kolkata" | "Asia/Calcutta" => return Ok(5 * 3600 + 1800), // UTC+05:30
        "Asia/Singapore" | "Asia/Hong_Kong" | "Asia/Shanghai" | "Asia/Taipei" => {
            return Ok(8 * 3600)
        }
        "Asia/Dubai" => return Ok(4 * 3600),
        "Asia/Seoul" => return Ok(9 * 3600),
        "Asia/Bangkok" | "Asia/Jakarta" => return Ok(7 * 3600),
        "America/Phoenix" => return Ok(-7 * 3600), // Arizona does not observe DST
        "Pacific/Honolulu" => return Ok(-10 * 3600), // Hawaii does not observe DST
        _ => {}
    }

    let year = dt_utc.year();

    // US Timezones with US Energy Policy Act DST rules (2nd Sun in Mar to 1st Sun in Nov)
    if tz_norm.starts_with("America/") || tz_norm.starts_with("US/") {
        let base_offset = match tz_norm {
            "America/New_York" | "America/Detroit" | "US/Eastern" => -5 * 3600,
            "America/Chicago" | "US/Central" => -6 * 3600,
            "America/Denver" | "US/Mountain" => -7 * 3600,
            "America/Los_Angeles" | "US/Pacific" => -8 * 3600,
            "America/Anchorage" | "US/Alaska" => -9 * 3600,
            _ => -5 * 3600, // Default to Eastern for unrecognized Americas
        };

        let start_date = nth_sunday_of_month(year, 3, 2).ok_or("Failed to compute US DST start")?;
        let end_date = nth_sunday_of_month(year, 11, 1).ok_or("Failed to compute US DST end")?;

        let start_dt = start_date
            .and_hms_opt(7, 0, 0)
            .ok_or("Invalid DST start time")?
            .and_utc();
        let end_dt = end_date
            .and_hms_opt(6, 0, 0)
            .ok_or("Invalid DST end time")?
            .and_utc();

        let is_dst = dt_utc >= start_dt && dt_utc < end_dt;
        return Ok(if is_dst {
            base_offset + 3600
        } else {
            base_offset
        });
    }

    // European Timezones (Last Sun in Mar to Last Sun in Oct)
    if tz_norm.starts_with("Europe/") {
        let base_offset = match tz_norm {
            "Europe/London" | "Europe/Dublin" | "Europe/Lisbon" => 0,
            "Europe/Paris"
            | "Europe/Berlin"
            | "Europe/Rome"
            | "Europe/Madrid"
            | "Europe/Amsterdam"
            | "Europe/Brussels"
            | "Europe/Vienna"
            | "Europe/Stockholm" => 1 * 3600,
            "Europe/Athens" | "Europe/Helsinki" | "Europe/Bucharest" | "Europe/Kyiv" => 2 * 3600,
            "Europe/Moscow" => return Ok(3 * 3600), // Moscow does not observe DST
            _ => 1 * 3600,
        };

        let start_date =
            last_sunday_of_month(year, 3).ok_or("Failed to compute Europe DST start")?;
        let end_date =
            last_sunday_of_month(year, 10).ok_or("Failed to compute Europe DST end")?;

        let start_dt = start_date
            .and_hms_opt(1, 0, 0)
            .ok_or("Invalid DST start time")?
            .and_utc();
        let end_dt = end_date
            .and_hms_opt(1, 0, 0)
            .ok_or("Invalid DST end time")?
            .and_utc();

        let is_dst = dt_utc >= start_dt && dt_utc < end_dt;
        return Ok(if is_dst {
            base_offset + 3600
        } else {
            base_offset
        });
    }

    // Australian Timezones (Southern Hemisphere: 1st Sun in Oct to 1st Sun in Apr)
    if tz_norm.starts_with("Australia/") {
        let (base_offset, has_dst) = match tz_norm {
            "Australia/Sydney" | "Australia/Melbourne" | "Australia/Hobart" => (10 * 3600, true),
            "Australia/Brisbane" => (10 * 3600, false), // Queensland no DST
            "Australia/Adelaide" => (9 * 3600 + 1800, true),
            "Australia/Darwin" => (9 * 3600 + 1800, false),
            "Australia/Perth" => (8 * 3600, false),
            _ => (10 * 3600, true),
        };

        if !has_dst {
            return Ok(base_offset);
        }

        let start_date =
            nth_sunday_of_month(year, 10, 1).ok_or("Failed to compute Australia DST start")?;
        let end_date =
            nth_sunday_of_month(year, 4, 1).ok_or("Failed to compute Australia DST end")?;

        let start_dt = start_date
            .and_hms_opt(16, 0, 0)
            .ok_or("Invalid DST start time")?
            .and_utc();
        let end_dt = end_date
            .and_hms_opt(16, 0, 0)
            .ok_or("Invalid DST end time")?
            .and_utc();

        // In southern hemisphere, DST spans over the new year
        let is_dst = dt_utc >= start_dt || dt_utc < end_dt;
        return Ok(if is_dst {
            base_offset + 3600
        } else {
            base_offset
        });
    }

    // Pacific / Auckland (NZST/NZDT: Last Sun in Sep to 1st Sun in Apr)
    if tz_norm == "Pacific/Auckland" {
        let base_offset = 12 * 3600;
        let start_date =
            last_sunday_of_month(year, 9).ok_or("Failed to compute NZ DST start")?;
        let end_date =
            nth_sunday_of_month(year, 4, 1).ok_or("Failed to compute NZ DST end")?;

        let start_dt = start_date
            .and_hms_opt(14, 0, 0)
            .ok_or("Invalid DST start time")?
            .and_utc();
        let end_dt = end_date
            .and_hms_opt(14, 0, 0)
            .ok_or("Invalid DST end time")?
            .and_utc();

        let is_dst = dt_utc >= start_dt || dt_utc < end_dt;
        return Ok(if is_dst {
            base_offset + 3600
        } else {
            base_offset
        });
    }

    Ok(0)
}

/// Convert a UTC datetime to a NaiveDateTime in the target IANA timezone
pub fn utc_to_local(iana_tz: &str, dt_utc: DateTime<Utc>) -> Result<NaiveDateTime, String> {
    let offset_seconds = get_timezone_offset_seconds(iana_tz, dt_utc)?;
    let local_dt = dt_utc + Duration::seconds(offset_seconds as i64);
    Ok(local_dt.naive_utc())
}
