use std::collections::HashMap;
use std::env;
use std::path::Path;
use std::pin::Pin;
use std::sync::mpsc::Receiver;
use std::time::{SystemTime, UNIX_EPOCH};
use futures::{StreamExt, TryStreamExt};
use kube::config::{Kubeconfig, KubeConfigOptions};
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, Pod, Secret, Service,
};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::autoscaling::v1::{HorizontalPodAutoscaler};
use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::{CustomResourceDefinition};
use k8s_openapi::{NamespaceResourceScope, Resource};
use k8s_openapi::api::batch::v1::CronJob;
use kube::{api::{Api, ListParams, ResourceExt, DynamicObject}, Client, Config, Discovery, Error};
use kube::{
    api::{
        DeleteParams, PostParams, WatchEvent, AttachParams, AttachedProcess, ObjectMeta
    },
};
use kube::api::{LogParams, ObjectList, Patch, PatchParams};
use kube::core::{GroupVersionKind};
use kube::discovery::ApiResource;
use tauri::Window;
use tokio::io::{AsyncWrite, AsyncWriteExt};
use crate::{CommandResult, KNamespace, utils};
use crate::kube::common::dispatch_to_frontend;
use crate::kube::metrics::{PodMetrics};
use crate::kube::models::{Metric, NodeMetrics, ResourceWithMetricsHolder};
use crate::kube::{models, Payload};
use tokio::time::{sleep, Duration};
use crate::utils::send_error;
use tokio::io;
use std::task::Context;
use std::task::Poll;
use tokio::io::{AsyncRead};

pub struct KubeClientManager {
    cluster: String,
    kubeconfigfile: String,
    proxy_url: Option<String>,
    is_metrics_server_running: bool
}

impl KubeClientManager {
    pub fn set_metrics_server(
        &mut self,
        val: bool
    ){
        self.is_metrics_server_running = val;
    }

    pub fn clone(&self) -> Self {
        KubeClientManager {
            cluster: self.cluster.clone(),
            kubeconfigfile: self.kubeconfigfile.clone(),
            proxy_url: None,
            is_metrics_server_running: self.is_metrics_server_running
        }
    }

    pub fn initialize() -> KubeClientManager {
        KubeClientManager {
            cluster: "".to_string(),
            kubeconfigfile: "".to_string(),
            proxy_url: Some("".to_string()),
            is_metrics_server_running: false
        }
    }

    pub fn initialize_from(file: String, proxy_url: Option<String>) -> KubeClientManager {
        let current_cluster = _get_current_cluster(&file);
        let mut km = KubeClientManager {
            cluster: "".to_string(),
            kubeconfigfile: file,
            is_metrics_server_running: false,
            proxy_url
        };
        km.set_cluster(&current_cluster);
        km
    }

    pub fn set_cluster(&mut self, cl: &str) {
        self.cluster = cl.to_string();
        self._check_metrics_server();
    }

    pub fn set_kubeconfig_file(&mut self, file: &str) {
        self.kubeconfigfile = file.to_string();
    }

    fn get_api<T>(&self, client: Client, ns: &str) -> Api<T> where T: Resource + k8s_openapi::Metadata<Ty = ObjectMeta>{
        if ns == "*All*" {
            return Api::all(client);
        }
        Api::namespaced(client, ns)
    }

