mod common;
mod kubectl;
mod metrics;
pub(crate) mod models;

use crate::kube::common::{dispatch_to_frontend, init_client};
use crate::kube::metrics::{get_all_pods, get_nodes_with_metrics, get_pod_metrics, get_pods_with_metrics, get_deployments_with_metrics};
use crate::kube::models::CommandResult;
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
use serde::Serialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::mpsc::Receiver;
use std::thread;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Window;
use tokio::time::{sleep, Duration};

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
pub struct Metric {
    pub(crate) cpu: String,
    pub(crate) memory: String,
    pub(crate) ts: u128,
    pod: String,
}

impl Metric {
    pub(crate) fn new() -> Self {
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
    pub creation_ts: i64,
}

impl KNamespace {
    fn new() -> Self {
        Default::default()
    }
}

pub fn restart_deployment(
    window: Window,
    cluster: &str,
    arg_map: HashMap<String, String>,
    cmd: &str,
) {
    let namespace = arg_map.get("ns").unwrap();
    let deployment = arg_map.get("deployment").unwrap();

    let result = _restart_deployment(cluster, namespace, deployment);
    match result {
        Ok(res) => {
            let json = "success";
            window
                .emit(
                    "app::command_result",
                    CommandResult {
                        command: String::from(cmd),
                        data: String::from(json),
                    },
                )
                .unwrap();
        }
        Err(err) => {
            error!("Failed to restart: {}", deployment);
            window
                .emit(
                    "app::error",
                    CommandResult {
                        command: String::from(cmd),
                        data: err.to_string(),
                    },
                )
                .unwrap();
        }
    }
}

#[tokio::main]
async fn _restart_deployment(
    cluster: &str,
    namespace: &str,
    deployment: &str,
) -> Result<Deployment, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let deploy_request: Api<Deployment> = Api::namespaced(client.await.unwrap(), namespace);
    let result = deploy_request.restart(deployment).await?;
    Ok(result)
}

pub fn get_kubectl_raw() {
    kubectl::get_metrics();
}

pub fn get_all_ns(window: &Window, cluster: &str, cmd: &str) {
    _get_all_ns(window, cmd, cluster);
}

#[tokio::main]
async fn _get_all_ns(
    window: &Window,
    cmd: &str,
    cluster: &str,
) -> Result<Vec<KNamespace>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let mut kns_list: Vec<KNamespace> = Vec::new();
    let ns_request: Api<Namespace> = Api::all(client.await.unwrap());
    let ns_list = ns_request.list(&ListParams::default()).await?;
    for ns in ns_list {
        debug!("{:?}", ns);
        kns_list.push(KNamespace {
            name: ns.name_any(),
            creation_ts: 0,
        })
    }
    let json = serde_json::to_string(&kns_list).unwrap();
    dispatch_to_frontend(window, cmd, json);
    Ok(kns_list)
}

