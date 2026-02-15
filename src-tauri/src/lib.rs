// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}



use std::sync::RwLock;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, WebviewUrl, AppHandle,
};
use serde_json::Value;

struct AppState {
    allowed_url: RwLock<String>,
}

#[tauri::command]
fn update_allowed_url(url: String, state: tauri::State<'_, AppState>) {
    *state.allowed_url.write().unwrap() = url;
}

#[tauri::command]
fn reload_main_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.eval("window.location.reload()");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main").expect("no main window").set_focus();
        }))
        .invoke_handler(tauri::generate_handler![update_allowed_url, reload_main_window])
        .setup(|app| {
            // Initialize AppState from Store
            let mut initial_url = String::new();
            if let Ok(path) = app.path().app_data_dir() {
                 let store_path = path.join("store.json");
                 if store_path.exists() {
                     if let Ok(content) = std::fs::read_to_string(store_path) {
                         if let Ok(json) = serde_json::from_str::<Value>(&content) {
                             if let Some(url) = json.get("ha_url").and_then(|v| v.as_str()) {
                                 initial_url = url.to_string();
                             }
                         }
                     }
                 }
            }
            
            app.manage(AppState { allowed_url: RwLock::new(initial_url) });

            let app_handle = app.handle().clone();
            
            // Create Main Window
            let builder = tauri::WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("Home Assistant")
                .inner_size(1024.0, 768.0)
                .visible(true); // Should be true, index.html handles loading

            // Attach Navigation Handler
            #[cfg(desktop)]
            let builder = builder.on_navigation(move |url| {
                let state = app_handle.state::<AppState>();
                let allowed = state.allowed_url.read().unwrap();
                let url_str = url.as_str();

                // Allow tauri internals (index.html, settings.html)
                if url_str.starts_with("http://tauri.localhost") || url_str.starts_with("tauri://") {
                    return true;
                }
                
                // Allow if allowed_url is configured and matches
                if !allowed.is_empty() && url_str.starts_with(&*allowed) {
                    return true;
                }
                
                // If allowed_url is empty (setup mode), likely we are on tauri:// so it's handled above.
                // But if user clicks link in setup? Block.
                
                // Block and Open in Shell
                let _ = app_handle.shell().open(url_str, None);
                false
            });

            builder.build()?;
            
            // Tray Setup
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let settings_i = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let reload_i = MenuItem::with_id(app, "reload", "Reload", true, None::<&str>)?;
            let open_i = MenuItem::with_id(app, "open", "Open", true, None::<&str>)?;
            
            let menu = Menu::with_items(app, &[&open_i, &reload_i, &settings_i, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            app.exit(0);
                        }
                        "settings" => {
                             if let Some(window) = app.get_webview_window("settings") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            } else {
                                let _ = tauri::WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
                                    .title("Settings")
                                    .inner_size(600.0, 400.0)
                                    .build();
                            }
                        }
                        "reload" => {
                             if let Some(window) = app.get_webview_window("main") {
                                let _ = window.eval("window.location.reload()");
                            }
                        }
                        "open" => {
                             if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, .. } = event {
                         let app = tray.app_handle();
                         if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
