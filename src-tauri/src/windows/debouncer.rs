use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use crate::persistence::{DbState, Repositories};

#[derive(Debug, Clone)]
struct PendingEntry {
    widget_id: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_collapsed: bool,
    last_updated: Instant,
}

#[derive(Clone)]
pub struct GeometryDebouncer {
    entries: Arc<Mutex<HashMap<String, PendingEntry>>>,
}

impl GeometryDebouncer {
    pub fn new(db: DbState) -> Self {
        let debouncer = Self {
            entries: Arc::new(Mutex::new(HashMap::new())),
        };

        let entries_clone = Arc::clone(&debouncer.entries);
        let db_clone = db.clone();

        std::thread::spawn(move || {
            loop {
                std::thread::sleep(Duration::from_millis(150));
                let mut to_flush = Vec::new();
                {
                    if let Ok(mut map) = entries_clone.lock() {
                        let now = Instant::now();
                        let keys: Vec<String> = map.keys().cloned().collect();
                        for key in keys {
                            if let Some(entry) = map.get(&key) {
                                if now.duration_since(entry.last_updated) >= Duration::from_millis(300) {
                                    if let Some(e) = map.remove(&key) {
                                        to_flush.push(e);
                                    }
                                }
                            }
                        }
                    }
                }

                for item in to_flush {
                    if item.is_collapsed {
                        let _ = Repositories::update_widget_position(
                            &db_clone.0,
                            &item.widget_id,
                            item.x,
                            item.y,
                        );
                    } else {
                        let _ = Repositories::update_widget_geometry(
                            &db_clone.0,
                            &item.widget_id,
                            item.x,
                            item.y,
                            item.width,
                            item.height,
                        );
                    }
                }
            }
        });

        debouncer
    }

    pub fn record(&self, widget_id: String, x: f64, y: f64, width: f64, height: f64, is_collapsed: bool) {
        if let Ok(mut map) = self.entries.lock() {
            map.insert(
                widget_id.clone(),
                PendingEntry {
                    widget_id,
                    x,
                    y,
                    width,
                    height,
                    is_collapsed,
                    last_updated: Instant::now(),
                },
            );
        }
    }

    pub fn evict(&self, widget_id: &str) {
        if let Ok(mut map) = self.entries.lock() {
            map.remove(widget_id);
        }
    }

    pub fn flush_all(&self, db: &DbState) {
        if let Ok(mut map) = self.entries.lock() {
            let entries: Vec<PendingEntry> = map.drain().map(|(_, v)| v).collect();
            drop(map);

            for item in entries {
                if item.is_collapsed {
                    let _ = Repositories::update_widget_position(
                        &db.0,
                        &item.widget_id,
                        item.x,
                        item.y,
                    );
                } else {
                    let _ = Repositories::update_widget_geometry(
                        &db.0,
                        &item.widget_id,
                        item.x,
                        item.y,
                        item.width,
                        item.height,
                    );
                }
            }
        }
    }
}
