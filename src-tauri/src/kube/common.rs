use crate::kube::models::CommandResult;
use futures::TryFutureExt;
use kube::config::{KubeConfigOptions, Kubeconfig};
use kube::{Client, Config, Error};
use tauri::Window;

pub fn dispatch_to_frontend(window: &Window, cmd: &str, data: String) {
    window
        .emit(
            "app::command_result",
            CommandResult {
                command: String::from(cmd),
                data,
            },
        )
        .unwrap();
}

pub async fn init_client(cluster: &str) -> Result<Client, Error> {
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