    #[tokio::main]
    async fn _check_metrics_server(&mut self) -> Result<(), Error>{
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<Deployment> = self.get_api(client, "kube-system");

                let lp = ListParams::default();
                let deployments: ObjectList<Deployment> = kube_request.list(&lp).await?;
                for deploy in deployments {
                    if !deploy.name_any().contains("metrics-server") {
                        continue;
                    }
                    if let Some(status) = deploy.status {
                        if let Some(ready_replicas) = status.ready_replicas {
                            if ready_replicas > 0 {
                                self.is_metrics_server_running = true;
                            }
                        }
                    }
                }
                Ok(())
            },
            None => {
                println!("Failed to initialize client. No metrics available");
                self.is_metrics_server_running = false;
                Ok(())
            }
        }
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
        kns_list.push(KNamespace {
            name: "*All*".to_string(),
            creation_ts: None
        });
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
        kind: &str,
        cmd: String,
    ) {
        let window_copy1 = window.clone();
        if kind.eq("pod")  {
            self._get_pods_with_metrics(&window_copy1, &namespace, &cmd);
        } else if kind.eq("node") {
            self._get_nodes_with_metrics(&window_copy1, &cmd);
        } else if kind.eq( "deployment") {
            self._get_deployments_with_metrics(&window_copy1, &namespace, &cmd);
        } else if kind.eq("namespace") {
            self._get_namespaces_with_metrics(&window_copy1, &cmd);
        } else if kind.eq("service") {
            self._get_services_with_metrics(&window_copy1, &namespace, &cmd);
        } else if kind.eq("hpa") {
            self._get_hpas_with_metrics(&window_copy1, &namespace, &cmd);
        } else if kind.eq("customresourcedefinition") {
            self._get_crds_with_metrics(&window_copy1, &namespace, &cmd);
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
                let mp_kube_request: Api<PodMetrics> = self.get_api(client, ns);
                let lp = ListParams::default();
                let p_kube_request: Api<Pod> = self.get_api(pod_client, ns);

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
                let kube_request: Api<Pod> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let pods: ObjectList<Pod> = kube_request.list(&lp).await?;

                let mut metrics_val = "".to_string();
                if self.is_metrics_available() {
                    let m_kube_request: Api<PodMetrics> = self.get_api(metrics_client, namespace);
                    let lp = ListParams::default();
                    let metrics = m_kube_request.list(&lp).await?;
                    metrics_val = serde_json::to_string(&metrics).unwrap();
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&pods).unwrap(),
                    metrics: metrics_val,
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

                let mut metrics_val = "".to_string();
                if self.is_metrics_available() {
                    let m_kube_request: Api<NodeMetrics> = Api::all(metrics_client);
                    let lp = ListParams::default();
                    let metrics = m_kube_request.list(&lp).await?;
                    metrics_val = serde_json::to_string(&metrics).unwrap();
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&nodes).unwrap(),
                    metrics: metrics_val,
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

    fn is_metrics_available(&self) -> bool {
        return self.is_metrics_server_running;
    }

    #[tokio::main]
    async fn _get_namespaces_with_metrics(
        &self,
        window: &Window,
        cmd: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let metrics_client = client.clone();
                let pod_metrics_client = client.clone();
                let pod_client = client.clone();
                let kube_request: Api<Namespace> = self.get_api(client, "*All*");

                let lp = ListParams::default();
                let namespaces: ObjectList<Namespace> = kube_request.list(&lp).await?;
                // let p_kube_request: Api<Pod> = Api::namespaced(pod_client, namespace);
                // let lp = ListParams::default();
                // let pods = p_kube_request.list(&lp).await?;

                let metrics_val = "".to_string();
                let metrics2 = None;
                if self.is_metrics_available() {
                    // let m_kube_request: Api<PodMetrics> = Api::namespaced(metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let metrics = m_kube_request.list(&lp).await?;
                    //
                    // let mp_kube_request: Api<PodMetrics> = Api::namespaced(pod_metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let pod_metrics = mp_kube_request.list(&lp).await?;
                    //
                    // metrics_val = serde_json::to_string(&metrics).unwrap();
                    // metrics2 = Some(serde_json::to_string(&pod_metrics).unwrap());
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&namespaces).unwrap(),
                    usage: None,
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis(),
                    metrics: metrics_val,
                    metrics2,
                };
                dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
                Ok(())
            },
            None => {Ok(())}
        }
    }

    #[tokio::main]
    async fn _get_services_with_metrics(
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
                let kube_request: Api<Service> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let services: ObjectList<Service> = kube_request.list(&lp).await?;

                // let p_kube_request: Api<Pod> = self.get_api(pod_client, namespace);
                // let lp = ListParams::default();
                // let pods = p_kube_request.list(&lp).await?;

                let mut metrics_val = "".to_string();
                let mut metrics2 = None;
                if self.is_metrics_available() {
                    // debug!("Retrieving metrics for deployment");
                    // let m_kube_request: Api<PodMetrics> = self.get_api(metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let metrics = m_kube_request.list(&lp).await?;
                    //
                    // let mp_kube_request: Api<PodMetrics> = self.get_api(pod_metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let pod_metrics = mp_kube_request.list(&lp).await?;
                    //
                    // metrics_val = serde_json::to_string(&metrics).unwrap();
                    // metrics2 = Some(serde_json::to_string(&pod_metrics).unwrap());
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&services).unwrap(),
                    usage: None,
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis(),
                    metrics: metrics_val,
                    metrics2,
                };
                dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
                Ok(())
            },
            None => {Ok(())}
        }
    }

    #[tokio::main]
    async fn _get_hpas_with_metrics(
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
                let kube_request: Api<HorizontalPodAutoscaler> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let services: ObjectList<HorizontalPodAutoscaler> = kube_request.list(&lp).await?;

                // let p_kube_request: Api<Pod> = self.get_api(pod_client, namespace);
                // let lp = ListParams::default();
                // let pods = p_kube_request.list(&lp).await?;

                let mut metrics_val = "".to_string();
                let mut metrics2 = None;
                if self.is_metrics_available() {
                    // debug!("Retrieving metrics for deployment");
                    // let m_kube_request: Api<PodMetrics> = self.get_api(metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let metrics = m_kube_request.list(&lp).await?;
                    //
                    // let mp_kube_request: Api<PodMetrics> = self.get_api(pod_metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let pod_metrics = mp_kube_request.list(&lp).await?;
                    //
                    // metrics_val = serde_json::to_string(&metrics).unwrap();
                    // metrics2 = Some(serde_json::to_string(&pod_metrics).unwrap());
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&services).unwrap(),
                    usage: None,
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis(),
                    metrics: metrics_val,
                    metrics2,
                };
                dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
                Ok(())
            },
            None => {Ok(())}
        }
    }

    #[tokio::main]
    async fn _get_crds_with_metrics(
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
                let kube_request: Api<CustomResourceDefinition> = self.get_api(client, "*All*");

                let lp = ListParams::default();
                let crds: ObjectList<CustomResourceDefinition> = kube_request.list(&lp).await?;

                let mut metrics_val = "".to_string();
                let mut metrics2 = None;
                if self.is_metrics_available() {
                    // debug!("Retrieving metrics for deployment");
                    // let m_kube_request: Api<PodMetrics> = self.get_api(metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let metrics = m_kube_request.list(&lp).await?;
                    //
                    // let mp_kube_request: Api<PodMetrics> = self.get_api(pod_metrics_client, namespace);
                    // let lp = ListParams::default();
                    // let pod_metrics = mp_kube_request.list(&lp).await?;
                    //
                    // metrics_val = serde_json::to_string(&metrics).unwrap();
                    // metrics2 = Some(serde_json::to_string(&pod_metrics).unwrap());
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&crds).unwrap(),
                    usage: None,
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis(),
                    metrics: metrics_val,
                    metrics2,
                };
                dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
                Ok(())
            },
            None => {Ok(())}
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
                let kube_request: Api<Deployment> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let deployments: ObjectList<Deployment> = kube_request.list(&lp).await?;

                let p_kube_request: Api<Pod> = self.get_api(pod_client, namespace);
                let lp = ListParams::default();
                let pods = p_kube_request.list(&lp).await?;

                let mut metrics_val = "".to_string();
                let mut metrics2 = None;
                if self.is_metrics_available() {
                    debug!("Retrieving metrics for deployment");
                    let m_kube_request: Api<PodMetrics> = self.get_api(metrics_client, namespace);
                    let lp = ListParams::default();
                    let metrics = m_kube_request.list(&lp).await?;

                    let mp_kube_request: Api<PodMetrics> = self.get_api(pod_metrics_client, namespace);
                    let lp = ListParams::default();
                    let pod_metrics = mp_kube_request.list(&lp).await?;

                    metrics_val = serde_json::to_string(&metrics).unwrap();
                    metrics2 = Some(serde_json::to_string(&pod_metrics).unwrap());
                }
                let json = ResourceWithMetricsHolder {
                    resource: serde_json::to_string(&deployments).unwrap(),
                    usage: Some(serde_json::to_string(&pods).unwrap()),
                    ts: SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_millis(),
                    metrics: metrics_val,
                    metrics2,
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
                let deploy_request: Api<Deployment> = self.get_api(client, ns);
                let d = deploy_request.get(deployment).await?;
                let mut pods_for_deployments: Vec<Pod> = Vec::new();
                if let Some(spec) = d.spec {
                    if let Some(match_labels) = spec.selector.match_labels {
                        let pod_request: Api<Pod> = self.get_api(pclient, ns);
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

    #[tokio::main]
    pub async fn edit_resource(
        &self,
        ns: &str,
        resource_str: &str,
        name: &str,
        kind: &str
    ) -> bool  {
        let client = self.init_client().await;

        match client {
            Some(cl) => {
                let createRequest: Api<DynamicObject> = self._build_api(ns, kind, cl.clone());

                let params = PatchParams::apply("yaki").force();
                let patch: DynamicObject = serde_yaml::from_str(resource_str).unwrap();
                let patch = Patch::Apply(&patch);
                let o_patched = createRequest.patch(name, &params, &patch).await;
                match o_patched {
                    Ok(res) => {
                        true
                    },
                    Err(e) => {
                        println!("{:?}", e);
                        false
                    }
                }
            },
            None => false
        }
    }

    #[tokio::main]
    pub async fn get_deployment(
        &self,
        ns: &String,
        deployment: &str,
    ) -> Option<Deployment> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let deploy_request: Api<Deployment> = self.get_api(client, ns);
                let d = deploy_request.get(deployment).await;
                match d {
                    Ok(mut d) => {
                        d.managed_fields_mut().clear();
                        Some(d)
                    },
                    _ => {
                        None
                    }
                }
            },
            None => {None}
        }
    }

    #[tokio::main]
    pub async fn get_resource_definition(
        &self,
        ns: &String,
        name: &str,
        kind: &str,
    ) -> Option<DynamicObject> {
        let client = self.init_client().await;
        match client {
            Some(cl) => {
                let getRequest: Api<DynamicObject> = self._build_api(ns, kind, cl.clone());

                let o_patched = getRequest.get(name).await;
                match o_patched {
                    Ok(mut res) => {
                        res.managed_fields_mut().clear();
                        Some(res)
                    },
                    Err(e) => {
                        None
                    }
                }
            },
            None => None
        }
    }

    pub fn create_resource(
        &self,
        window: &Window,
        resource_str: &str,
        kind: &str,
        ns: Option<&String>,
        cmd: &str
    ) {
        self._create_resource(window, resource_str, kind, ns, cmd);
    }

    #[tokio::main]
    pub async fn _create_resource(
        &self,
        window: &Window,
        resource_str: &str,
        kind: &str,
        nso: Option<&String>,
        cmd: &str
    ) -> bool  {
        let mut ns = "";
        if let Some(sns) = nso {
            ns = sns;
        }
        let client = self.init_client().await;
        match client {
            Some(cl) => {
                let docs = self.multidoc_deserialize(resource_str);
                if docs.is_empty() {
                    send_error(window, "No resource found. Check if Yaml is valid");
                    false
                }else if docs.len() == 1 {
                    let patch = serde_yaml::from_str(resource_str).unwrap();
                    let params = PostParams::default();
                    let create_request: Api<DynamicObject> = self._build_api(ns, kind, cl.clone());
                    let o_patched = create_request.create(&params, &patch).await;
                    match o_patched {
                        Ok(_res) => {
                            true
                        },
                        Err(e) => {
                            send_error(window, &e.to_string());
                            false
                        }
                    }
                }else{
                    for doc in docs {
                        let patch: Result<DynamicObject, serde_yaml::Error> = serde_yaml::from_value(doc);
                        if let Ok(patch) = patch {
                            let params = PostParams::default();
                            if let Some(tm) = &patch.types {
                                let create_request: Api<DynamicObject> = self._build_api(ns, &tm.kind, cl.clone());
                                let o_patched = create_request.create(&params, &patch).await;
                                match o_patched {
                                    Ok(_res) => {

                                    },
                                    Err(e) => {
                                        send_error(window, &e.to_string());
                                    }
                                }
                            }else{
                                println!("Skipping as invalid types");
                            }
                        }else{
                            println!("Skipping: ");
                        }
                    }
                    true
                }
            },
            None => false
        }
    }

    fn multidoc_deserialize(&self, data: &str) -> Vec<serde_yaml::Value> {
        use serde::Deserialize;
        let mut docs = vec![];
        for de in serde_yaml::Deserializer::from_str(data) {
            let doc = serde_yaml::Value::deserialize(de);
            if let Ok(val) = doc {
                docs.push(val);
            }
        }
        docs
    }


    pub fn delete_resource(
        &self,
        window: &Window,
        ns: &str,
        resource_name: &str,
        kind: &str,
        cmd: &str
    ) {
        self._delete_resource(window, ns, resource_name, kind, cmd);
    }

    fn _build_api(
        &self,
        ns: &str,
        kind: &str,
        cl: Client
    ) -> Api<DynamicObject> {
        let version = "v1";
        let mut group = "";
        if kind.eq( "Deployment") {
            group = "apps";
        }
        let ar = ApiResource::from_gvk(&GroupVersionKind::gvk(group, version, kind));

        if !ns.is_empty() && !kind.to_lowercase().trim().eq("namespace") {
            Api::namespaced_with(cl, ns, &ar)
        }else{
            Api::all_with(cl, &ar)
        }
    }

    #[tokio::main]
    pub async fn _delete_resource(
        &self,
        window: &Window,
        ns: &str,
        resource_name: &str,
        kind: &str,
        cmd: &str
    ) -> bool  {
        let client = self.init_client().await;

        match client {
            Some(cl) => {
                let deleteapi: Api<DynamicObject> = self._build_api(ns, kind, cl.clone());

                let params = DeleteParams::default();
                let res = deleteapi.delete(resource_name, &params).await;
                match res {
                    Ok(res) => {
                        true
                    },
                    Err(e) => {
                        println!("{:?}", e);
                        false
                    }
                }
            },
            None => false
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
                let pods: Api<Pod> = self.get_api(client, ns);
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

    pub fn open_shell(
        &self,
        window: &Window,
        pod: &str,
        ns: &str,
        rx: &Receiver<String>,
    ) {
        self._open_shell(window,  pod, ns, rx);
    }

    #[tokio::main]
    async fn _open_shell(
        &self,
        window: &Window,
        pod: &str,
        ns: &str,
        rx: &Receiver<String>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        info!("Fetching logs for {:?}", pod);
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let pods: Api<Pod> = self.get_api(client, ns);

                let ap = AttachParams::interactive_tty();

                let mut attached = pods.exec(pod, vec!["sh"], &ap).await?;

                let mut stdin_writer = attached.stdin().unwrap();
                let stdout_reader = attached.stdout().unwrap();

                debug!("Spin new thread");
                let mut stdout_stream = tokio_util::io::ReaderStream::new(stdout_reader);
                let cl = window.clone();
                tokio::spawn(async move {
                    while let next_stdout = stdout_stream.next(){
                        if let Some(val) = next_stdout.await {
                            if let Ok(res) = val {
                                let resVec = res.to_vec();
                                // let mut result = u16![resVec.len()];
                                // for (pos, ch) in resVec.iter().enumerate() {
                                //     if pos == 0 && *ch == 27 {
                                //     }else if pos == 1 && *ch == 91 {
                                //     }else{
                                //         result.push(*ch);
                                //     }
                                // }
                                let data = String::from_utf8(resVec).unwrap();
                                utils::dispatch_event_to_frontend_with_data(&cl, "shell::output", &data);
                            }
                        }
                    }
                });
                println!("Spawning task");
                while let Ok(line) = rx.recv() {
                    println!("Executing command: {}", line);
                    let command = line.as_bytes();
                    stdin_writer.write_all(command).await?;
                    debug!("Command sent for execution");
                    if line == "exit\n" {
                        debug!("Work is done: {:?}", line);
                        break;
                    }
                }
                attached.join();
                debug!("Shell execution completed.");
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
                let pods: Api<Pod> = self.get_api(client, ns);
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
                send_error(window, "Failed to restart. Reason: ");
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
                let deploy_request: Api<Deployment> = self.get_api(client, namespace);
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
                send_error(window, "Failed to restart. Reason Kubeclient failed.");
                Ok(())
            }
        }
    }

    pub fn get_resource(&self, window: &Window, namespace: &String, kind: &String, cmd: &str) {
        if kind == "deployment" {
            self._get_deployments_with_metrics(&window, namespace, cmd);
        } else if kind == "namespace" {
            // _get_all_ns(&window, cmd, cluster, Vec::new());
        } else if kind == "pod" {
            self._get_pods_with_metrics(&window, namespace, cmd);
        } else if kind == "podmetrics" {
            self._get_pods_with_metrics(&window, namespace, cmd);
        } else if kind == "node" {
            self._get_nodes_with_metrics(&window, cmd);
        } else if kind == "cronjob" {
            self._get_all_cron_jobs(&window, cmd, namespace);
        } else if kind == "configmap" {
            self._get_all_config_maps(&window, cmd, namespace);
            self._get_all_secrets(&window, cmd, namespace);
        } else if kind == "service" {
            self._get_all_services(&window, cmd, namespace);
        } else if kind == "daemonset" {
            self._get_all_daemon_sets(&window, cmd, namespace);
        } else if kind == "persistentvolume" {
            self._get_all_persistent_volume(&window, cmd, namespace);
        } else if kind == "statefulset" {
            self._get_all_stateful_sets(&window, cmd, namespace);
        }
    }

    #[tokio::main]
    async fn _get_all_services(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<Service> = Api::namespaced(client, namespace);

                let lp = ListParams::default();
                let services: ObjectList<Service> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&services).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
            None => Ok(())
        }
    }

    #[tokio::main]
    async fn _get_all_config_maps(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<ConfigMap> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let config_maps: ObjectList<ConfigMap> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&config_maps).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
                None => Ok(())
        }
    }

    #[tokio::main]
    async fn _get_all_cron_jobs(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) =>{
                let kube_request: Api<CronJob> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let cron_jobs: ObjectList<CronJob> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&cron_jobs).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
                None => Ok(())
        }
    }

    #[tokio::main]
    async fn _get_all_secrets(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<Secret> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let secrets: ObjectList<Secret> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&secrets).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
                None => Ok(())
        }
    }


    #[tokio::main]
    async fn _get_all_persistent_volume(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<PersistentVolume> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let persistent_volumes: ObjectList<PersistentVolume> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&persistent_volumes).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
                None => Ok(())
        }
    }


    #[tokio::main]
    async fn _get_all_daemon_sets(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<DaemonSet> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let daemon_sets: ObjectList<DaemonSet> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&daemon_sets).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
                None => Ok(())
        }
    }

    #[tokio::main]
    async fn _get_all_replica_sets(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<ReplicaSet> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let replica_sets: ObjectList<ReplicaSet> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&replica_sets).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
            None => Ok(())
        }
    }

    #[tokio::main]
    async fn _get_all_stateful_sets(
        &self,
        window: &Window,
        cmd: &str,
        namespace: &String,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = self.init_client().await;
        match client {
            Some(client) => {
                let kube_request: Api<StatefulSet> = self.get_api(client, namespace);

                let lp = ListParams::default();
                let stateful_sets: ObjectList<StatefulSet> = kube_request.list(&lp).await?;
                let json = serde_json::to_string(&stateful_sets).unwrap();
                dispatch_to_frontend(window, cmd, json);
                Ok(())
            },
                None => Ok(())
        }
    }
}

fn _get_current_cluster(filename: &String) -> String {
    let kc = Kubeconfig::read_from(Path::new(filename));
    match kc {
        Ok(kc) => {
            if let Some(cc) = kc.current_context {
                cc
            }else{
                "".to_string()
            }
        },
        _ => {
            "".to_string()
        }
    }
}