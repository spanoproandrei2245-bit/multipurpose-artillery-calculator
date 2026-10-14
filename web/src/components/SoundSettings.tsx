import { useEffect, useRef, useState } from 'react'

import {
  customSoundName,
  getVolume,
  MAX_SOUND_BYTES,
  onCustomSoundsChange,
  playSound,
  resetCustomSound,
  setCustomSound,
  setVolume,
  SOUND_EVENTS,
  type SoundEvent,
} from '../lib/sound'
import type { Language } from '../types/settings'

const LABELS: Record<SoundEvent, { ru: string; en: string }> = {
  fire: { ru: 'Выстрел (нажали «Огонь»)', en: 'Fire (button pressed)' },
  splash: { ru: 'Сплэш — 5 с до разрыва', en: 'Splash — 5 s to impact' },
  impact: { ru: 'Разрыв', en: 'Impact' },
  mrsiTick: { ru: 'MRSI: отсчёт 3-2-1', en: 'MRSI: 3-2-1 countdown' },
  mrsiFire: { ru: 'MRSI: «огонь»', en: 'MRSI: fire' },
  syncUpdate: {
    ru: 'Связка: новые установки',
    en: 'Link: new settings',
  },
}

/** Свои звуковые файлы на события и общая громкость. */
export function SoundSettings({ language }: { language: Language }) {
  const ru = language === 'ru'
  const [volume, setVolumeState] = useState(getVolume)
  const [names, setNames] = useState(readNames)
  const [error, setError] = useState<string | null>(null)
  const inputs = useRef<Partial<Record<SoundEvent, HTMLInputElement>>>({})

  useEffect(() => onCustomSoundsChange(() => setNames(readNames())), [])

  function changeVolume(value: number) {
    setVolume(value)
    setVolumeState(value)
  }

  async function pick(event: SoundEvent, file: File | undefined) {
    if (!file) return
    setError(null)
    const result = await setCustomSound(event, file)
    if (result === 'too-large') {
      setError(
        ru
          ? `«${file.name}» больше ${MAX_SOUND_BYTES / 1024 / 1024} МБ — возьмите короткий звук.`
          : `"${file.name}" is over ${MAX_SOUND_BYTES / 1024 / 1024} MB — use a short sound.`
      )
    } else if (result === 'not-audio') {
      setError(
        ru
          ? `«${file.name}» не читается как звук. Подойдут MP3, WAV, OGG.`
          : `"${file.name}" is not a playable sound. Use MP3, WAV or OGG.`
      )
    } else {
      playSound(event)
    }
  }

  const button =
    'cursor-pointer rounded-lg border border-app-border bg-app-bg px-3 py-1 text-xs text-app-text hover:border-emerald-500'

  return (
    <div className="rounded-xl border border-app-border bg-app-surface p-6">
      <h3 className="text-lg font-semibold text-app-text">
        {ru ? 'Звуки' : 'Sounds'}
      </h3>
      <p className="mt-1 text-sm text-app-muted">
        {ru
          ? 'Свой файл на каждое событие (MP3, WAV, OGG до 2 МБ). Файлы хранятся только на этом устройстве.'
          : 'Your own file for each event (MP3, WAV, OGG up to 2 MB). Files stay on this device.'}
      </p>

      <label className="mt-4 flex items-center gap-3 text-sm text-app-text">
        {ru ? 'Громкость' : 'Volume'}
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          onPointerUp={() => playSound('splash')}
          className="w-48 accent-emerald-600"
        />
        <span className="w-10 text-app-muted tabular-nums">
          {Math.round(volume * 100)}%
        </span>
      </label>

      <ul className="mt-4 divide-y divide-app-border">
        {SOUND_EVENTS.map((event) => (
          <li key={event} className="flex flex-wrap items-center gap-2 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-app-text">
                {ru ? LABELS[event].ru : LABELS[event].en}
              </p>
              <p className="truncate text-xs text-app-muted">
                {names[event] ?? (ru ? 'стандартный сигнал' : 'default beep')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => playSound(event)}
              className={button}
            >
              {ru ? '▶ Проверить' : '▶ Test'}
            </button>
            <button
              type="button"
              onClick={() => inputs.current[event]?.click()}
              className={button}
            >
              {ru ? 'Выбрать файл' : 'Choose file'}
            </button>
            {names[event] && (
              <button
                type="button"
                onClick={() => void resetCustomSound(event)}
                className={button}
              >
                {ru ? 'Сбросить' : 'Reset'}
              </button>
            )}
            <input
              ref={(element) => {
                if (element) inputs.current[event] = element
              }}
              type="file"
              accept="audio/*"
              hidden
              onChange={(change) => {
                void pick(event, change.target.files?.[0])
                change.target.value = ''
              }}
            />
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}

function readNames(): Partial<Record<SoundEvent, string>> {
  const result: Partial<Record<SoundEvent, string>> = {}
  for (const event of SOUND_EVENTS) {
    const name = customSoundName(event)
    if (name) result[event] = name
  }
  return result
}
