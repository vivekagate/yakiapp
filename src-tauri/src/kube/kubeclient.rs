use std::path::Path;
use kube::config::{Kubeconfig, KubeConfigOptions};
use k8s_openapi::api::core::v1::{
    ConfigMap, Namespace, Node, PersistentVolume, Pod, Secret, Service,
};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use kube::{
    api::{Api, ListParams, ResourceExt},
    Client, Config,
};
use std::error::Error;
use kube::api::ObjectList;
use tauri::Window;
use crate::KNamespace;
use crate::kube::common::dispatch_to_frontend;
use crate::kube::metrics::{PodMetrics};
use crate::kube::models::{NodeMetrics, ResourceWithMetricsHolder};

pub struct KubeClientManager {
    cluster: String,
    kubeconfigfile: String,
}

impl KubeClientManager {
    pub fn clone(&self) -> Self {
        KubeClientManager {
            cluster: self.cluster.clone(),
            kubeconfigfile: self.kubeconfigfile.clone()
        }
    }

    pub fn initialize() -> KubeClientManager {
        KubeClientManager {
            cluster: "".to_string(),
            kubeconfigfile: "".to_string()
        }
    }

    pub fn initialize_from(file: String) -> KubeClientManager {
        KubeClientManager {
            cluster: "".to_string(),
            kubeconfigfile: file
        }
    }

    pub fn set_cluster(&mut self, cl: &str) {
        self.cluster = cl.to_string();
    }

    pub fn set_kubeconfig_file(&mut self, file: &str) {
        self.kubeconfigfile = file.to_string();
    }

    async fn init_client(&self) -> Client {
        if self.cluster.len() > 0 {
            let kco = KubeConfigOptions {
                context: Some(self.cluster.parse().unwrap()),
                cluster: Some(self.cluster.parse().unwrap()),
                user: Some(self.cluster.parse().unwrap()),
            };
            let mut kc = Kubeconfig::read().unwrap();
            println!("Loading custom Kubeconfig: {}", self.kubeconfigfile);
            if self.kubeconfigfile.len() > 0 {
                //TODO Check if file present
                kc = Kubeconfig::read_from(Path::new(&self.kubeconfigfile)).unwrap();
            }
            let config = Config::from_custom_kubeconfig(kc, &kco).await;
            Client::try_from(config.unwrap()).unwrap()
        } else {
            if self.kubeconfigfile.len() > 0 {
                //TODO Check if file present
                let kc = Kubeconfig::read_from(Path::new(&self.kubeconfigfile)).unwrap();
            }
            Client::try_default().await.unwrap()
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

    #[tokio::main]
    async fn _get_pods_with_metrics(
        &self,
        window: &Window,
        namespace: &String,
        cmd: &str,
    ) -> Result<(), Box<dyn Error>> {
        let client = self.init_client().await;
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
            metrics2: None
        };
        dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
        Ok(())
    }

    #[tokio::main]
    async fn _get_nodes_with_metrics(
        &self,
        window: &Window,
        cmd: &str,
    ) -> Result<(), Box<dyn Error>> {
        let client = self.init_client().await;

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
            metrics2: None
        };
        let result = serde_json::to_string(&json).unwrap();
        dispatch_to_frontend(window, cmd, result);
        Ok(())
    }

    #[tokio::main]
    async fn _get_deployments_with_metrics(
        &self,
        window: &Window,
        namespace: &String,
        cmd: &str,
    ) -> Result<(), Box<dyn Error>> {
        let client = self.init_client().await;
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
            metrics2: Some(serde_json::to_string(&pod_metrics).unwrap())

        };
        dispatch_to_frontend(window, cmd, serde_json::to_string(&json).unwrap());
        Ok(())
    }
}