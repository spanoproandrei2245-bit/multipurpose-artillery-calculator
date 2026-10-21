import { t } from '../i18n'
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'


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
export function OpenOnPhone() {
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
        <div className="p-2">
          <img
            src={image}
            width={128}
            height={128}
            alt={t('openOnPhone.qr-code-with-the-app')}
            className="block bg-white p-1"
          />
        </div>
      )}

      <div className="min-w-0 flex-1 text-sm">
        <p className="text-[12.5px] break-all text-app-text">{url}</p>
        <p className="mt-2 text-xs text-app-muted">
          {isLocalOnly(window.location.hostname)
            ? t('openOnPhone.the-app-is-running-locally')
            : t('openOnPhone.point-the-phone-camera-at')}
        </p>
      </div>
    </div>
  )
}
