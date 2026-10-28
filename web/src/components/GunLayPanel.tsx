import { useEffect, useState } from 'react'

import { t } from '../i18n'
import { layFraction, layGuidance, type LaySettings } from '../lib/gunLay'
import {
  layDispatch,
  setLayTarget,
  setLayTracking,
  updateLaySettings,
  useGunLay,
} from '../lib/gunLayStore'
import { parseNumber } from '../lib/input'
import { FieldIcon } from './FieldIcon'
import { InlineNumber } from './FormControls'

interface ReadoutProps {
  elevation: number
  target: number | null
  settings: LaySettings
  // Крупный вариант для панели; в оверлее компактный
  large?: boolean
}

/**
 * Нужное и текущее возвышение, что сделать мышью и шкала от нижнего упора
 * до верхнего: засечка — нужный угол, точка — ствол в симуляции.
 */
export function LayReadout({ elevation, target, settings, large = false }: ReadoutProps) {
  const unitMil = t('unit.mil')

  if (target === null) {
    return (
      <p className="rounded-md bg-app-raised px-3 py-2 text-[13px] text-app-muted">
        {t('gunLay.no-target')}
      </p>
    )
  }

  const guidance = layGuidance(elevation, target, settings)
  const amount = `${Math.round(Math.abs(guidance.error))} ${unitMil}`
  const verdictText = {
    ok: t('gunLay.ok'),
    raise: t('gunLay.raise', amount),
    lower: t('gunLay.lower', amount),
    unreachable: t('gunLay.unreachable'),
  }[guidance.verdict]
  const tone =
    guidance.verdict === 'ok'
      ? 'text-ok'
      : guidance.verdict === 'unreachable'
        ? 'text-danger'
        : 'text-warn'
  const dot =
    guidance.verdict === 'ok'
      ? 'bg-ok'
      : guidance.verdict === 'unreachable'
        ? 'bg-danger'
        : 'bg-warn'

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 tabular-nums">
        <div>
          <p className="label">{t('gunLay.target')}</p>
          <p className={`readout font-semibold ${large ? 'text-[28px]' : 'text-3xl'}`}>
            {Math.round(target)}
            <span className="ml-1 text-[13px] font-normal text-app-muted">{unitMil}</span>
          </p>
        </div>
        <div>
          <p className="label">{t('gunLay.current')}</p>
          <p className={`readout font-semibold ${large ? 'text-[28px]' : 'text-3xl'}`}>
            {Math.round(elevation)}
            <span className="ml-1 text-[13px] font-normal text-app-muted">{unitMil}</span>
          </p>
        </div>
      </div>

      <p className={`mt-2 text-lg font-semibold ${tone}`} aria-live="polite">
        {verdictText}
        {(guidance.verdict === 'raise' || guidance.verdict === 'lower') && (
          <span className="ml-2 text-[12.5px] font-normal text-app-muted">
            {t('gunLay.counts', Math.abs(guidance.counts))}
          </span>
        )}
      </p>

      <div className="relative mt-3 h-3 rounded-full bg-app-raised" role="presentation">
        <span
          className="absolute top-1/2 h-5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-app-text"
          style={{ left: `${layFraction(target, settings) * 100}%` }}
        />
        <span
          className={`absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${dot}`}
          style={{ left: `${layFraction(elevation, settings) * 100}%` }}
        />
      </div>
    </div>
  )
}

type SettingKey = 'min' | 'max' | 'tolerance' | 'milPerCount'

const SETTING_FIELDS: readonly { key: SettingKey; label: () => string }[] = [
  { key: 'min', label: () => t('gunLay.low-stop') },
  { key: 'max', label: () => t('gunLay.high-stop') },
  { key: 'tolerance', label: () => t('gunLay.tolerance') },
  { key: 'milPerCount', label: () => t('gunLay.sensitivity') },
]

function display(value: number): string {
  return String(Math.round(value * 10000) / 10000)
}

/**
 * Наводка по мыши для танка. Игра не сообщает угол ствола, поэтому
 * программа повторяет движение мыши в своей симуляции и сравнивает угол
 * с нужным возвышением. Упоры ствола выравнивают симуляцию с игрой.
 */
