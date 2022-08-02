use std::collections::HashMap;

pub struct CacheManager {
  cache: HashMap<String, String>
}

impl CacheManager {
  pub fn set(&mut self, key: &str, val: &str) {
    self.cache.insert(key.parse().unwrap(), val.parse().unwrap());
  }

  pub fn get(&self, key: &str, def: &str) -> String{
    let val = self.cache.get(key);
    let mut return_val = def;
    match val {
      Some(val) => {
        return_val = val;
      },
      None => {
      }
    }
    return_val.parse().unwrap()
  }
}

pub const KEY_CONTEXT: &str = "KEY_CONTEXT";

pub fn initialize() -> CacheManager {
  let map: HashMap<String, String> = HashMap::new();
  let cm = CacheManager{
    cache: map
  };
  cm
}
