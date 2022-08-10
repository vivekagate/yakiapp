use crate::{cache, store, task, CacheManager, DataStoreManager, TaskManager, kubeclient};
use crate::kubeclient::KubeClientManager;
use crate::store::PKEY_KUBECONFIG_FILE_LOCATION;

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

    let kubeconfigfile = dm.query(PKEY_KUBECONFIG_FILE_LOCATION.to_string(), None);
    let mut kubem = KubeClientManager::initialize();
    if let Some(file) = kubeconfigfile {
        kubem = KubeClientManager::initialize_from(file);
    }
    AppManager {
        taskmanager: tm,
        cachemanager: cm,
        dsmanager: dm,
        kubemanager: kubem
    }
}
