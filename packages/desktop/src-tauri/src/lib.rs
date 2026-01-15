use serde::Serialize;
use std::net::{Ipv4Addr, SocketAddrV4};
use thiserror::Error;
use zeroize::Zeroize;

#[derive(Debug, Error)]
enum NatError {
  #[error("NAT-PMP unavailable: {0}")]
  NatPmp(String),
  #[error("UPnP unavailable: {0}")]
  Upnp(String),
}

#[derive(Debug, Serialize)]
pub struct NatTraversalSummary {
  consent_granted: bool,
  natpmp_attempted: bool,
  natpmp_status: Option<String>,
  upnp_attempted: bool,
  upnp_status: Option<String>,
  external_ip: Option<String>,
}

#[tauri::command]
fn secure_wipe(app_handle: tauri::AppHandle) -> Result<(), String> {
  // Best-effort: remove app data and temp dirs, then return. Caller should exit the app after success.
  let mut errors: Vec<String> = vec![];
  if let Some(dir) = app_handle.path_resolver().app_data_dir() {
    if let Err(e) = std::fs::remove_dir_all(&dir) {
      errors.push(format!("app_data_dir: {e}"));
    }
  }
  if let Some(dir) = app_handle.path_resolver().app_cache_dir() {
    if let Err(e) = std::fs::remove_dir_all(&dir) {
      errors.push(format!("app_cache_dir: {e}"));
    }
  }
  if let Some(dir) = app_handle.path_resolver().app_local_data_dir() {
    if let Err(e) = std::fs::remove_dir_all(&dir) {
      errors.push(format!("app_local_data_dir: {e}"));
    }
  }
  // Memory scrub example: wipe a short-lived buffer (placeholder if we store secrets).
  let mut scratch = vec![0u8; 64];
  scratch.fill(0xAA);
  scratch.zeroize();

  if errors.is_empty() {
    Ok(())
  } else {
    Err(errors.join("; "))
  }
}

#[tauri::command]
fn nat_traversal_probe(consent: bool) -> NatTraversalSummary {
  if !consent {
    return NatTraversalSummary {
      consent_granted: false,
      natpmp_attempted: false,
      natpmp_status: Some("Skipped (no consent)".into()),
      upnp_attempted: false,
      upnp_status: Some("Skipped (no consent)".into()),
      external_ip: None,
    };
  }

  // NAT-PMP: only request public address; do not rely on mapping for correctness.
  let mut natpmp_status = None;
  let mut natpmp_attempted = false;
  let mut external_ip = None;
  if let Ok(mut client) = natpmp::Client::new() {
    natpmp_attempted = true;
    match client.send_public_address_request() {
      Ok(resp) => match resp.get_response() {
        Ok(addr) => {
          external_ip = Some(addr.public_address().to_string());
          natpmp_status = Some("Public address retrieved via NAT-PMP".into());
        }
        Err(e) => {
          natpmp_status = Some(format!("Public address request failed: {e}"));
        }
      },
      Err(e) => {
        natpmp_status = Some(format!("Request failed: {e}"));
      }
    }
  }

  // UPnP: attempt to discover gateway and request an ephemeral UDP mapping.
  let mut upnp_status = None;
  let mut upnp_attempted = false;
  if let Ok(gateway) = igd::search_gateway(Default::default()) {
    upnp_attempted = true;
    match gateway.get_external_ip() {
      Ok(ip) => {
        external_ip.get_or_insert(ip.to_string());
        // Request an ephemeral UDP mapping; description purely informational.
        let local_addr = SocketAddrV4::new(Ipv4Addr::LOCALHOST, 0);
        match gateway.add_any_port(
          igd::PortMappingProtocol::UDP,
          local_addr,
          60,
          "p2p.red-nat-probe",
        ) {
          Ok(port) => {
            upnp_status = Some(format!("UPnP mapping created on UDP port {port} (60s lease)"));
          }
          Err(e) => {
            upnp_status = Some(format!("UPnP mapping failed: {e}"));
          }
        }
      }
      Err(e) => {
        upnp_status = Some(format!("UPnP external IP failed: {e}"));
      }
    }
  }

  NatTraversalSummary {
    consent_granted: true,
    natpmp_attempted,
    natpmp_status,
    upnp_attempted,
    upnp_status,
    external_ip,
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![nat_traversal_probe, secure_wipe])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
