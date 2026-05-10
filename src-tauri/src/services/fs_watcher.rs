use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

pub struct FsWatcherService {
    watchers: Mutex<HashMap<i64, RecommendedWatcher>>,
    debounce_timers: Mutex<HashMap<i64, Instant>>,
    debounce_delay: Duration,
}

impl FsWatcherService {
    pub fn new(debounce_delay_secs: u64) -> Self {
        Self {
            watchers: Mutex::new(HashMap::new()),
            debounce_timers: Mutex::new(HashMap::new()),
            debounce_delay: Duration::from_secs(debounce_delay_secs),
        }
    }

    pub fn watch(
        &self,
        task_id: i64,
        local_path: &str,
        on_change: Box<dyn Fn(i64) + Send + Sync>,
    ) -> Result<(), String> {
        let path = Path::new(local_path);
        if !path.exists() {
            return Err(format!("Path does not exist: {}", local_path));
        }

        let task_id_clone = task_id;
        let on_change_clone = Arc::new(on_change);

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    match event.kind {
                        EventKind::Create(_)
                        | EventKind::Modify(_)
                        | EventKind::Remove(_) => {
                            on_change_clone(task_id_clone);
                        }
                        _ => {}
                    }
                }
            },
            Config::default(),
        )
        .map_err(|e| e.to_string())?;

        watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;

        self.watchers.lock().unwrap().insert(task_id, watcher);
        Ok(())
    }

    pub fn unwatch(&self, task_id: i64) -> Result<(), String> {
        self.watchers.lock().unwrap().remove(&task_id);
        self.debounce_timers.lock().unwrap().remove(&task_id);
        Ok(())
    }

    pub fn unwatch_all(&self) {
        self.watchers.lock().unwrap().clear();
        self.debounce_timers.lock().unwrap().clear();
    }

    pub fn should_trigger(&self, task_id: i64) -> bool {
        let mut timers = self.debounce_timers.lock().unwrap();
        if let Some(last) = timers.get(&task_id) {
            if last.elapsed() < self.debounce_delay {
                return false;
            }
        }
        timers.insert(task_id, Instant::now());
        true
    }
}
