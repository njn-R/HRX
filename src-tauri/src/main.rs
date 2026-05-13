//! This is the main entry point for the executable.
//! All primary application logic is deferred to the `app_lib` crate.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

/// The main entry point of the binary. Starts the Tauri application.
fn main() {
  app_lib::run();
}
