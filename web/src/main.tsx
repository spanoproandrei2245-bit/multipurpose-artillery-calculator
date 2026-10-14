import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { OverlayApp } from './components/OverlayApp.tsx'
import { SyncProvider } from './components/SyncProvider.tsx'
import { isDesktop, isOverlayWindow } from './lib/desktop.ts'
import { loadCustomSounds } from './lib/sound.ts'

// Работа без интернета (PWA). В режиме разработки не нужна — мешала бы
// горячей перезагрузке.
// В программе для ПК файлы и так локальные — service worker не нужен.
if (import.meta.env.PROD && 'serviceWorker' in navigator && !isDesktop) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${__APP_VERSION__}`)
      .catch(() => {
        // Без service worker приложение просто работает только онлайн.
      })
  })
}

// Свои звуки — из IndexedDB; звук подаёт основное окно
if (!isOverlayWindow) void loadCustomSounds()

// Окно-оверлей прозрачное: фон страницы не закрашиваем.
if (isOverlayWindow) document.documentElement.classList.add('overlay')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isOverlayWindow ? (
      <OverlayApp />
    ) : (
      <SyncProvider>
        <App />
      </SyncProvider>
    )}
  </StrictMode>,
)
