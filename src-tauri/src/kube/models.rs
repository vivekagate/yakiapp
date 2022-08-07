use k8s_openapi::{ClusterResourceScope, NamespaceResourceScope};
use kube::api::{ListParams, ObjectList, ObjectMeta};
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;


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

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct MetricsUsage {
    pub cpu: Quantity,
    pub memory: Quantity,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug, Default)]
pub struct NodeMetrics {
    pub metadata: ObjectMeta,
    pub timestamp: Option<String>,
    pub window: Option<String>,
    pub usage: Option<MetricsUsage>,
}

impl k8s_openapi::Resource for NodeMetrics {
    const API_VERSION: &'static str = "metrics.k8s.io/v1beta1";
    const GROUP: &'static str = "metrics.k8s.io";
    const KIND: &'static str = "node";
    const VERSION: &'static str = "v1beta1";
    const URL_PATH_SEGMENT: &'static str = "nodes";
    type Scope = ClusterResourceScope;
}

impl k8s_openapi::Metadata for NodeMetrics {
    type Ty = ObjectMeta;

    fn metadata(&self) -> &Self::Ty {
        &self.metadata
    }

    fn metadata_mut(&mut self) -> &mut Self::Ty {
        &mut self.metadata
    }
}