use tauri::Window;

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
