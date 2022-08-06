#[derive(Clone, serde::Serialize, Default)]
pub struct CommandResult {
    pub(crate) command: String,
    pub(crate) data: String,
}

impl CommandResult {
    pub(crate) fn new() -> Self {
        Default::default()
    }
}

#[derive(Clone, serde::Serialize, Default)]
pub struct ResourceWithMetricsHolder {
    pub(crate) resource: String,
    pub(crate) metrics: String,
}

impl ResourceWithMetricsHolder {
    pub(crate) fn new() -> Self {
        Default::default()
    }
}
