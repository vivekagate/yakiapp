#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use crate::appmanager::AppManager;
use crate::cache::CacheManager;
use crate::kube::models::CommandResult;
use crate::kube::{EventHolder, KNamespace, kubeclient};
use crate::store::{DataStoreManager, PKEY_KUBECONFIG_FILE_LOCATION, Preference};
use crate::task::TaskManager;
use ::kube::api::Object;
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::fs::File;
use std::io::BufRead;
use std::iter::Map;
use std::path::{Path, PathBuf};
use std::sync::mpsc::Sender;
use std::sync::{mpsc, Mutex, MutexGuard};
use std::{env, io, thread};
use tauri::{State, Window};
use tracing_subscriber::registry::Data;

mod appmanager;
mod cache;
mod kube;
mod store;
mod task;
mod utils;

#[macro_use]
extern crate log;

#[derive(Clone, serde::Serialize)]
struct Payload {
    message: String,
}

#[derive(Clone, serde::Serialize)]
struct KCluster {
    name: String,
    current: bool,
}

#[derive(Deserialize, Debug)]
struct CommandHolder {
    command: String,
    args: HashMap<String, String>,
}

struct SingletonHolder(Mutex<AppManager>);

fn main() {
    init_tauri();
    debug!("Welcome to Yaki");
}

