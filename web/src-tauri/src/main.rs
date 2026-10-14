// Без консольного окна в релизной сборке Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Emitter;
use tauri_plugin_global_shortcut::{
    Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState,
};

/// Глобальные горячие клавиши: работают, когда в фокусе игра.
/// Нажатие пересылается в окна событием `hotkey` с названием действия.
fn shortcuts() -> [(Shortcut, &'static str); 6] {
    let modifiers = Some(Modifiers::CONTROL | Modifiers::ALT);
    [
        (Shortcut::new(modifiers, Code::KeyF), "fire"),
        (Shortcut::new(modifiers, Code::KeyO), "overlay"),
        (Shortcut::new(modifiers, Code::KeyD), "input"),
        (Shortcut::new(modifiers, Code::KeyM), "mode"),
        (Shortcut::new(modifiers, Code::KeyN), "next-target"),
        (Shortcut::new(modifiers, Code::KeyP), "previous-target"),
    ]
}

fn main() {
    tauri::Builder::default()
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
        .setup(|app| {
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
