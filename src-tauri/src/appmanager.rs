use crate::{cache, store, task, CacheManager, DataStoreManager, TaskManager};

pub struct AppManager {
    pub(crate) taskmanager: TaskManager,
    pub(crate) cachemanager: CacheManager,
    pub(crate) dsmanager: DataStoreManager,
}

pub fn initialize() -> AppManager {
    let tm = task::intialize();
    let cm = cache::initialize();
    let dm = store::initialize();
    AppManager {
        taskmanager: tm,
        cachemanager: cm,
        dsmanager: dm,
    }
}
