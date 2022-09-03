use std::str;
use std::error;
use openssl::rsa::{Rsa, Padding};

const PUBLIC_KEY_PEM: &str = "-----BEGIN PUBLIC KEY-----
-----END PUBLIC KEY-----";

#[derive(Clone, serde::Serialize, serde::Deserialize, Debug)]
pub struct Profile {
    pub(crate) name: String,
    pub(crate) expiry: u64,
}

pub fn verify_license_key(license_key: &str) -> Result<Profile, Box<dyn error::Error>> {
    let u8str_array = license_key.split(",");
    let mut data: Vec<u8> = Vec::new();
    for u8str in u8str_array {
        if u8str.len() > 0 {
            if let Ok(num) = u8str.parse() {
                data.push(num);
            }
        }
    }

    let rsa = Rsa::public_key_from_pem(PUBLIC_KEY_PEM.as_bytes())?;
    let mut buf: Vec<u8> = vec![0; rsa.size() as usize];
    let _ = rsa.public_decrypt(&data, &mut buf, Padding::PKCS1)?;
    let data = String::from_utf8(buf)?;
    let profile = serde_json::from_str::<Profile>(&data.replace(|c: char| c == char::from_u32(0).unwrap(), ""))?;
    Ok(profile)
}
