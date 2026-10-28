//! Сырое движение мыши для «Наводки по мыши».
//!
//! Игра не сообщает угол ствола, поэтому программа считает его по движению
//! мыши. Окно только для сообщений получает Raw Input от мыши, даже когда
//! в фокусе игра (`RIDEV_INPUTSINK`). Читается только относительное движение:
//! ни нажатий кнопок, ни клавиатуры, ни позиции курсора. Пока слежение
//! не включено, движение отбрасывается сразу.

use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};

use tauri::{AppHandle, Emitter};

/// Слежение включено из окна программы (`set_mouse_capture`).
static CAPTURING: AtomicBool = AtomicBool::new(false);
// Накопленное движение с прошлой отправки
static DX: AtomicI64 = AtomicI64::new(0);
static DY: AtomicI64 = AtomicI64::new(0);

#[tauri::command]
pub fn set_mouse_capture(enabled: bool) {
    if !enabled {
        DX.store(0, Ordering::Relaxed);
        DY.store(0, Ordering::Relaxed);
    }
    CAPTURING.store(enabled, Ordering::Relaxed);
}

/// Запускает чтение мыши и отправку событий `mouse-delta` (около 60 раз в секунду).
pub fn start(app: AppHandle) {
    #[cfg(windows)]
    windows_impl::spawn_listener();

    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(16));
        let dx = DX.swap(0, Ordering::Relaxed);
        let dy = DY.swap(0, Ordering::Relaxed);
        if (dx != 0 || dy != 0) && CAPTURING.load(Ordering::Relaxed) {
            let _ = app.emit("mouse-delta", serde_json::json!({ "dx": dx, "dy": dy }));
        }
    });
}

#[cfg(windows)]
mod windows_impl {
    use super::{CAPTURING, DX, DY};
    use std::mem::{size_of, zeroed};
    use std::ptr::{null, null_mut};
    use std::sync::atomic::Ordering;

    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::Input::{
        GetRawInputData, RegisterRawInputDevices, MOUSE_MOVE_ABSOLUTE, RAWINPUT,
        RAWINPUTDEVICE, RAWINPUTHEADER, RIDEV_INPUTSINK, RID_INPUT, RIM_TYPEMOUSE,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetMessageW, RegisterClassW,
        TranslateMessage, HWND_MESSAGE, MSG, WM_INPUT, WNDCLASSW,
    };

    pub fn spawn_listener() {
        std::thread::spawn(|| unsafe {
            let class_name: Vec<u16> = "ArtCalcMouseSink\0".encode_utf16().collect();
            let instance = GetModuleHandleW(null());

            let mut class: WNDCLASSW = zeroed();
            class.lpfnWndProc = Some(window_proc);
            class.hInstance = instance;
            class.lpszClassName = class_name.as_ptr();
            if RegisterClassW(&class) == 0 {
                eprintln!("mouse sink: window class not registered");
                return;
            }

            let window = CreateWindowExW(
                0,
                class_name.as_ptr(),
                null(),
                0,
                0,
                0,
                0,
                0,
                HWND_MESSAGE,
                null_mut(),
                instance,
                null(),
            );
            if window.is_null() {
                eprintln!("mouse sink: window not created");
                return;
            }

            let device = RAWINPUTDEVICE {
                usUsagePage: 0x01, // Generic Desktop
                usUsage: 0x02,     // Mouse
                dwFlags: RIDEV_INPUTSINK,
                hwndTarget: window,
            };
            if RegisterRawInputDevices(&device, 1, size_of::<RAWINPUTDEVICE>() as u32) == 0 {
                eprintln!("mouse sink: raw input not registered");
                return;
            }

            let mut message: MSG = zeroed();
            while GetMessageW(&mut message, null_mut(), 0, 0) > 0 {
                TranslateMessage(&message);
                DispatchMessageW(&message);
            }
        });
    }

    unsafe extern "system" fn window_proc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        if message == WM_INPUT && CAPTURING.load(Ordering::Relaxed) {
            let mut raw: RAWINPUT = zeroed();
            let mut size = size_of::<RAWINPUT>() as u32;
            let read = GetRawInputData(
                lparam as _,
                RID_INPUT,
                &mut raw as *mut RAWINPUT as *mut _,
                &mut size,
                size_of::<RAWINPUTHEADER>() as u32,
            );
            // Только относительное движение мыши (не планшет и не удалённый стол)
            if read != u32::MAX
                && raw.header.dwType == RIM_TYPEMOUSE
                && raw.data.mouse.usFlags & MOUSE_MOVE_ABSOLUTE == 0
            {
                DX.fetch_add(raw.data.mouse.lLastX as i64, Ordering::Relaxed);
                DY.fetch_add(raw.data.mouse.lLastY as i64, Ordering::Relaxed);
            }
        }
        // После WM_INPUT система просит вызвать обработчик по умолчанию
        DefWindowProcW(window, message, wparam, lparam)
    }
}
