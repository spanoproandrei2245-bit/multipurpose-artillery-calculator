// Без консольного окна в релизной сборке Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod mouse;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

/// Глобальные горячие клавиши: работают, когда в фокусе игра.
/// Нажатие пересылается в окна событием `hotkey` с названием действия.
fn shortcuts() -> [(Shortcut, &'static str); 11] {
    let modifiers = Some(Modifiers::CONTROL | Modifiers::ALT);
    [
        // Наводка по мыши: слежение, упоры ствола, калибровка
        (Shortcut::new(modifiers, Code::KeyG), "lay"),
        (Shortcut::new(modifiers, Code::KeyB), "lay-low"),
        (Shortcut::new(modifiers, Code::KeyT), "lay-high"),
        (Shortcut::new(modifiers, Code::KeyK), "lay-calibrate"),
        (Shortcut::new(modifiers, Code::KeyF), "fire"),
        (Shortcut::new(modifiers, Code::KeyO), "overlay"),
        (Shortcut::new(modifiers, Code::KeyD), "input"),
        (Shortcut::new(modifiers, Code::KeyS), "screen-markers"),
        (Shortcut::new(modifiers, Code::KeyM), "mode"),
        (Shortcut::new(modifiers, Code::KeyN), "next-target"),
        (Shortcut::new(modifiers, Code::KeyP), "previous-target"),
    ]
}

fn main() {
    tauri::Builder::default()
        // Одна копия программы: повторный запуск показывает уже открытое окно
        // (вторая копия не получила бы горячие клавиши) и проверяет обновления
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
            let _ = app.emit("second-instance", ());
        }))
        // Обновление программы из GitHub Releases и перезапуск после него
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() != ShortcutState::Pressed {
                        return;
                    }
                    if let Some((_, action)) =
                        shortcuts().into_iter().find(|(s, _)| s == shortcut)
                    {
                        let _ = app.emit("hotkey", action);
                    }
                })
                .build(),
        )
        .invoke_handler(tauri::generate_handler![mouse::set_mouse_capture])
        .setup(|app| {
            mouse::start(app.handle().clone());
            for (shortcut, _) in shortcuts() {
                // Сочетание может быть занято другой программой —
                // приложение всё равно запускается.
                if let Err(error) = app.global_shortcut().register(shortcut) {
                    eprintln!("global shortcut not registered: {error}");
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the application");
}
