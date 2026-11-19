use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager};

use super::migrations::run_migrations;

#[derive(Clone)]
pub struct DbState(pub Arc<Mutex<Connection>>);

impl DbState {
    pub fn new(db_path: PathBuf) -> Result<Self, Box<dyn std::error::Error>> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let mut conn = Connection::open(db_path)?;
        run_migrations(&mut conn)?;
        Ok(Self(Arc::new(Mutex::new(conn))))
    }

    pub fn new_in_memory() -> Result<Self, Box<dyn std::error::Error>> {
        let mut conn = Connection::open_in_memory()?;
        run_migrations(&mut conn)?;
        Ok(Self(Arc::new(Mutex::new(conn))))
    }
}

pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, Box<dyn std::error::Error>> {
    // 1. Try local app data directory
    if let Ok(dir) = app.path().app_local_data_dir() {
        if std::fs::create_dir_all(&dir).is_ok() {
            return Ok(dir.join("deskit.db"));
        }
    }

    // 2. Try roaming app data directory
    if let Ok(dir) = app.path().app_data_dir() {
        if std::fs::create_dir_all(&dir).is_ok() {
            return Ok(dir.join("deskit.db"));
        }
    }

    // 3. Fallback to local workspace / exe directory
    let local_dir = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join(".deskit_data");
    let _ = std::fs::create_dir_all(&local_dir);
    if local_dir.exists() {
        return Ok(local_dir.join("deskit.db"));
    }

    // 4. Working directory fallback
    Ok(PathBuf::from("deskit.db"))
}
