use tauri::Window;
use crate::EventHolder;

#[derive(Clone, serde::Serialize, Default)]
pub struct AppError {
    pub(crate) reason: String,
}

impl AppError {
    pub(crate) fn new() -> Self {
        Default::default()
    }
}

pub fn send_error(window: &Window, err: String) {
    window.emit("app::error", AppError { reason: err }).unwrap();
}

pub fn dispatch_event_to_frontend(window: &Window, event: &str) {
    window
        .emit(
            "app_events_channel",
            EventHolder {
                event: event.parse().unwrap(),
                data: "".parse().unwrap(),
            },
        )
        .unwrap();
}
