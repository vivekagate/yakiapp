mod metrics;

use futures::{StreamExt, TryStreamExt};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::core::v1::{ConfigMap, Namespace, Node, PersistentVolume, Pod, Secret, Service};
use k8s_openapi::api::batch::v1::CronJob;
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
pub struct DeploymentHolder {
    pub deployment: Deployment,
}

impl DeploymentHolder {
    fn new() -> Self {
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

async fn init_client(cluster: &str) -> Result<Client, Error> {
    if cluster.len() > 0 {
        let kco = KubeConfigOptions {
            context: Some(cluster.parse().unwrap()),
            cluster: Some(cluster.parse().unwrap()),
            user: Some(cluster.parse().unwrap()),
        };
        let kc = Kubeconfig::read().unwrap();
        let config = Config::from_custom_kubeconfig(kc, &kco).await;
        let client = Client::try_from(config.unwrap());
        client
    } else {
        Client::try_default().await
    }
}

pub fn get_all_ns(window: &Window, cluster: &str, cmd: &str) {
    let res = _get_all_ns(cluster);
    match res {
        Ok(res) => {
            let json = serde_json::to_string(&res).unwrap();
            debug!("Retrieve all namespaces: {}", json);
            &window
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
            debug!("Failed to retrieve namespace: {}", err);
            utils::send_error(window, err.to_string());
        }
    }
}

#[tokio::main]
async fn _get_all_ns(cluster: &str) -> Result<Vec<KNamespace>, Box<dyn std::error::Error>> {
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
) -> Vec<DeploymentHolder> {
    let res = _get_all_deployments(cluster, namespace).unwrap();
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
    let mut json = "".parse().unwrap();
    if kind == "deployment" {
        let res = _get_all_deployments(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "namespace" {
        let res = _get_all_ns(cluster).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "pod" {
        let res = _get_all_pods(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "node" {
        let res = _get_all_nodes(cluster).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "cronjob" {
        let res = _get_all_cron_jobs(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "service" {
        let res = _get_all_services(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "daemonset" {
        let res = _get_all_daemon_sets(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "persistentvolume" {
        let res = _get_all_persistent_volume(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    } else if kind == "statefulset" {
        let res = _get_all_stateful_sets(cluster, namespace).unwrap();
        json = serde_json::to_string(&res).unwrap();
    }
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

pub fn populate_deployments(window: &Window, namespace: &String, deploys: Vec<DeploymentHolder>) {
    _populate_deployments(window, namespace, deploys);
}

#[tokio::main]
async fn _populate_deployments(
    window: &Window,
    ns: &String,
    deploys: Vec<DeploymentHolder>,
) -> Result<(), Box<dyn std::error::Error>> {
    // for mut d in deploys {
    //   if d.available_replicas < d.replicas || d.unavailable_replicas > 0 {
    //     let pclient = Client::try_default().await?;
    //     let pod_request: Api<Pod> = Api::namespaced(pclient, ns);
    //     for (key, value) in &d.match_labels {
    //       debug!("Label selector:: {:?}", value);
    //       let label = format!("{}={}", key, value);
    //       let lp = ListParams::default().labels(label.as_str());
    //       let pods = pod_request.list(&lp).await?;
    //       debug!("Total pods found {:?}", pods.items.len());
    //       for pod in pods {
    //         if let Some(ref container_statuses) = pod.status.unwrap().container_statuses {
    //           for status in container_statuses {
    //             if let Some(ref state) = status.state {
    //               if let Some(waiting) = &state.waiting {
    //                 if let Some(reason) = &waiting.reason {
    //                   debug!("PODS CONTAINER STATUSES::::{:?}", reason);
    //                   d.reason = reason.to_string();
    //                   break;
    //                 }
    //               }
    //             }
    //           }
    //         }
    //       }
    //     }
    //     let json = serde_json::to_string(&d).unwrap();
    //     window.emit("app::status_update", CommandResult{
    //       command: "".to_string(),
    //       data: json
    //     }).unwrap();
    //   }
    // }
    Ok(())
}

#[tokio::main]
async fn _get_all_deployments(
    cluster: &str,
    namespace: &String,
) -> Result<Vec<DeploymentHolder>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let deploy_request: Api<Deployment> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let mut deploys: Vec<DeploymentHolder> = Vec::new();
    for p in deploy_request.list(&lp).await? {
        if let Some(ref status) = p.status {
            debug !("Found Deployment: {}, Replicas: {:?}, Ready Replicas: {:?}, Unavailable Replicas: {:?}", p.name_any(), status.replicas, status.ready_replicas, status.unavailable_replicas);
            deploys.push(DeploymentHolder { deployment: p });
        }
    }
    Ok(deploys)
}

#[tokio::main]
async fn _get_all_pods(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<Pod>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Pod> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let pods: ObjectList<Pod> = kube_request.list(&lp).await?;
    Ok(pods)
}

#[tokio::main]
async fn _get_all_services(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<Service>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Service> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<Service> = kube_request.list(&lp).await?;
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_config_maps(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<ConfigMap>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<ConfigMap> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let config_maps: ObjectList<ConfigMap> = kube_request.list(&lp).await?;
    Ok(config_maps)
}

#[tokio::main]
async fn _get_all_cron_jobs(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<CronJob>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<CronJob> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let config_maps: ObjectList<CronJob> = kube_request.list(&lp).await?;
    Ok(config_maps)
}

#[tokio::main]
async fn _get_all_secrets(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<Secret>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Secret> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<Secret> = kube_request.list(&lp).await?;
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_daemon_sets(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<DaemonSet>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<DaemonSet> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<DaemonSet> = kube_request.list(&lp).await?;
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_replica_sets(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<ReplicaSet>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<ReplicaSet> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<ReplicaSet> = kube_request.list(&lp).await?;
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_stateful_sets(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<StatefulSet>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<StatefulSet> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<StatefulSet> = kube_request.list(&lp).await?;
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_nodes(
    cluster: &str,
) -> Result<ObjectList<Node>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<Node> = Api::all(client.await.unwrap());

    let lp = ListParams::default();
    let secrets: ObjectList<Node> = kube_request.list(&lp).await?;
    Ok(secrets)
}

#[tokio::main]
async fn _get_all_persistent_volume(
    cluster: &str,
    namespace: &String,
) -> Result<ObjectList<PersistentVolume>, Box<dyn std::error::Error>> {
    let client = init_client(cluster);
    let kube_request: Api<PersistentVolume> = Api::namespaced(client.await.unwrap(), namespace);

    let lp = ListParams::default();
    let secrets: ObjectList<PersistentVolume> = kube_request.list(&lp).await?;
    Ok(secrets)
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
        let memory = &result.containers.get(0).unwrap().usage.memory;
        let cpu = &result.containers.get(0).unwrap().usage.cpu;
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
                let memory = &result.containers.get(0).unwrap().usage.memory;
                let cpu = &result.containers.get(0).unwrap().usage.cpu;
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
