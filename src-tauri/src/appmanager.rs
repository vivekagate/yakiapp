use crate::{cache, store, task, CacheManager, DataStoreManager, TaskManager, kubeclient};
use crate::kubeclient::KubeClientManager;

pub struct AppManager {
    pub(crate) taskmanager: TaskManager,
    pub(crate) cachemanager: CacheManager,
    pub(crate) dsmanager: DataStoreManager,
    pub(crate) kubemanager: KubeClientManager
}

pub fn initialize() -> AppManager {
    let tm = task::intialize();
    let cm = cache::initialize();
    let dm = store::initialize();
    let kubem = KubeClientManager::initialize();
    AppManager {
        taskmanager: tm,
        cachemanager: cm,
        dsmanager: dm,
        kubemanager: kubem
    }
}
