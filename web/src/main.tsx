import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Работа без интернета (PWA). В режиме разработки не нужна — мешала бы
// горячей перезагрузке.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${__APP_VERSION__}`)
      .catch(() => {
        // Без service worker приложение просто работает только онлайн.
      })
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
