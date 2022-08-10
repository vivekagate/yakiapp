use crate::kube::_get_all_node_metrics;
use crate::kube::common::{dispatch_to_frontend, init_client};
use crate::kube::models::{NodeMetrics, ResourceWithMetricsHolder};
use futures::FutureExt;
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, Pod, Secret, Service,
};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;
use k8s_openapi::{ClusterResourceScope, NamespaceResourceScope};
use kube::api::{ListParams, ObjectList, ObjectMeta};
use kube::config::{KubeConfigOptions, Kubeconfig};
use kube::{Api, Client, Config};
use std::collections::HashMap;
use std::error::Error;
use std::thread;
use tauri::async_runtime::JoinHandle;
use tauri::Window;

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct PodMetricsContainer {
    pub name: String,
    pub usage: PodMetricsContainerUsage,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug)]
pub struct PodMetricsContainerUsage {
    pub cpu: Quantity,
    pub memory: Quantity,
}

#[derive(serde::Deserialize, serde::Serialize, Clone, Debug, Default)]
pub struct PodMetrics {
    pub metadata: ObjectMeta,
    pub timestamp: Option<String>,
    pub window: Option<String>,
    pub containers: Option<Vec<PodMetricsContainer>>,
}

impl k8s_openapi::Resource for PodMetrics {
    const API_VERSION: &'static str = "metrics.k8s.io/v1beta1";
    const GROUP: &'static str = "metrics.k8s.io";
    const KIND: &'static str = "pod";
    const VERSION: &'static str = "v1beta1";
    const URL_PATH_SEGMENT: &'static str = "pods";
    type Scope = NamespaceResourceScope;
}

impl k8s_openapi::Metadata for PodMetrics {
    type Ty = ObjectMeta;

    fn metadata(&self) -> &Self::Ty {
        &self.metadata
    }

    fn metadata_mut(&mut self) -> &mut Self::Ty {
        &mut self.metadata
    }
}

pub fn get_all_pods(window: &Window, cmd: &str, cluster: &str, namespace: &String) {
    _get_all_pods(window, cmd, cluster, namespace);
}

pub fn get_pod_metrics(window: &Window, cmd: &str, cluster: &str, namespace: &String) {
    _get_metrics(window, cmd, cluster, namespace);
}

#[tokio::main]
async fn _get_all_pods(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Pod> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let pods: ObjectList<Pod> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&pods).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(())
}

#[tokio::main]
async fn _get_metrics(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<(), Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<PodMetrics> = Api::namespaced(client.await.unwrap(), namespace);
    let lp = ListParams::default();
    let metrics = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&metrics).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(())
}
