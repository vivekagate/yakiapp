use log::{debug, error, info};
use rusqlite::{Connection, Result};
use std::error::Error;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::{env, fs};

pub const LICENSE_PUBLIC_KEY: &str = "LICENSE_PUBLIC_KEY";
pub const LICENSE_STRING_KEY: &str = "LICENSE_STRING_KEY";
pub const CUSTOM_NS_LIST: &str = "CUSTOM_NS_LIST";
pub const PKEY_KUBECONFIG_FILE_LOCATION: &str = "PKEY_KUBECONFIG_FILE_LOCATION";
pub const PKEY_PROXY_URL: &str = "PKEY_PROXY_URL";
pub const KEY_EULA_ACCEPT: &str = "KEY_EULA_ACCEPT";

pub const LICENSE_PUBLIC_KEY_VALUE: &str = "rsa_string";


#[derive(Debug, serde::Deserialize, serde::Serialize)]
pub struct Preference {
    pub(crate) key: String,
    pub(crate) value: String,
}

pub struct DataStoreManager {
    connection: Connection,
}

impl DataStoreManager {
    pub(crate) fn save(&self, pref: Preference) -> Option<bool> {
        let status = self.connection.execute(
            "INSERT INTO preferences (key, value) VALUES (?1, ?2)",
            (&pref.key, &pref.value),
        );
        match status {
            Ok(rows) => {
                if rows == 0 {
                    Some(false)
                } else {
                    Some(true)
                }
            }
            _ => Some(false),
        }
    }

    pub(crate) fn upsert(&self, pref: Preference) -> Option<bool> {
        let key_copy = pref.key.clone();
        let exist = self.query(pref.key, None);
        match exist {
            Some(val) => {
                let status = self.connection.execute(
                    "UPDATE preferences set value = ?1 where key = ?2",
                    (&pref.value, &key_copy),
                );
                let result = match status {
                    Ok(rows) => {
                        if rows == 0 {
                            false
                        } else {
                            true
                        }
                    }
                    _ => false,
                };
                Some(result)
            },
            None => {
                let status = self.connection.execute(
                    "INSERT INTO preferences (key, value) VALUES (?1, ?2)",
                    (&key_copy, &pref.value),
                );
                match status {
                    Ok(rows) => {
                        if rows == 0 {
                            Some(false)
                        } else {
                            Some(true)
                        }
                    }
                    _ => Some(false),
                }
            }
        }
    }

    // pub(crate) fn queryMany(&self, keys: Vec<String>, default: Vec<String>) -> Option<String> {
    //     let mut stmt = self
    //         .connection
    //         .prepare("SELECT key, value FROM preferences WHERE key = ?")
    //         .ok()
    //         .unwrap();
    //
    //     let pref_iter = stmt
    //         .query_map([&key], |row| {
    //             Ok(Preference {
    //                 key: row.get(0)?,
    //                 value: row.get(1)?,
    //             })
    //         })
    //         .ok();
    //
    //     match pref_iter {
    //         Some(mut pref_iter) => {
    //             let mut result = pref_iter.next();
    //             let res = match result {
    //                 Some(val) => {
    //                     match val {
    //                         Ok(pref) => {
    //                             Some(pref.value)
    //                         },
    //                         Err(e) => {
    //                             default
    //                         }
    //                     }
    //                 },
    //                 _ => {
    //                     default
    //                 }
    //             };
    //             res
    //         }
    //         None => default
    //     }
    // }

    pub(crate) fn query(&self, key: String, default: Option<String>) -> Option<String> {
        let mut stmt = self
            .connection
            .prepare("SELECT key, value FROM preferences WHERE key = ?")
            .ok()
            .unwrap();

        let pref_iter = stmt
            .query_map([&key], |row| {
                Ok(Preference {
                    key: row.get(0)?,
                    value: row.get(1)?,
                })
            })
            .ok();

        match pref_iter {
            Some(mut pref_iter) => {
                let mut result = pref_iter.next();
                let res = match result {
                    Some(val) => {
                        match val {
                            Ok(pref) => {
                                Some(pref.value)
                            },
                            Err(e) => {
                                default
                            }
                        }
                    },
                    _ => {
                        default
                    }
                };
                res
            }
            None => default
        }
    }
}

pub fn initialize() -> DataStoreManager {
    let sm = _intialize();
    let sm = match sm {
        Ok(sm) => sm,
        Err(error) => {
            panic!("Failed to initialize: {:?}", error)
        }
    };
    sm
}

fn create_dir_if_absent() {
    debug!("Creating new directory");
    let mut folder_path: PathBuf = dirs::home_dir().unwrap();
    folder_path.push(PathBuf::from(".nirops"));
    let folder_name = folder_path.into_os_string().into_string().unwrap();
    let res = fs::create_dir_all(folder_name);
}

fn create_file_if_absent() {
    debug!("Creating new data file");

    let filename = get_file_name();

    if !Path::new(&filename).exists() {
        File::create(filename);
    } else {
        debug!("Data file found.");
    }
}

fn get_file_name() -> String {
    let mut file_path: PathBuf = dirs::home_dir().unwrap();
    const OS: &str = env::consts::OS;
    debug!("OS Found: {}", OS);
    if OS == "windows" {
        file_path.push(PathBuf::from(".nirops\\yaki_data"));
    } else {
        file_path.push(PathBuf::from(".nirops/yaki_data"));
    }
    file_path.into_os_string().into_string().unwrap()
}

fn _intialize() -> Result<DataStoreManager, Box<dyn Error>> {
    create_dir_if_absent();
    create_file_if_absent();
    let filename = get_file_name();
    let sm = DataStoreManager {
        connection: Connection::open(Path::new(&filename)).unwrap(),
    };
    const sql_init_statements: &str = "\
    CREATE TABLE IF NOT EXISTS preferences (key TEXT, value TEXT);";
    sm.connection.execute(sql_init_statements, ()).unwrap();
    sm.upsert(Preference {
        key: LICENSE_PUBLIC_KEY.parse().unwrap(),
        value: LICENSE_PUBLIC_KEY_VALUE.parse().unwrap(),
    });
    Ok(sm)
}
