use std::sync::{Arc, Mutex};
use std::time::Duration;

#[cfg(target_os = "windows")]
mod win32 {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;

    #[link(name = "winmm")]
    extern "system" {
        pub fn PlaySoundW(psz_sound: *const u16, hmod: *const std::ffi::c_void, fdw_sound: u32) -> i32;
    }

    #[link(name = "user32")]
    extern "system" {
        pub fn MessageBeep(u_type: u32) -> i32;
    }

    pub const SND_ASYNC: u32 = 0x0001;
    pub const SND_NODEFAULT: u32 = 0x0002;
    pub const SND_LOOP: u32 = 0x0008;
    pub const SND_FILENAME: u32 = 0x00020000;
    pub const SND_ALIAS: u32 = 0x00010000;

    pub fn play_wav_or_alias() -> bool {
        // Search candidates for alarm sounds in C:\Windows\Media\
        let candidates = [
            r"C:\Windows\Media\Alarm01.wav",
            r"C:\Windows\Media\Alarm02.wav",
            r"C:\Windows\Media\Alarm03.wav",
            r"C:\Windows\Media\Ring01.wav",
        ];

        for c in &candidates {
            if Path::new(c).exists() {
                let mut wide: Vec<u16> = std::ffi::OsStr::new(c).encode_wide().collect();
                wide.push(0);
                unsafe {
                    let ret = PlaySoundW(
                        wide.as_ptr(),
                        std::ptr::null(),
                        SND_ASYNC | SND_FILENAME | SND_LOOP | SND_NODEFAULT,
                    );
                    if ret != 0 {
                        return true;
                    }
                }
            }
        }

        // Fallback: Windows system sound alias
        let alias = std::ffi::OsStr::new("SystemAsterisk");
        let mut wide_alias: Vec<u16> = alias.encode_wide().collect();
        wide_alias.push(0);
        unsafe {
            let ret = PlaySoundW(
                wide_alias.as_ptr(),
                std::ptr::null(),
                SND_ASYNC | SND_ALIAS | SND_LOOP | SND_NODEFAULT,
            );
            if ret != 0 {
                return true;
            }
        }

        // Final fallback: MessageBeep
        unsafe {
            let _ = MessageBeep(0x00000030); // MB_ICONEXCLAMATION
        }
        true
    }

    pub fn stop_sound() {
        unsafe {
            PlaySoundW(std::ptr::null(), std::ptr::null(), 0);
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod win32 {
    pub fn play_wav_or_alias() -> bool {
        true
    }
    pub fn stop_sound() {}
}

#[derive(Default)]
struct AudioState {
    current_alarm_id: Option<String>,
    stop_tx: Option<std::sync::mpsc::Sender<()>>,
}

static AUDIO_STATE: std::sync::OnceLock<Arc<Mutex<AudioState>>> = std::sync::OnceLock::new();

fn get_audio_state() -> &'static Arc<Mutex<AudioState>> {
    AUDIO_STATE.get_or_init(|| Arc::new(Mutex::new(AudioState::default())))
}

pub fn is_alarm_ringing() -> bool {
    get_audio_state().lock().unwrap().current_alarm_id.is_some()
}

pub fn get_ringing_alarm_id() -> Option<String> {
    get_audio_state().lock().unwrap().current_alarm_id.clone()
}

pub fn play_alarm_sound(alarm_id: &str, _title: &str) -> Result<(), String> {
    let state_arc = get_audio_state();
    let mut state = state_arc.lock().unwrap();

    // Prevent duplicate triggers if already ringing this alarm
    if let Some(ref current) = state.current_alarm_id {
        if current == alarm_id {
            return Ok(());
        }
        // If ringing another alarm, stop it first
        if let Some(tx) = state.stop_tx.take() {
            let _ = tx.send(());
        }
        win32::stop_sound();
    }

    // Play native alarm audio loop
    let success = win32::play_wav_or_alias();
    if !success {
        return Err("Failed to initiate native audio playback".to_string());
    }

    let (tx, rx) = std::sync::mpsc::channel();
    state.current_alarm_id = Some(alarm_id.to_string());
    state.stop_tx = Some(tx);

    // Watchdog thread: auto-stop after 60 seconds bounded limit
    let state_for_watchdog = Arc::clone(state_arc);
    let target_id = alarm_id.to_string();
    std::thread::spawn(move || {
        match rx.recv_timeout(Duration::from_secs(60)) {
            Ok(_) => {
                // Stopped early by dismissal
            }
            Err(_) => {
                // Timeout reached: stop sound
                win32::stop_sound();
                if let Ok(mut s) = state_for_watchdog.lock() {
                    if s.current_alarm_id.as_deref() == Some(&target_id) {
                        s.current_alarm_id = None;
                        s.stop_tx = None;
                    }
                }
            }
        }
    });

    Ok(())
}

pub fn stop_alarm_sound() -> Result<(), String> {
    let state_arc = get_audio_state();
    let mut state = state_arc.lock().unwrap();

    if let Some(tx) = state.stop_tx.take() {
        let _ = tx.send(());
    }
    state.current_alarm_id = None;
    win32::stop_sound();
    Ok(())
}