export function GunLayPanel({ solutionElevation }: { solutionElevation: number | null }) {
  const { tracking, state, settings } = useGunLay()
  const unitMil = t('unit.mil')

  const [manual, setManual] = useState('')
  // Поле, которое сейчас набирают: пока набор не закончен, оно не перезаписывается
  const [editing, setEditing] = useState<{ key: SettingKey; text: string } | null>(null)

  const manualValue = parseNumber(manual)
  const target = manualValue ?? solutionElevation

  useEffect(() => setLayTarget(target), [target])

  function change(key: SettingKey, text: string) {
    setEditing({ key, text })
    const value = parseNumber(text)
    if (value === null) return
    // Диапазон и чувствительность не бывают нулевыми или перевёрнутыми
    if (key === 'milPerCount' && value <= 0) return
    if (key === 'tolerance' && value < 0) return
    if (key === 'min' && value >= settings.max) return
    if (key === 'max' && value <= settings.min) return
    updateLaySettings({ [key]: value } as Partial<LaySettings>)
  }

  return (
    <details className="disclosure panel p-4 sm:p-5" open>
      <summary>
        <span className="inline-flex min-w-0 items-center gap-2 text-app-text">
          <FieldIcon name="elevation" className="h-5 w-5 shrink-0 text-app-muted" />
          {t('gunLay.title')}
        </span>
        <span className={`tag shrink-0 ${tracking ? 'tag-info' : ''}`}>
          {tracking ? t('gunLay.tracking-on') : t('gunLay.tracking-off')}
        </span>
      </summary>

      <div className="mt-3 rounded-lg bg-app-raised p-3">
        <LayReadout
          elevation={state.elevation}
          target={target}
          settings={settings}
          large
        />
      </div>

      {state.calibration !== null && (
        <p className="mt-2 rounded-md bg-accent-soft px-3 py-2 text-[13px] text-app-text">
          {t('gunLay.calibrating')}
        </p>
      )}
      {!tracking && state.calibration === null && (
        <p className="mt-2 rounded-md bg-app-raised px-3 py-2 text-[13px] text-app-muted">
          {t('gunLay.paused')}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setLayTracking(!tracking)}
          title="Ctrl + Alt + G"
          className={`btn col-span-2 ${tracking ? '' : 'btn-primary'}`}
        >
          {tracking ? t('gunLay.stop') : t('gunLay.start')}
        </button>
        <button
          type="button"
          onClick={() => layDispatch({ type: 'low' })}
          title="Ctrl + Alt + B"
          className="btn"
        >
          {t('gunLay.low-stop')}
        </button>
        <button
          type="button"
          onClick={() => layDispatch({ type: 'high' })}
          title="Ctrl + Alt + T"
          className="btn"
        >
          {t('gunLay.high-stop')}
        </button>
        <button
          type="button"
          onClick={() => layDispatch({ type: 'calibrate' })}
          title="Ctrl + Alt + K"
          className="btn col-span-2"
        >
          {t('gunLay.calibrate')}
        </button>
      </div>

      <label className="mt-3 flex items-center justify-between gap-3 text-[14px] text-app-text-2">
        <span>{t('gunLay.manual')}</span>
        <span className="flex w-32 items-center gap-2">
          <InlineNumber
            id="gun-lay-manual"
            value={manual}
            onChange={setManual}
            unit={unitMil}
            placeholder={solutionElevation === null ? '' : String(Math.round(solutionElevation))}
            block
          />
        </span>
      </label>

      <div className="mt-3 space-y-2 border-t border-app-line-strong pt-3">
        {SETTING_FIELDS.map(({ key, label }) => (
          <label
            key={key}
            onBlur={() => setEditing(null)}
            className="flex items-center justify-between gap-3 text-[14px] text-app-text-2"
          >
            <span>{label()}</span>
            <span className="flex w-32 items-center gap-2">
              <InlineNumber
                id={`gun-lay-${key}`}
                value={editing?.key === key ? editing.text : display(settings[key])}
                onChange={(text) => change(key, text)}
                unit={key === 'milPerCount' ? '' : unitMil}
                block
              />
            </span>
          </label>
        ))}
        <label className="flex items-center gap-2 text-[14px] text-app-text-2">
          <input
            type="checkbox"
            checked={settings.invert}
            onChange={(event) => updateLaySettings({ invert: event.target.checked })}
          />
          {t('gunLay.invert')}
        </label>
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-app-muted">{t('gunLay.help')}</p>
    </details>
  )
}
