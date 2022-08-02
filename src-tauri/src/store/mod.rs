use std::path::{Path, PathBuf};
use std::{env, fs};
use std::error::Error;
use std::fs::File;
use log::{debug, error, info};
use sqlite3::{Connection, State};

pub struct DataStoreManager {
  connection: Connection
}

impl DataStoreManager {
  pub(crate) fn save(&self, key: String, value: String) {
    // let mut statement = self.connection
    //   .prepare("INSERT INTO users VALUES (?, ?)")
    //   .unwrap()
    //   .bind(1, key)
    //   .unwrap();
  }

  pub(crate) fn query(&self, key: String, default: String) -> String{
    let mut statement = self.connection
      .prepare("SELECT value FROM preferences WHERE key = ?")
      .unwrap();

    statement.bind(1, &*key).unwrap();
    while let State::Row = statement.next().unwrap() {
      let value = &statement.read::<String>(0).unwrap();
      if value == "" {
        return default;
      }else{
        return value.to_string();
      }
    };

    return default;
  }
}

pub fn initialize() -> DataStoreManager {
  let sm = _intialize();
  let sm = match sm {
    Ok(sm) => { sm }
    Err(error) => { panic!("Failed to initialize: {:?}", error) }
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
  }else{
    debug!("Data file found.");
  }
}

fn get_file_name() -> String {
  let mut file_path: PathBuf = dirs::home_dir().unwrap();
  const OS: &str = env::consts::OS;
  debug!("OS Found: {}",OS);
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
  let sm = DataStoreManager{
    connection: sqlite3::open(Path::new(&filename)).unwrap()
  };
  const sql_init_statements: &str = "\
  CREATE TABLE IF NOT EXISTS preferences (key TEXT, value TEXT);";
  sm.connection.execute(sql_init_statements).unwrap();
  Ok(sm)
}
