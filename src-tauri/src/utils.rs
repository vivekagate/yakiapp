use tauri::Window;
use crate::{EventHolder, Payload};

#[derive(Clone, serde::Serialize, Default)]
pub struct AppError {
    pub(crate) reason: String,
}

impl AppError {
    pub(crate) fn new() -> Self {
        Default::default()
    }
}

pub fn send_error(window: &Window, err: &str) {
    window.emit("app::error", AppError { reason: err.to_string() }).unwrap();
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

pub fn dispatch_event_to_frontend_with_data(window: &Window, event: &str, data: &str) {
    window
        .emit(
            "app_events_channel",
            EventHolder {
                event: event.parse().unwrap(),
                data: data.to_string(),
            },
        )
        .unwrap();
}

pub fn dispatch_event_to_frontend_on_channel(window: &Window, channel: &str, data: &str) {
    println!("Sending data {} to frontend", data);
    window
        .emit(
            channel,
            Payload {
                message: data.to_string(),
            },
        )
        .unwrap();

}