fn init_tauri() {
    tauri::Builder::default()
        .manage(SingletonHolder(Mutex::from(appmanager::initialize())))
        .invoke_handler(tauri::generate_handler![
            execute_command,
            execute_sync_command
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn execute_sync_command(
    window: Window,
    commandstr: &str,
    appmanager: State<SingletonHolder>,
) -> String {
    const SET_CURRENT_CLUSTER_CONTEXT: &str = "set_current_cluster_context";
    const GET_ALL_CLUSTER_CONTEXTS: &str = "get_all_cluster_contexts";
    const GET_CURRENT_CLUSTER_CONTEXT: &str = "get_current_cluster_context";
    const GET_PODS_FOR_DEPLOYMENT: &str = "get_pods_for_deployment";
    const EULA_ACCEPTED: &str = "eula_accepted";
    const ADD_LICENSE: &str = "add_license";
    const SAVE_PREFERENCE: &str = "save_preference";
    const GET_PREFERENCES: &str = "get_preferences";

    let mut stateHolder = &mut appmanager.0.lock().unwrap();

    // let cachemanager: &CacheManager = &mut singletonHolder.cachemanager;
    // let mut dsmanager: &DataStoreManager = &singletonHolder.dsmanager;

    let current_cluster = stateHolder.cachemanager.get(cache::KEY_CONTEXT, "");
    debug!("Current cluster: {}", current_cluster);

    let cmd_hldr: CommandHolder = serde_json::from_str(commandstr).unwrap();
    let mut res = CommandResult::new();
    if cmd_hldr.command == GET_PODS_FOR_DEPLOYMENT {
        let ns = cmd_hldr.args.get("ns").unwrap();
        let deployment = cmd_hldr.args.get("deployment").unwrap();
        let pods = kube::get_pods_for_deployment(ns, &current_cluster, deployment);
        res.command = GET_PODS_FOR_DEPLOYMENT.parse().unwrap();
        match pods {
            Ok(data) => {
                res.data = serde_json::to_string(&data).unwrap();
            }
            Err(err) => {
                println!("{}", err.to_string());
                utils::send_error(&window, err.to_string());
            }
        }
    } else if cmd_hldr.command == GET_ALL_CLUSTER_CONTEXTS {
        let clusters = kube::get_clusters();
        match clusters {
            Ok(clusters) => {
                res.data = serde_json::to_string(&clusters).unwrap();
            }
            Err(err) => {
                res.data = "".parse().unwrap();
            }
        }
    } else if cmd_hldr.command == SET_CURRENT_CLUSTER_CONTEXT {
        let cl = cmd_hldr.args.get("cluster").unwrap();
        debug!("New cluster: {}", cl);
        stateHolder.cachemanager.set(cache::KEY_CONTEXT, cl);
        stateHolder.kubemanager.set_cluster(cl);
    } else if cmd_hldr.command == GET_CURRENT_CLUSTER_CONTEXT {
        let cluster = get_current_cluster();
        res.data = serde_json::to_string(&cluster).unwrap();
    } else if cmd_hldr.command == EULA_ACCEPTED {
        let pref = Preference{key: store::KEY_EULA_ACCEPT.to_string(), value: "true".to_string()};
        stateHolder.dsmanager.upsert(pref);
    } else if cmd_hldr.command == ADD_LICENSE {
        let cl = cmd_hldr.args.get("license").unwrap();
        //TODO Check is license is valid
        let pref = Preference{key: store::LICENSE_STRING_KEY.to_string(), value: cl.to_string()};
        stateHolder.dsmanager.upsert(pref);
        check_license(&window, Some(cl.to_string()));
    } else if cmd_hldr.command == SAVE_PREFERENCE {
        let key = cmd_hldr.args.get("key").unwrap();
        let value = cmd_hldr.args.get("value").unwrap();
        let pref = Preference{key: key.to_string(), value: value.to_string()};
        stateHolder.dsmanager.upsert(pref);
        if key == PKEY_KUBECONFIG_FILE_LOCATION {
            stateHolder.kubemanager.set_kubeconfig_file(value);
        }
    } else if cmd_hldr.command == GET_PREFERENCES {
        let keys = cmd_hldr.args.keys();
        let mut prefs: Vec<Preference> = Vec::new();
        for key in keys {
            let result = stateHolder.dsmanager.query(key.to_string(), None);
            let val = match result {
                Some(val) => val,
                None => "".to_string()
            };
            prefs.push(Preference{
                key: key.to_string(),
                value: val
            });
        }
        res.command = GET_PREFERENCES.parse().unwrap();
        res.data = serde_json::to_string(&prefs).unwrap()
    }
    serde_json::to_string(&res).unwrap()
}

#[tauri::command]
fn execute_command(window: Window, commandstr: &str, appmanager: State<SingletonHolder>) {
    const GET_ALL_NS: &str = "get_all_ns";
    const GET_DEPLOYMENTS: &str = "get_deployments";
    const GET_RESOURCE: &str = "get_resource";
    const GET_RESOURCE_WITH_METRICS: &str = "get_resource_with_metrics";
    const TYPE_METRICS: &str = "type_metrics";
    const GET_PODS_FOR_DEPLOYMENT: &str = "get_pods_for_deployment_async";
    const GET_METRICS_FOR_DEPLOYMENT: &str = "get_metrics_for_deployment";
    const RESTART_DEPLOYMENTS: &str = "restart_deployments";
    const TAIL_LOGS_FOR_POD: &str = "tail_logs_for_pod";
    const GET_LOGS_FOR_POD: &str = "get_logs_for_pod";
    const STREAM_METRICS_FOR_POD: &str = "stream_metrics_for_pod";
    const STOP_LIVE_TAIL: &str = "stop_live_tail";
    const STOP_ALL_METRICS_STREAMS: &str = "stop_all_metrics_streams";
    const APP_START: &str = "app_start";

    let stateHolder = &mut appmanager.0.lock().unwrap();


    let current_cluster: String = stateHolder.cachemanager.get(cache::KEY_CONTEXT, "").clone();

    debug!("Current cluster: {}", current_cluster);
    let cmd_hldr: CommandHolder = serde_json::from_str(commandstr).unwrap();
    if cmd_hldr.command == GET_ALL_NS {
        let pref = stateHolder.dsmanager.query(store::CUSTOM_NS_LIST.to_string(), None);
        let kubemanager = &stateHolder.kubemanager;
        let km = kubemanager.clone();
        let _ = thread::spawn(move || {
            let custom_ns_list = get_custom_ns_list(pref);
            km.get_all_ns(&window, GET_ALL_NS, custom_ns_list);
        });
    } else if cmd_hldr.command == GET_DEPLOYMENTS {
        let _ = thread::spawn(move || {
            let namespace = cmd_hldr.args.get("ns").unwrap();
            let deploys =
                kube::get_all_deployments(&window, &current_cluster, namespace, GET_DEPLOYMENTS);
        });
    } else if cmd_hldr.command == GET_RESOURCE {
        let _ = thread::spawn(move || {
            let namespace = cmd_hldr.args.get("ns").unwrap();
            let kind = cmd_hldr.args.get("kind").unwrap();
            let _ = kube::get_resource(&window, &current_cluster, namespace, kind, GET_RESOURCE);
        });
    } else if cmd_hldr.command == GET_RESOURCE_WITH_METRICS {
        let kubemanager = &stateHolder.kubemanager;
        let km = kubemanager.clone();
        let _ = thread::spawn(move || {
            let namespace = cmd_hldr.args.get("ns").unwrap().clone();
            let kind = cmd_hldr.args.get("kind").unwrap().clone();
            let _ = km.get_resource_with_metrics(
                &window,
                namespace,
                kind,
                GET_RESOURCE_WITH_METRICS.parse().unwrap(),
            );
        });
    } else if cmd_hldr.command == GET_PODS_FOR_DEPLOYMENT {
        let _ = thread::spawn(move || {
            let namespace = cmd_hldr.args.get("ns").unwrap();
            let deployment = cmd_hldr.args.get("deployment").unwrap();
            let deploys = kube::get_pods_for_deployment_async(
                &window,
                &current_cluster,
                namespace,
                deployment,
                GET_PODS_FOR_DEPLOYMENT,
            );
        });
    } else if cmd_hldr.command == GET_METRICS_FOR_DEPLOYMENT {
        let _ = thread::spawn(move || {
            let namespace = cmd_hldr.args.get("ns").unwrap();
            let deployment = cmd_hldr.args.get("deployment").unwrap();
            kube::get_metrics_for_deployment(
                &window,
                &current_cluster,
                namespace,
                deployment,
                GET_METRICS_FOR_DEPLOYMENT,
            );
        });
    } else if cmd_hldr.command == RESTART_DEPLOYMENTS {
        let _ = thread::spawn(move || {
            kube::restart_deployment(window, &current_cluster, cmd_hldr.args, RESTART_DEPLOYMENTS);
        });
    } else if cmd_hldr.command == TAIL_LOGS_FOR_POD {
        let (tx, rx): (Sender<String>, mpsc::Receiver<String>) = mpsc::channel();

        let _ = thread::spawn(move || {
            let ns = cmd_hldr.args.get("ns").unwrap();
            let podname = cmd_hldr.args.get("pod").unwrap();
            kube::tail_logs_for_pod(window, &current_cluster, &podname, &ns, &rx);
            debug!("Tail of logs initiated");
        });
        stateHolder.taskmanager.add_logs_stream(tx);
    } else if cmd_hldr.command == GET_LOGS_FOR_POD {
        let _ = thread::spawn(move || {
            let ns = cmd_hldr.args.get("ns").unwrap();
            let podname = cmd_hldr.args.get("pod").unwrap();
            kube::get_logs_for_pod(window, &current_cluster, &podname, &ns);
        });
    } else if cmd_hldr.command == STREAM_METRICS_FOR_POD {
        let (tx, rx): (Sender<String>, mpsc::Receiver<String>) = mpsc::channel();
        let args = &cmd_hldr.args;
        let ns = args.get("ns").unwrap().clone();
        let podname = args.get("pod").unwrap().clone();

        let _ = thread::spawn(move || {
            kube::stream_cpu_memory_for_pod(window, &current_cluster, &podname, &ns, &rx);
            debug!("Stream of metrics initiated");
        });

        stateHolder.taskmanager.add_metrics_stream(tx);
    } else if cmd_hldr.command == STOP_ALL_METRICS_STREAMS {
        stateHolder.taskmanager.stopallmstream();
    } else if cmd_hldr.command == STOP_LIVE_TAIL {
        stateHolder.taskmanager.stopalllstream();
    } else if cmd_hldr.command == APP_START {
        debug!("App started");
        let license = stateHolder.dsmanager.query(store::LICENSE_STRING_KEY.to_string(), None);
        let eula = stateHolder.dsmanager.query(store::KEY_EULA_ACCEPT.to_string(), None);
        let hndl = thread::spawn(move || {
            let current = get_current_cluster();
            let clusters: Vec<KCluster> = get_clusters(current);
            if clusters.is_empty() {
                utils::dispatch_event_to_frontend(&window, "no_cluster_found");
            } else {
                utils::dispatch_event_to_frontend(&window, "cluster_found");
                debug!("Clusters found");
            }

            check_license(&window, license);
            check_eula(&window, eula);
        });
    } else {
        error!("Failed to find command");
    }
}

fn get_custom_ns_list(ns_string: Option<String>) -> Vec<KNamespace>{
    let mut custom_ns = Vec::new();
    match ns_string {
        Some(val) => {
            for ns in val.split("\n") {
                if ns.trim().len() > 0 {
                    custom_ns.push(KNamespace{
                        name: ns.to_string(),
                        creation_ts: None
                    });
                }
            }
        },
        _ => {}
    }
    custom_ns
}

fn check_license(window: &Window, license: Option<String>) {
    match license {
        Some(license) => {
            utils::dispatch_event_to_frontend(window, "valid_license_found");
        },
        None => {
            utils::dispatch_event_to_frontend(window, "no_license_found");
        }
    }
}

fn check_eula(window: &Window, eula: Option<String>) {
    match eula {
        Some(license) => {
            utils::dispatch_event_to_frontend(window, "eula_accepted");
        },
        None => {
            utils::dispatch_event_to_frontend(window, "eula_not_accepted");
        }
    }
}

fn read_lines<P>(filename: P) -> io::Result<io::Lines<io::BufReader<File>>>
where
    P: AsRef<Path>,
{
    let file = File::open(filename)?;
    Ok(io::BufReader::new(file).lines())
}

fn get_kubeconfig_file() -> String {
    let mut file_path: PathBuf = dirs::home_dir().unwrap();

    const OS: &str = env::consts::OS;
    debug!("OS Found: {}", OS);
    if OS == "windows" {
        file_path.push(PathBuf::from(".kube\\config"));
    } else {
        file_path.push(PathBuf::from(".kube/config"));
    }
    let filename = file_path.into_os_string().into_string().unwrap();
    debug!("Default Kube Config file: {}", filename);
    filename
}

fn get_clusters(current: KCluster) -> Vec<KCluster> {
    let filename = get_kubeconfig_file();
    let mut clusters = Vec::new();
    let re = Regex::new(r"^\s*cluster:").unwrap();
    if let Ok(lines) = read_lines(filename) {
        // Consumes the iterator, returns an (Optional) String
        for line in lines {
            if let Ok(ip) = line {
                if !re.is_match(&*ip) {
                    continue;
                }
                let mut cluster = KCluster {
                    name: re.replace(&*ip, "").parse().unwrap(),
                    current: false,
                };

                if cluster.name == current.name {
                    cluster.current = true;
                }
                clusters.push(cluster);
            }
        }
    }
    clusters
}

fn get_current_cluster() -> KCluster {
    let filename = get_kubeconfig_file();
    debug!("Default Kube Config file: {}", filename);
    if let Ok(lines) = read_lines(filename) {
        // Consumes the iterator, returns an (Optional) String
        for line in lines {
            if let Ok(ip) = line {
                if !ip.starts_with("current-context: ") {
                    continue;
                }
                return KCluster {
                    name: ip.replace("current-context: ", "").to_string(),
                    current: true,
                };
            }
        }
    }
    return KCluster {
        name: "".to_string(),
        current: false,
    };
}
