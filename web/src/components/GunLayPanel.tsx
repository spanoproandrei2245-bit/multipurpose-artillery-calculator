import { useEffect, useState } from 'react'

import { t } from '../i18n'
import {
  formatLay,
  fromDisplay,
  layFraction,
  layGuidance,
  toDisplay,
  type LaySettings,
} from '../lib/gunLay'
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
  // Градусы пишутся слитно (20.0°), мил с пробелом
  const unitMil = settings.degrees ? '°' : ' ' + t('unit.mil')

  if (target === null) {
    return (
      <p className="rounded-md bg-app-raised px-3 py-2 text-[13px] text-app-muted">
        {t('gunLay.no-target')}
      </p>
    )
  }

  const guidance = layGuidance(elevation, target, settings)
  const amount = `${formatLay(Math.abs(guidance.error), settings)}${unitMil}`
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
            {formatLay(target, settings)}
            <span className="text-[13px] font-normal text-app-muted">{unitMil}</span>
          </p>
        </div>
        <div>
          <p className="label">{t('gunLay.current')}</p>
          <p className={`readout font-semibold ${large ? 'text-[28px]' : 'text-3xl'}`}>
            {formatLay(elevation, settings)}
            <span className="text-[13px] font-normal text-app-muted">{unitMil}</span>
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

// Подпись поля получает название единицы: чувствительность «° на отсчёт»
const SETTING_FIELDS: readonly { key: SettingKey; label: (unit: string) => string }[] = [
  { key: 'min', label: () => t('gunLay.low-stop') },
  { key: 'max', label: () => t('gunLay.high-stop') },
  { key: 'tolerance', label: () => t('gunLay.tolerance') },
  { key: 'milPerCount', label: (unit) => t('gunLay.sensitivity', unit) },
]

function display(value: number, digits: number): string {
  const factor = 10 ** digits
  return String(Math.round(value * factor) / factor)
}

/**
 * Наводка по мыши для танка. Игра не сообщает угол ствола, поэтому
 * программа повторяет движение мыши в своей симуляции и сравнивает угол
 * с нужным возвышением. Упоры ствола выравнивают симуляцию с игрой.
 */
export function GunLayPanel({
  solutionElevation,
  limits = null,
}: {
  solutionElevation: number | null
  // Упоры ствола выбранной техники, мил; из справочника модели
  limits?: { minElevation: number; maxElevation: number } | null
}) {
  const { tracking, state, settings } = useGunLay()
  const unit = settings.degrees ? '°' : t('unit.mil')

  const [manual, setManual] = useState('')
  // Поле, которое сейчас набирают: пока набор не закончен, оно не перезаписывается
  const [editing, setEditing] = useState<{ key: SettingKey; text: string } | null>(null)

  // Свои значения вводятся в единицах показа (в игре угол виден в градусах)
  const [sync, setSync] = useState('')
  const manualValue = parseNumber(manual)
  const target =
    manualValue === null ? solutionElevation : fromDisplay(manualValue, settings)

  useEffect(() => setLayTarget(target), [target])

  // У техники в справочнике есть упоры ствола: они становятся пределами симуляции
  const limitMin = limits?.minElevation
  const limitMax = limits?.maxElevation
  useEffect(() => {
    if (limitMin === undefined || limitMax === undefined) return
    updateLaySettings({ min: limitMin, max: limitMax })
  }, [limitMin, limitMax])

  function change(key: SettingKey, text: string) {
    setEditing({ key, text })
    const typed = parseNumber(text)
    if (typed === null) return
    const value = fromDisplay(typed, settings)
    // Диапазон и чувствительность не бывают нулевыми или перевёрнутыми
    if (key === 'milPerCount' && value <= 0) return
    if (key === 'tolerance' && value < 0) return
    if (key === 'min' && value >= settings.max) return
    if (key === 'max' && value <= settings.min) return
    updateLaySettings({ [key]: value } as Partial<LaySettings>)
  }

  function applySync() {
    const typed = parseNumber(sync)
    if (typed === null) return
    layDispatch({ type: 'set', elevation: fromDisplay(typed, settings) })
    setSync('')
  }

  function chooseUnit(degrees: boolean) {
    if (degrees === settings.degrees) return
    updateLaySettings({ degrees })
    // Введённые числа были в прежних единицах
    setManual('')
    setSync('')
    setEditing(null)
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

      {/* Угол из игры (EL на экране прицела): сверка в любой точке, не только на упорах */}
      <div className="mt-3 flex items-center justify-between gap-3 text-[14px] text-app-text-2">
        <label htmlFor="gun-lay-sync">{t('gunLay.sync')}</label>
        <span className="flex items-center gap-2">
          <span className="flex w-24 items-center gap-2">
            <InlineNumber id="gun-lay-sync" value={sync} onChange={setSync} unit={unit} block />
          </span>
          <button type="button" onClick={applySync} disabled={parseNumber(sync) === null} className="btn">
            {t('gunLay.sync-apply')}
          </button>
        </span>
      </div>

      <label className="mt-3 flex items-center justify-between gap-3 text-[14px] text-app-text-2">
        <span>{t('gunLay.manual')}</span>
        <span className="flex w-32 items-center gap-2">
          <InlineNumber
            id="gun-lay-manual"
            value={manual}
            onChange={setManual}
            unit={unit}
            placeholder={solutionElevation === null ? '' : formatLay(solutionElevation, settings)}
            block
          />
        </span>
      </label>

      <div className="mt-3 space-y-2 border-t border-app-line-strong pt-3">
        <div className="flex gap-1" role="group">
          {[true, false].map((degrees) => (
            <button
              key={String(degrees)}
              type="button"
              onClick={() => chooseUnit(degrees)}
              aria-pressed={settings.degrees === degrees}
              className={[
                'flex-1 cursor-pointer rounded-md px-2 py-1 text-[13px] font-medium',
                settings.degrees === degrees
                  ? 'bg-app-raised-hover text-app-text'
                  : 'bg-app-raised text-app-muted hover:text-app-text',
              ].join(' ')}
            >
              {degrees ? '°' : t('unit.mil')}
            </button>
          ))}
        </div>
        {SETTING_FIELDS.map(({ key, label }) => (
          <label
            key={key}
            onBlur={() => setEditing(null)}
            className="flex items-center justify-between gap-3 text-[14px] text-app-text-2"
          >
            <span>{label(unit)}</span>
            <span className="flex w-32 items-center gap-2">
              <InlineNumber
                id={`gun-lay-${key}`}
                value={
                  editing?.key === key
                    ? editing.text
                    : display(toDisplay(settings[key], settings), key === 'milPerCount' ? 4 : 2)
                }
                onChange={(text) => change(key, text)}
                unit={key === 'milPerCount' ? '' : unit}
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
