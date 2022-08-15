pub(crate) mod common;
pub(crate) mod kubeclient;

mod kubectl;
mod metrics;
pub(crate) mod models;

use crate::kube::common::{dispatch_to_frontend, init_client};
use crate::kube::metrics::{get_all_pods, get_pod_metrics};
use crate::kube::models::{CommandResult, Metric};
use futures::{StreamExt, TryStreamExt};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::batch::v1::CronJob;
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, Pod, Secret, Service,
};
use kube::api::{LogParams, ObjectList};
use kube::config::{KubeConfigOptions, Kubeconfig};
use kube::{
    api::{Api, ListParams, ResourceExt},
    Client, Config, Error,
};
use kube::{
    api::{
        DeleteParams, PostParams, WatchEvent, AttachParams, AttachedProcess
    },
};
use tokio::io::AsyncWriteExt;
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::Receiver;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Window;
use tokio::time::{sleep, Duration};
use tracing_subscriber::fmt::format;

use crate::utils;

#[derive(Clone, serde::Serialize, Default)]
struct Payload {
    message: String,
    metadata: String,
}

impl Payload {
    fn new() -> Self {
        Default::default()
    }
}

#[derive(Clone, serde::Serialize, Default)]
pub struct EventHolder {
    pub(crate) event: String,
    pub(crate) data: String,
}

impl EventHolder {
    pub(crate) fn new() -> Self {
        Default::default()
    }
}

#[derive(Serialize, Default)]
pub struct KNamespace {
    pub name: String,
    pub creation_ts: Option<i64>,
}

impl KNamespace {
    fn new() -> Self {
        Default::default()
    }
}

pub fn get_kubectl_raw() {
    kubectl::get_metrics();
}

pub fn get_all_ns(window: &Window, client: Client, cmd: &str, custom_ns_list: Vec<KNamespace>) {
    _get_all_ns(window, cmd, client, custom_ns_list);
}

#[tokio::main]
async fn _get_all_ns(
    window: &Window,
    cmd: &str,
    client: Client,
    custom_ns_list: Vec<KNamespace>
) -> Result<Vec<KNamespace>, Box<dyn std::error::Error>> {
    let mut kns_list: Vec<KNamespace> = Vec::new();
    let ns_request: Api<Namespace> = Api::all(client);
    let ns_list = ns_request.list(&ListParams::default()).await?;
    for ns in ns_list {
        debug!("{:?}", ns);
        kns_list.push(KNamespace {
            name: ns.name_any(),
            creation_ts: None,
        })
    }
    for cns in custom_ns_list {
        kns_list.push(cns);
    }
    let json = serde_json::to_string(&kns_list).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(kns_list)
}


pub fn get_clusters(window: &Window) -> Kubeconfig {
    let kc = Kubeconfig::read();
    match kc {
        Ok(kc) => {
            kc
        },
            Err(e) => {
            println!("{}", e);
                let json = format!("Encountered error: {}. Check Kubeconfig file is available.", e);
                utils::send_error(&window, &json);
                Kubeconfig::default()
        }
    }
}

pub fn get_all_deployments(
    window: &Window,
    cluster: &str,
    namespace: &String,
    cmd: &str,
) -> ObjectList<Deployment> {
    let res = _get_all_deployments(window, cmd, cluster, namespace).unwrap();
    let json = serde_json::to_string(&res).unwrap();
    window
        .emit(
            "app::command_result",
            CommandResult {
                command: String::from(cmd),
                data: json,
            },
        )
        .unwrap();

    res
}

pub fn get_resource(window: &Window, cluster: &str, namespace: &String, kind: &String, cmd: &str) {
    if kind == "deployment" {
        _get_all_deployments(&window, cmd, cluster, namespace);
    } else if kind == "namespace" {
        // _get_all_ns(&window, cmd, cluster, Vec::new());
    } else if kind == "pod" {
        get_all_pods(&window, cmd, cluster, namespace);
    } else if kind == "podmetrics" {
        get_pod_metrics(&window, cmd, cluster, namespace);
    } else if kind == "node" {
        _get_all_nodes(&window, cmd, cluster);
        _get_all_node_metrics(&window, cmd, cluster);
    } else if kind == "cronjob" {
        _get_all_cron_jobs(&window, cmd, cluster, namespace);
    } else if kind == "configmap" {
        _get_all_config_maps(&window, cmd, cluster, namespace);
        _get_all_secrets(&window, cmd, cluster, namespace);
    } else if kind == "service" {
        _get_all_services(&window, cmd, cluster, namespace);
    } else if kind == "daemonset" {
        _get_all_daemon_sets(&window, cmd, cluster, namespace);
    } else if kind == "persistentvolume" {
        _get_all_persistent_volume(&window, cmd, cluster, namespace);
    } else if kind == "statefulset" {
        _get_all_stateful_sets(&window, cmd, cluster, namespace);
    }
}

#[tokio::main]
async fn _get_all_deployments(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<Deployment>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let deploy_request: Api<Deployment> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let deploys: ObjectList<Deployment> = deploy_request.list(&lp).await?;
    let json = serde_json::to_string(&deploys).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(deploys)
}

#[tokio::main]
async fn _get_all_services(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<Service>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Service> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let services: ObjectList<Service> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&services).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(services)
}

#[tokio::main]
async fn _get_all_config_maps(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<ConfigMap>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<ConfigMap> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let config_maps: ObjectList<ConfigMap> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&config_maps).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(config_maps)
}

