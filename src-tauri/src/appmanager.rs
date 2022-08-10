use crate::{cache, store, task, CacheManager, DataStoreManager, TaskManager, kubeclient};
use crate::kubeclient::KubeClientManager;
use crate::store::{PKEY_KUBECONFIG_FILE_LOCATION, PKEY_PROXY_URL};

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
    let proxy_url = dm.query(PKEY_PROXY_URL.to_string(), None);
    let mut kubem = KubeClientManager::initialize();
    if let Some(file) = kubeconfigfile {
        if let Some(url) = proxy_url {
            kubem = KubeClientManager::initialize_from(file, Some(url));
        }else{
            kubem = KubeClientManager::initialize_from(file, None);
        }
    }
    AppManager {
        taskmanager: tm,
        cachemanager: cm,
        dsmanager: dm,
        kubemanager: kubem
    }
}
