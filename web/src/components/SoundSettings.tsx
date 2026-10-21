import { t, type MessageKey } from '../i18n'
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
import { SectionHeading } from './FormControls'

const LABELS: Record<SoundEvent, MessageKey> = {
  fire: 'soundSettings.fire-button-pressed',
  splash: 'soundSettings.splash-5-s-to-impact',
  impact: 'fireTimer.impact',
  mrsiTick: 'soundSettings.3-2-1-countdown-mrsi',
  mrsiFire: 'soundSettings.fire-mrsi-on-time',
  syncUpdate: 'soundSettings.link-new-settings',
}

/** Свои звуковые файлы на события и общая громкость. */
export function SoundSettings() {
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
        t('soundSettings.is-over-mb-use-a', file.name, MAX_SOUND_BYTES / 1024 / 1024)
      )
    } else if (result === 'not-audio') {
      setError(
        t('soundSettings.is-not-a-playable-sound', file.name)
      )
    } else {
      playSound(event)
    }
  }

  const button = 'btn btn-sm'

  return (
    <div className="panel p-4 sm:p-5">
      <SectionHeading index="02" title={t('soundSettings.sounds')} />
      <p className="mt-3 text-sm text-app-muted">
        {t('soundSettings.your-own-file-for-each')}
      </p>

      <label className="mt-4 flex items-center gap-3">
        <span className="label">{t('soundSettings.volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => changeVolume(Number(event.target.value))}
          onPointerUp={() => playSound('splash')}
          className="w-48 accent-[var(--color-accent)]"
        />
        <span className="mono-num w-10 text-[12px] text-app-muted">
          {Math.round(volume * 100)}%
        </span>
      </label>

      <ul className="mt-4 divide-y divide-app-border overflow-hidden rounded-lg">
        {SOUND_EVENTS.map((event) => (
          <li
            key={event}
            className="flex flex-wrap items-center gap-2 bg-app-raised px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-app-text">
                {t(LABELS[event])}
              </p>
              <p
                className={[
                  'truncate  text-[12.5px]',
                  names[event] ? 'text-accent' : 'text-app-faint',
                ].join(' ')}
              >
                {names[event] ?? (t('soundSettings.default-beep'))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => playSound(event)}
              className={button}
            >
              {t('soundSettings.test')}
            </button>
            <button
              type="button"
              onClick={() => inputs.current[event]?.click()}
              className={button}
            >
              {t('soundSettings.choose-file')}
            </button>
            {names[event] && (
              <button
                type="button"
                onClick={() => void resetCustomSound(event)}
                className={button}
              >
                {t('adjustFire.reset')}
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
        <p className="mt-2 rounded-md bg-app-raised px-3 py-2 text-sm text-danger">
          {error}
        </p>
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