#[tokio::main]
async fn _get_all_cron_jobs(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<CronJob>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<CronJob> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let cron_jobs: ObjectList<CronJob> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&cron_jobs).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(cron_jobs)
}

#[tokio::main]
async fn _get_all_secrets(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<Secret>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Secret> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<Secret> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&secrets).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_daemon_sets(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<DaemonSet>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<DaemonSet> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let daemon_sets: ObjectList<DaemonSet> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&daemon_sets).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(daemon_sets)
}

#[tokio::main]
async fn _get_all_replica_sets(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<ReplicaSet>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<ReplicaSet> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let replica_sets: ObjectList<ReplicaSet> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&replica_sets).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(replica_sets)
}

#[tokio::main]
async fn _get_all_stateful_sets(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<StatefulSet>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<StatefulSet> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let stateful_sets: ObjectList<StatefulSet> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&stateful_sets).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(stateful_sets)
}

#[tokio::main]
async fn _get_all_nodes(
    window: &Window,
    cmd: &str,
    cluster: &str,
) -> Result<ObjectList<Node>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Node> = Api::all(client.await.unwrap());

    let lp = ListParams::default();
    let nodes: ObjectList<Node> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&nodes).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(nodes)
}

#[tokio::main]
async fn _get_all_node_metrics(
    window: &Window,
    cmd: &str,
    cluster: &str,
) -> Result<ObjectList<Node>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Node> = Api::all(client.await.unwrap());

    let lp = ListParams::default();
    let nodes: ObjectList<Node> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&nodes).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(nodes)
}

#[tokio::main]
async fn _get_all_persistent_volume(
    window: &Window,
    cmd: &str,
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<PersistentVolume>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<PersistentVolume> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let persistent_volumes: ObjectList<PersistentVolume> = kube_request.list(&lp).await?;
    let json = serde_json::to_string(&persistent_volumes).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(persistent_volumes)
}

pub fn stream_cpu_memory_for_pod(
    window: Window,
    cluster: &str,
    pod: &str,
    ns: &str,
    rx: &Receiver<String>,
) {
    _stream_cpu_memory_for_pod(window, cluster, pod, ns, rx);
}

#[tokio::main]
async fn _stream_cpu_memory_for_pod(
    window: Window,
    cluster: &str,
    pod: &str,
    ns: &str,
    rx: &Receiver<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Fetching metrics for {:?}", pod);
    let client = init_client(cluster);

    let podMetrics: Api<crate::kube::metrics::PodMetrics> =
        Api::namespaced(client.await.unwrap(), ns);
    loop {
        let metrics = podMetrics.get(pod).await;
        let result = metrics.unwrap();
        let memory = &result
            .containers
            .as_ref()
            .unwrap()
            .get(0)
            .unwrap()
            .usage
            .memory;
        let cpu = &result
            .containers
            .as_ref()
            .unwrap()
            .get(0)
            .unwrap()
            .usage
            .cpu;
        let memory_string = format!("{:?}", memory)
            .replace("Quantity(\"", "")
            .replace("\")", "");
        let cpu_string = format!("{:?}", cpu)
            .replace("Quantity(\"", "")
            .replace("\")", "");
        debug!("Memory: {}, CPU: {}", memory_string, cpu_string);
        let since_the_epoch = SystemTime::now().duration_since(UNIX_EPOCH).unwrap();
        let metric = Metric {
            cpu: Some(cpu_string),
            memory: Some(memory_string),
            ts: since_the_epoch.as_millis(),
            pod: Some(pod.to_string()),
            metrics: None,
        };
        let json = serde_json::to_string(&metric).unwrap();
        window
            .emit(
                "app::metrics",
                Payload {
                    message: json,
                    metadata: String::from(pod),
                },
            )
            .unwrap();

        let stopword = rx.try_recv().unwrap_or("ERR".to_string());
        if stopword != "ERR" {
            debug!("Work is done: {:?}", stopword);
            break;
        }
        sleep(Duration::from_millis(5000)).await;
    }
    debug!("Completed task for streamin metrics");
    Ok(())
}

pub fn get_logs_for_pod(window: Window, cluster: &str, pod: &str, ns: &str) {
    _get_logs_for_pod(window, cluster, pod, ns);
}

#[tokio::main]
async fn _get_logs_for_pod(
    window: Window,
    cluster: &str,
    pod: &str,
    ns: &str,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Fetching logs for {:?}", pod);
    let client = init_client(cluster);
    let pods: Api<Pod> = Api::namespaced(client.await.unwrap(), ns);
    let mut logs = pods
        .log_stream(
            &pod,
            &LogParams {
                follow: false,
                tail_lines: Some(100),
                ..LogParams::default()
            },
        )
        .await?
        .boxed();

    debug!("Spawning task");
    while let Some(line) = logs.try_next().await? {
        let line_str = String::from_utf8_lossy(&line);
        debug!("{:?}", line_str);
        window
            .emit(
                "dashboard::logs",
                Payload {
                    message: line_str.to_string(),
                    metadata: String::from(pod),
                },
            )
            .unwrap();
    }
    debug!("Finished spawned task");
    Ok(())
}

#[tokio::main]
pub async fn get_deployment_details(deployment: &str) -> Result<Deployment, Error> {
    let client = Client::try_default().await?;
    let deploys: Api<Deployment> = Api::default_namespaced(client);
    let p1cpy = deploys.get(deployment).await?;
    Ok(p1cpy)
}