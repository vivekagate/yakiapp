use std::collections::HashMap;
use std::env;
use std::path::Path;
use std::sync::mpsc::Receiver;
use std::time::{SystemTime, UNIX_EPOCH};
use futures::{StreamExt, TryStreamExt};
use kube::config::{Kubeconfig, KubeConfigOptions};
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, Pod, Secret, Service,
};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use kube::{
    api::{Api, ListParams, ResourceExt},
    Client, Config, Error
};
use kube::{
    api::{
        DeleteParams, PostParams, WatchEvent, AttachParams, AttachedProcess
    },
};
use kube::api::{LogParams, ObjectList};
use kube::client::ConfigExt;
use kube::client::middleware::BaseUriLayer;
use tauri::http::Uri;
use tauri::Window;
use crate::{CommandResult, KNamespace};
use crate::kube::common::dispatch_to_frontend;
use crate::kube::metrics::{PodMetrics};
use crate::kube::models::{Metric, NodeMetrics, ResourceWithMetricsHolder};
use crate::kube::{Payload};
use tokio::time::{sleep, Duration};
use crate::utils::send_error;


pub struct KubeClientManager {
    cluster: String,
    kubeconfigfile: String,
    proxy_url: Option<String>,
}

impl KubeClientManager {
    pub fn clone(&self) -> Self {
        KubeClientManager {
            cluster: self.cluster.clone(),
            kubeconfigfile: self.kubeconfigfile.clone(),
            proxy_url: None
        }
    }

    pub fn initialize() -> KubeClientManager {
        KubeClientManager {
            cluster: "".to_string(),
            kubeconfigfile: "".to_string(),
            proxy_url: Some("".to_string())
        }
    }

    pub fn initialize_from(file: String, proxy_url: Option<String>) -> KubeClientManager {
        KubeClientManager {
            cluster: "".to_string(),
            kubeconfigfile: file,
            proxy_url
        }
    }

    pub fn set_cluster(&mut self, cl: &str) {
        self.cluster = cl.to_string();
    }

    pub fn set_kubeconfig_file(&mut self, file: &str) {
        self.kubeconfigfile = file.to_string();
    }

    async fn init_client(&self) -> Option<Client> {
        if self.cluster.len() > 0 {
            let kco = KubeConfigOptions {
                context: Some(self.cluster.parse().unwrap()),
                cluster: Some(self.cluster.parse().unwrap()),
                user: Some(self.cluster.parse().unwrap()),
            };
            let mut kc = Kubeconfig::read().unwrap();
            debug!("Loading custom Kubeconfig: {}", self.kubeconfigfile);
            if self.kubeconfigfile.len() > 0 {
                //TODO Check if file present
                kc = Kubeconfig::read_from(Path::new(&self.kubeconfigfile)).unwrap();
            }

            if let Some(url) = &self.proxy_url {
                if url.len() > 0 {
                    if url.starts_with("http:") {
                        std::env::set_var("HTTP_PROXY", url);
                    }else if url.starts_with("https:") {
                        std::env::set_var("HTTPS_PROXY", url);
                    }else{
                        std::env::set_var("HTTP_PROXY", url);
                    }
                }
            }

            let config = Config::from_custom_kubeconfig(kc, &kco).await;
            let res = Client::try_from(config.unwrap());
            let client = match res {
                Ok(cl) => {
                    Some(cl)
                },
                _ => {
                    println!("Failed to find kubeconfig file");
                    None
                }
            };
            client
        } else {
            if self.kubeconfigfile.len() > 0 {
                //TODO Check if file present
                let kc = Kubeconfig::read_from(Path::new(&self.kubeconfigfile)).unwrap();
            }
            let res = Client::try_default().await;
            match res {
                Ok(cl) => {
                    Some(cl)
                },
                _ => {
                    println!("Failed to find kubeconfig file");
                    None
                }
            }
        }
    }

    pub fn get_all_ns(&self, window: &Window, cmd: &str, custom_ns_list: Vec<KNamespace>) {
        self._get_all_ns(window, cmd, custom_ns_list);
    }

