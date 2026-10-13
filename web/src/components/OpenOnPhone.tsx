import { useEffect, useState } from 'react'
import QRCode from 'qrcode'

import type { Language } from '../types/settings'

/** Адрес, который телефон не сможет открыть: только этот компьютер. */
function isLocalOnly(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.localhost')
  )
}

/**
 * QR-код со ссылкой на текущую страницу: открыть приложение на
 * телефоне, отсканировав экран компьютера.
 */
export function OpenOnPhone({ language }: { language: Language }) {
  const ru = language === 'ru'
  const url = window.location.origin + window.location.pathname
  const [image, setImage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(url, { margin: 1, width: 192 })
      .then((data) => {
        if (!cancelled) setImage(data)
      })
      .catch(() => {
        // Без картинки остаётся ссылка текстом.
      })
    return () => {
      cancelled = true
    }
  }, [url])

  return (
    <div className="mt-4 flex flex-wrap items-center gap-4">
      {image && (
        <img
          src={image}
          width={144}
          height={144}
          alt={ru ? 'QR-код со ссылкой на приложение' : 'QR code with the app link'}
          className="rounded-lg bg-white p-1"
        />
      )}

      <div className="min-w-0 flex-1 text-sm">
        <p className="break-all text-app-text">{url}</p>
        <p className="mt-2 text-xs text-app-muted">
          {isLocalOnly(window.location.hostname)
            ? ru
              ? 'Сейчас приложение открыто локально — телефон по этой ссылке его не найдёт. QR-код заработает на опубликованном сайте (GitHub Pages).'
              : 'The app is running locally — a phone cannot open this link. The QR code works on the published site (GitHub Pages).'
            : ru
              ? 'Наведите камеру телефона, откройте ссылку и выберите «Установить приложение» / «На экран Домой».'
              : 'Point the phone camera at it, open the link and choose "Install app" / "Add to Home screen".'}
        </p>
      </div>
    </div>
  )
}