pub fn get_clusters() -> Result<Kubeconfig, Error> {
    let kc = Kubeconfig::read().unwrap();
    Ok(kc)
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

pub fn get_resource_with_metrics(
    window: &Window,
    cluster: String,
    namespace: String,
    kind: String,
    cmd: String,
) {
    let window_copy1 = window.clone();
    let window_copy = window.clone();
    let cmd_copy = cmd.clone();
    let kind_copy = kind.clone();
    let ns_copy = namespace.clone();
    let cluster_copy = cluster.clone();
    if kind == "pod" {
        get_pods_with_metrics(&window_copy1, cluster.as_ref(), &namespace, &cmd);
    } else if kind == "node" {
        get_nodes_with_metrics(&window_copy1, cluster.as_ref(), &cmd);
    } else if kind == "deployment" {
        get_deployments_with_metrics(&window_copy1, cluster.as_ref(), &namespace, &cmd);
    }
    // let _ = get_resource(&window_copy1, cluster.as_ref(), &namespace, &kind, &cmd);
    // let hndl = thread::spawn(move || {
    // });
    // hndl.join();
    // let _ = get_metrics(&window_copy, &cluster_copy, &ns_copy, &kind_copy, &cmd_copy);
    // let mhndl = thread::spawn(move || {
    // });
}

pub fn get_resource(window: &Window, cluster: &str, namespace: &String, kind: &String, cmd: &str) {
    if kind == "deployment" {
        _get_all_deployments(&window, cmd, cluster, namespace);
    } else if kind == "namespace" {
        _get_all_ns(&window, cmd, cluster);
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
            cpu: cpu_string,
            memory: memory_string,
            ts: since_the_epoch.as_millis(),
            pod: pod.to_string(),
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

#[tokio::main]
pub async fn get_metrics_for_deployment(
    window: &Window,
    cluster: &str,
    ns: &String,
    deployment: &str,
    cmd: &str,
) {
    println!("Get Metrics for deployment");
    let metrics = _get_metrics_for_deployment(ns, cluster, deployment).await;
    match metrics {
        Ok(metrics) => {
            let json = serde_json::to_string(&metrics).unwrap();
            window
                .emit(
                    "app::command_result",
                    CommandResult {
                        command: String::from(cmd),
                        data: json,
                    },
                )
                .unwrap();
        }
        Err(err) => {
            println!("{}", err.to_string());
            utils::send_error(window, err.to_string());
        }
    };
}

async fn _get_metrics_for_deployment(
    ns: &String,
    cluster: &str,
    deployment: &str,
) -> Result<Vec<Metric>, Box<dyn std::error::Error>> {
    info!("Fetching metrics for {:?}", deployment);
    let pods = _get_pods_for_deployment(ns, cluster, deployment).await;
    let mut ret_metrics: Vec<Metric> = Vec::new();
    match pods {
        Ok(pods) => {
            for pod in pods {
                let client = init_client(cluster);
                let podMetrics: Api<crate::kube::metrics::PodMetrics> =
                    Api::namespaced(client.await.unwrap(), ns);
                let metrics = podMetrics.get(&pod.name_any()).await;
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
                    cpu: cpu_string,
                    memory: memory_string,
                    ts: since_the_epoch.as_millis(),
                    pod: pod.name_any(),
                };
                ret_metrics.push(metric);
            }
        }
        Err(err) => {
            println!("Failed to get metrics: {:?}", err);
        }
    }
    Ok(ret_metrics)
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

pub fn tail_logs_for_pod(
    window: Window,
    cluster: &str,
    pod: &str,
    ns: &str,
    rx: &Receiver<String>,
) {
    _tail_logs_for_pod(window, cluster, pod, ns, rx);
}

#[tokio::main]
async fn _tail_logs_for_pod(
    window: Window,
    cluster: &str,
    pod: &str,
    ns: &str,
    rx: &Receiver<String>,
) -> Result<(), Box<dyn std::error::Error>> {
    info!("Fetching logs for {:?}", pod);
    let client = init_client(cluster);
    let pods: Api<Pod> = Api::namespaced(client.await.unwrap(), ns);
    let mut logs = pods
        .log_stream(
            &pod,
            &LogParams {
                follow: true,
                tail_lines: Some(1),
                ..LogParams::default()
            },
        )
        .await?
        .boxed();

    debug!("Spawning task");
    while let Some(line) = logs.try_next().await? {
        let line_str = String::from_utf8_lossy(&line);
        debug!("{:?}", line_str);
        let stopword = rx.try_recv().unwrap_or("ERR".to_string());
        if stopword != "ERR" {
            debug!("Work is done: {:?}", stopword);
            break;
        }
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

#[tokio::main]
pub async fn get_pods_for_deployment_async(
    window: &Window,
    cluster: &str,
    ns: &String,
    deployment: &str,
    cmd: &str,
) {
    let pods = _get_pods_for_deployment(ns, cluster, deployment).await;
    match pods {
        Ok(pods) => {
            let json = serde_json::to_string(&pods).unwrap();
            window
                .emit(
                    "app::command_result",
                    CommandResult {
                        command: String::from(cmd),
                        data: json,
                    },
                )
                .unwrap();
        }
        Err(err) => {
            println!("{}", err.to_string());
            utils::send_error(window, err.to_string());
        }
    };
}

#[tokio::main]
pub async fn get_pods_for_deployment(
    ns: &String,
    cluster: &str,
    deployment: &str,
) -> Result<Vec<Pod>, Error> {
    _get_pods_for_deployment(ns, cluster, deployment).await
}

async fn _get_pods_for_deployment(
    ns: &String,
    cluster: &str,
    deployment: &str,
) -> Result<Vec<Pod>, Error> {
    let client = init_client(cluster);
    let deploy_request: Api<Deployment> = Api::namespaced(client.await.unwrap(), ns);
    let d = deploy_request.get(deployment).await?;
    let mut pods_for_deployments: Vec<Pod> = Vec::new();
    if let Some(spec) = d.spec {
        if let Some(match_labels) = spec.selector.match_labels {
            let pclient = Client::try_default().await?;
            let pod_request: Api<Pod> = Api::namespaced(pclient, ns);
            debug!("Spec:: {:?}", match_labels);
            for lbl in match_labels {
                match lbl {
                    (key, value) => {
                        debug!("Label selector:: {:?}", value);
                        let label = format!("{}={}", key.as_str(), value.as_str());
                        let lp = ListParams::default().labels(label.as_str());
                        let pods = pod_request.list(&lp).await?;
                        debug!("Total pods found {:?}", pods.items.len());
                        for pod in pods {
                            pods_for_deployments.push(pod);
                        }
                    }
                }
            }
        }
    }
    return Ok(pods_for_deployments);
}