    #[tokio::main]
    async fn _get_all_ns(
        &self,
        window: &Window,
        cmd: &str,
        custom_ns_list: Vec<KNamespace>
    ) -> Result<Vec<KNamespace>, Box<dyn std::error::Error>> {
        let mut kns_list: Vec<KNamespace> = Vec::new();
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let ns_request: Api<Namespace> = Api::all(client);
                let ns_list = ns_request.list(&ListParams::default()).await?;
                for ns in ns_list {
                    debug!("{:?}", ns);
                    kns_list.push(KNamespace {
                        creation_ts: None,
                        name: ns.name_any()
                    })
                }
                for cns in custom_ns_list {
                    kns_list.push(cns);
                }
                let json = serde_json::to_string(&kns_list).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(kns_list)
            },
            None => {
                Ok(Vec::new())
            }
        }
    }

    pub fn get_resource_with_metrics(
        &self,
        window: &Window,
        namespace: String,
        kind: String,
        cmd: String,
    ) {
        let window_copy1 = window.clone();
        if kind == "pod" {
            self._get_pods_with_metrics(&window_copy1, &namespace, &cmd);
        } else if kind == "node" {
            self._get_nodes_with_metrics(&window_copy1, &cmd);
        } else if kind == "deployment" {
            self._get_deployments_with_metrics(&window_copy1, &namespace, &cmd);
        }
    }

    pub fn stream_cpu_memory_for_deployment(
        &self,
        window: &Window,
        ns: String,
        deployment: String,
        rx: &Receiver<String>,
    ) {
        self._stream_cpu_memory_for_deployment(window, &ns, &deployment,rx);
    }

    #[tokio::main]
    async fn _stream_cpu_memory_for_deployment(
        &self,
        window: &Window,
        ns: &String,
        deployment: &String,
        rx: &Receiver<String>,
    ) -> Result<(), Box<dyn std::error::Error>>{
        info!("Fetching metrics for {:?}", deployment);
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let pod_client = client.clone();
                let mp_kube_request: Api<PodMetrics> = Api::namespaced(client, ns);
                let lp = ListParams::default();
                let p_kube_request: Api<Pod> = Api::namespaced(pod_client, ns);

                loop {
                    let metrics = mp_kube_request.list(&lp).await?;
                    let lp = ListParams::default();
                    let pods = p_kube_request.list(&lp).await?;

                    let metrics = ResourceWithMetricsHolder {
                        resource: String::from(deployment),
                        metrics: serde_json::to_string(&metrics).unwrap(),
                        usage: Some(serde_json::to_string(&pods).unwrap()),
                        metrics2: None,
                        ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
                    };
                    let json = serde_json::to_string(&metrics).unwrap();
                    window
                        .emit(
                            "app::metrics",
                            Payload {
                                message: json,
                                metadata: String::from(deployment),
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

            },
            None => {()}
        }
        debug!("Completed task for streamin metrics");
        Ok(())
    }

    #[tokio::main]
    async fn _get_pods_with_metrics(
        &self,
        window: &Window,
        namespace: &String,
        cmd: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let metrics_client = client.clone();
                let kube_request: Api<Pod> = Api::namespaced(client, namespace);

                let lp = ListParams::default();
                let pods: ObjectList<Pod> = kube_request.list(&lp).await?;

                let m_kube_request: Api<PodMetrics> = Api::namespaced(metrics_client, namespace);
                let lp = ListParams::default();
                let metrics = m_kube_request.list(&lp).await?;
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&pods).unwrap(),
                    metrics: serde_json::to_string(&metrics).unwrap(),
                    usage: None,
                    metrics2: None,
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
                };
                dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
                Ok(())
            },
            None => {
                Ok(())
            }
        }
    }

    #[tokio::main]
    async fn _get_nodes_with_metrics(
        &self,
        window: &Window,
        cmd: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;

        match client {
            Some(client) => {
                let metrics_client = client.clone();
                let kube_request: Api<Node> = Api::all(client);

                let lp = ListParams::default();
                let nodes: ObjectList<Node> = kube_request.list(&lp).await?;

                let m_kube_request: Api<NodeMetrics> = Api::all(metrics_client);
                let lp = ListParams::default();
                let metrics = m_kube_request.list(&lp).await?;
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&nodes).unwrap(),
                    metrics: serde_json::to_string(&metrics).unwrap(),
                    usage: None,
                    metrics2: None,
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
                };
                let result = serde_json::to_string(&json).unwrap();
                dispatch_to_frontend(window, cmd, result);
                Ok(())
            },
            None => {
                Ok(())
            }
        }
    }

    #[tokio::main]
    async fn _get_deployments_with_metrics(
        &self,
        window: &Window,
        namespace: &String,
        cmd: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let metrics_client = client.clone();
                let pod_metrics_client = client.clone();
                let pod_client = client.clone();
                let kube_request: Api<Deployment> = Api::namespaced(client, namespace);

                let lp = ListParams::default();
                let deployments: ObjectList<Deployment> = kube_request.list(&lp).await?;

                let m_kube_request: Api<PodMetrics> = Api::namespaced(metrics_client, namespace);
                let lp = ListParams::default();
                let metrics = m_kube_request.list(&lp).await?;

                let p_kube_request: Api<Pod> = Api::namespaced(pod_client, namespace);
                let lp = ListParams::default();
                let pods = p_kube_request.list(&lp).await?;

                let mp_kube_request: Api<PodMetrics> = Api::namespaced(pod_metrics_client, namespace);
                let lp = ListParams::default();
                let pod_metrics = mp_kube_request.list(&lp).await?;

                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&deployments).unwrap(),
                    metrics: serde_json::to_string(&metrics).unwrap(),
                    usage: Some(serde_json::to_string(&pods).unwrap()),
                    metrics2: Some(serde_json::to_string(&pod_metrics).unwrap()),
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis()
                };
                dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
                Ok(())
            },
                None => {Ok(())}
        }
    }

    #[tokio::main]
    pub async fn get_pods_for_deployment(
        &self,
        ns: &String,
        deployment: &str,
    ) -> Result<Vec<Pod>, Error> {
        self._get_pods_for_deployment(ns, deployment).await
    }

    async fn _get_pods_for_deployment(&self,
        ns: &String,
        deployment: &str,
    ) -> Result<Vec<Pod>, Error> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let pclient = client.clone();
                let deploy_request: Api<Deployment> = Api::namespaced(client, ns);
                let d = deploy_request.get(deployment).await?;
                let mut pods_for_deployments: Vec<Pod> = Vec::new();
                if let Some(spec) = d.spec {
                    if let Some(match_labels) = spec.selector.match_labels {
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
            },
            None => {Ok(Vec::new())}
        }
    }

    pub fn tail_logs_for_pod(
        &self,
        window: Window,
        pod: &str,
        ns: &str,
        rx: &Receiver<String>,
    ) {
        self._tail_logs_for_pod(window,  pod, ns, rx);
    }

    #[tokio::main]
    async fn _tail_logs_for_pod(
        &self,
        window: Window,
        pod: &str,
        ns: &str,
        rx: &Receiver<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!("Fetching logs for {:?}", pod);
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let pods: Api<Pod> = Api::namespaced(client, ns);
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
            },
                None => Ok(())
        }
    }

    pub fn get_environment_variables(&self, window: &Window, podname: &str, ns: &str, cmd: &str) {
        self._get_environment_variables(window, podname, ns, cmd);
    }

    #[tokio::main]
    async fn _get_environment_variables(
        &self,
        window: &Window,
        podname: &str,
        ns: &str,
        cmd: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let pods: Api<Pod> = Api::namespaced(client, ns);
                let mut attached = pods
                    .exec(podname, vec!["env"], &AttachParams::default().stderr(false))
                    .await?;
                let stdout = tokio_util::io::ReaderStream::new(attached.stdout().unwrap());
                let output = stdout
                    .filter_map(|r| async { r.ok().and_then(|v| String::from_utf8(v.to_vec()).ok()) })
                    .collect::<Vec<_>>()
                    .await
                    .join("");
                attached.join().await.unwrap();
                let mut map: HashMap<&str, &str> = HashMap::new();
                for kvp in output.split("\n") {
                    if !kvp.trim().is_empty() {
                        let mut kv = kvp.split("=");
                        map.insert(kv.next().unwrap(), kv.next().unwrap());
                    }
                }
                let result = serde_json::to_string(&map).unwrap();
                dispatch_to_frontend(window, cmd, result);
                Ok(())
            },
                None => Ok(())
        }
    }


    pub fn restart_deployment(
        &self,
        window: &Window,
        ns: &String,
        deployment: &String,
        cmd: &str,
    ) {
        let result = self._restart_deployment(window, ns, deployment, cmd);
        match result {
            Ok(res) => {

            }
            Err(err) => {
                error!("Failed to restart: {}", deployment);
                send_error(window, "Failed to restart. Reason: ".to_string());
            }
        }
    }

    #[tokio::main]
    async fn _restart_deployment(
        &self,
        window: &Window,
        namespace: &str,
        deployment: &str,
        cmd: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let deploy_request: Api<Deployment> = Api::namespaced(client, namespace);
                let result = deploy_request.restart(deployment).await?;
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
                Ok(())
            },
            None => {
                send_error(window, "Failed to restart. Reason Kubeclient failed.".to_string());
                Ok(())
            }
        }
    }

}