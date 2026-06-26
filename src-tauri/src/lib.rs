mod kill;
mod ports;

use std::sync::atomic::{AtomicBool, Ordering};

use tauri::{
    image::Image,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};
use tauri_plugin_positioner::{Position, WindowExt};

/// When `true`, a click-away must NOT auto-hide the popover (e.g. a kill
/// confirmation is open or a kill is in flight). The frontend keeps this in
/// sync via `set_autohide_blocked`.
#[derive(Default)]
struct AutohideBlocked(AtomicBool);

#[tauri::command]
fn list_ports() -> Vec<ports::PortProcess> {
    ports::list_ports()
}

#[tauri::command]
fn kill_port(pid: u32) -> kill::KillResult {
    if let Err(reason) = ports::ensure_killable(pid) {
        return kill::KillResult::denied(reason);
    }
    kill::terminate(pid)
}

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

/// Hide the popover. Called by the frontend (e.g. the Escape key).
#[tauri::command]
fn hide_popover(app: tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.hide();
    }
}

/// Let the frontend block/unblock click-away dismissal while a confirmation is
/// open or a kill is running.
#[tauri::command]
fn set_autohide_blocked(state: tauri::State<'_, AutohideBlocked>, blocked: bool) {
    state.0.store(blocked, Ordering::Relaxed);
}

/// Show the popover near the tray, or hide it if already visible.
fn toggle_popover(app: &tauri::AppHandle) {
    let Some(win) = app.get_webview_window("main") else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
    } else {
        let _ = win.move_window(Position::TrayCenter);
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Single-instance must be registered first.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_positioner::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .manage(AutohideBlocked::default())
        .invoke_handler(tauri::generate_handler![
            list_ports,
            kill_port,
            quit_app,
            hide_popover,
            set_autohide_blocked
        ])
        // Dismiss the popover when it loses focus (click-away), unless the
        // frontend has blocked auto-hide (e.g. a kill confirmation is open).
        .on_window_event(|window, event| {
            if window.label() != "main" {
                return;
            }
            if let tauri::WindowEvent::Focused(false) = event {
                let blocked = window
                    .state::<AutohideBlocked>()
                    .0
                    .load(Ordering::Relaxed);
                if !blocked {
                    let _ = window.hide();
                }
            }
        })
        .setup(|app| {
            // Background / menu-bar app: no Dock icon on macOS.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let handle = app.handle().clone();

            let tray_icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
            TrayIconBuilder::with_id("main-tray")
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("Port Killer")
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    tauri_plugin_positioner::on_tray_event(app, &event);
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_popover(app);
                    }
                })
                .build(&handle)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Port Killer");
}
