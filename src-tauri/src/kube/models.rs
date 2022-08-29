use std::collections::HashMap;
use std::pin::Pin;
use k8s_openapi::{ClusterResourceScope, NamespaceResourceScope};
use kube::api::{ListParams, ObjectList, ObjectMeta};
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;
use tokio::io;
use std::task::Context;
use std::task::Poll;
use tauri::Window;
use tokio::io::{AsyncRead, AsyncWrite};
use crate::kube::Payload;

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
    pub(crate) usage: Option<String>,
    pub (crate) metrics2: Option<String>,
    pub(crate) ts: u128
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

#[derive(Clone, serde::Serialize, Default)]
pub struct Metric {
    pub(crate) cpu: Option<String>,
    pub(crate) memory: Option<String>,
    pub(crate) ts: u128,
    pub(crate) pod: Option<String>,
    pub(crate) metrics: Option<String>,
}

impl Metric {
    pub(crate) fn new() -> Self {
        Default::default()
    }
}

// pub struct Stdin {
//     value: String
// }
//
// impl Stdid {
//     pub(crate) fn stdin() -> Stdin {
//         let std = io::stdin();
//         Stdin {
//             value: "".to_string()
//         }
//     }
//
//     pub(crate) fn set_value(&self, val: &str) {
//         self.value = val;
//     }
// }
//
// impl AsyncRead for Stdin {
//     fn poll_read(
//         mut self: Pin<&mut Self>,
//         cx: &mut Context<'_>,
//         buf: &mut ReadBuf<'_>,
//     ) -> Poll<io::Result<()>> {
//         Pin::new(&mut self.value).poll_read(cx, buf)
//     }
// }
