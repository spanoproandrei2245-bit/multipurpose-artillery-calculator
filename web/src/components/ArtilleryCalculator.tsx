import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { artilleryRegistry } from '../data/artillery/registry'
import type { ModelId } from '../data/models'
import {
  degToMil,
  isLargeCorrection,
  lateralCorrectionMil,
  milToDeg,
  MILS_PER_TURN,
  normalizeAngle,
  overallRange,
  profileHasWeather,
  pickCharge,
  solveAllCharges,
  type ChargePreference,
} from '../lib/ballistics'
import {
  formatSigned,
  isInvalid,
  numberToField,
  parseNumber,
  readStored,
  readStoredText,
  writeStored,
} from '../lib/input'
import { reportToAdjustment, sumAdjustments } from '../lib/adjust'
import type { MrsiOption } from '../lib/mrsi'
import type {
  AngleUnit,
  JournalDraft,
  JournalEntry,
  MapTarget,
} from '../lib/journal'
import {
  isDesktop,
  notifyOverlayShot,
  onHotkey,
  onOverlayCommand,
  onSolutionRequest,
  publishSolution,
  type HotkeyAction,
  type OverlayCommand,
  type OverlayState,
} from '../lib/desktop'
import type { SyncSolution } from '../lib/sync'
import { useSync } from '../lib/syncContext'
import { useHotkeys, type HotkeyMap } from '../lib/useHotkeys'
import { useWeatherInputs } from '../lib/useWeatherInputs'
import type { ArtilleryMode } from '../types/artillery'
import type { Language } from '../types/settings'
import { AdjustFire, type AdjustmentEntry } from './AdjustFire'
import { AmmunitionSelector } from './AmmunitionSelector'
import { Dropdown } from './Dropdown'
import { FieldIcon } from './FieldIcon'
import { BallisticTableView } from './BallisticTableView'
import { CombatScreen } from './CombatScreen'
import { FireTimer, type FireTimerHandle } from './FireTimer'
import { InlineNumber, Row, SectionHeading, Toggle } from './FormControls'
import { GridInput } from './GridInput'
import { MrsiPanel } from './MrsiPanel'
import { SyncStatusLine } from './SyncStatusLine'
import { TotPanel } from './TotPanel'
import { fireMoment } from '../lib/tot'
import { WeatherSection } from './WeatherSection'

const MODES: readonly ArtilleryMode[] = ['HIGH', 'LOW']

// Релизы с установщиком программы для ПК
const RELEASES_URL =
  'https://github.com/spanoproandrei2245-bit/multipurpose-artillery-calculator/releases'

// Карта с рельефом и распознаванием экрана — отдельным чанком:
// расчёт открывается раньше, карта догружается следом.
const MapPicker = lazy(() =>
  import('./MapPicker').then((m) => ({ default: m.MapPicker }))
)

interface Props {
  modelId: ModelId
  language: Language
  // Запись журнала, из которой восстановлены вводные
  initial?: JournalEntry | null
  // Экспериментальный ввод по координатам сетки (из настроек)
  gridInput?: boolean
  // Экспериментальная карта с высотами (из настроек)
  mapInput?: boolean
  // Выбор модели — в одной строке с выбором боеприпаса
  modelSelector?: ReactNode
  // Полоска быстрого выбора сохранённых целей
  targetBar?: ReactNode
  // Цель из журнала, с которой сейчас работаем: её можно обновить
  activeEntry?: Pick<JournalEntry, 'id' | 'name'> | null
  // Все цели журнала — для отметок на карте
  journalEntries?: readonly JournalEntry[]
  onLoadEntry?: (id: string) => void
  onSave: (draft: JournalDraft) => void
  onUpdate?: (id: string, draft: JournalDraft) => void
}

export function ArtilleryCalculator({
  modelId,
  language,
  initial = null,
  gridInput = false,
  mapInput = false,
  modelSelector,
  targetBar,
  activeEntry = null,
  journalEntries = [],
  onLoadEntry,
  onSave,
  onUpdate,
}: Props) {
  const ru = language === 'ru'
  const reference = artilleryRegistry[modelId]
  const ammunition = reference.ammunition ?? []

  // Режим из загруженной записи журнала, если модель его поддерживает
  const [mode, setMode] = useState<ArtilleryMode>(() =>
    initial?.mode && reference.availableModes.includes(initial.mode)
      ? initial.mode
      : reference.availableModes[0]
  )
  const [ammoId, setAmmoId] = useState(
    initial && ammunition.some((a) => a.id === initial.ammoId)
      ? initial.ammoId
      : (ammunition[0]?.id ?? '')
  )
  const [distance, setDistance] = useState(numberToField(initial?.distance))
  // Высота орудия: блокировка сохраняет значение между запусками и
  // защищает его от карты, журнала и «Сброса».
  const [heightLocked, setHeightLocked] = useState(
    () => readStored<'on' | 'off'>('ownHeightLocked', ['on', 'off'], 'off') === 'on'
  )
  const [ownHeight, setOwnHeightRaw] = useState(() =>
    readStored<'on' | 'off'>('ownHeightLocked', ['on', 'off'], 'off') === 'on'
      ? readStoredText('ownHeightValue')
      : numberToField(initial?.ownHeight)
  )
  const setOwnHeight = (value: string) => {
    if (!heightLocked) setOwnHeightRaw(value)
  }
  useEffect(() => {
    writeStored('ownHeightLocked', heightLocked ? 'on' : 'off')
    if (heightLocked) writeStored('ownHeightValue', ownHeight)
  }, [heightLocked, ownHeight])
  const [targetHeight, setTargetHeight] = useState(
    numberToField(initial?.targetHeight)
  )
  const [azimuth, setAzimuth] = useState(numberToField(initial?.azimuth))
  // Точка цели на карте, если цель ставили на карте; ручная правка
  // дистанции или азимута её сбрасывает.
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(
    initial?.target ?? null
  )
  const [azimuthUnit, setAzimuthUnit] = useState<AngleUnit>(
    () =>
      initial?.azimuthUnit ??
      readStored<AngleUnit>('azimuthUnit', ['mil', 'deg'], 'mil')
  )

  // История докладов корректировки. Из журнала приходит только итог —
  // он становится одной записью истории.
  const [adjustHistory, setAdjustHistory] = useState<AdjustmentEntry[]>(
    () => {
      const range = initial?.rangeCorrection ?? 0
      const lateral = initial?.lateralCorrection ?? 0
      return range !== 0 || lateral !== 0
        ? [{ range, lateral, label: ru ? 'из журнала' : 'from journal' }]
        : []
    }
  )
  const { range: rangeAdjust, lateral: lateralAdjust } =
    sumAdjustments(adjustHistory)

  // Огонь по времени: момент разрыва, мс
  const [totAt, setTotAt] = useState<number | null>(null)

  const [chosenCharge, setChosenCharge] = useState<number | null>(
    initial?.charge ?? null
  )
  const [saveName, setSaveName] = useState('')
  const [justSaved, setJustSaved] = useState<'saved' | 'updated' | null>(
    null
  )

  const [chargePreference, setChargePreference] =
    useState<ChargePreference>(() =>
      readStored<ChargePreference>(
        'chargePreference',
        ['lowest', 'fastest', 'precise'],
        'lowest'
      )
    )

  useEffect(() => {
    writeStored('azimuthUnit', azimuthUnit)
  }, [azimuthUnit])

  useEffect(() => {
    writeStored('chargePreference', chargePreference)
  }, [chargePreference])

  const selectedAmmo =
    ammunition.find((ammo) => ammo.id === ammoId) ?? ammunition[0]

  const profile =
    selectedAmmo?.profile !== undefined
      ? reference.profiles?.[selectedAmmo.profile]
      : undefined

  const hasWeather = profile !== undefined && profileHasWeather(profile)

  // ---- ввод ----
  const distanceValue = parseNumber(distance)
  const validDistance = distanceValue !== null && distanceValue > 0

  const own = parseNumber(ownHeight)
  const target = parseNumber(targetHeight)

  const bothHeightsEmpty =
    ownHeight.trim() === '' && targetHeight.trim() === ''
  const bothHeightsValid = own !== null && target !== null

  // Если высоты не введены или введены не полностью, поправка
  // на высоту не применяется (разница = 0).
  const heightDifference = bothHeightsValid ? target - own : 0
  const heightIncomplete = !bothHeightsEmpty && !bothHeightsValid

  // Дистанция с корректировкой; погодная поправка добавляется
  // при расчёте отдельно для каждого заряда.
  const baseRange = validDistance ? distanceValue + rangeAdjust : null

  const azimuthValue = parseNumber(azimuth)
  const azimuthMil =
    azimuthValue === null
      ? null
      : azimuthUnit === 'mil'
        ? azimuthValue
        : degToMil(azimuthValue)
  const azimuthDeg =
    azimuthValue === null
      ? null
      : azimuthUnit === 'mil'
        ? milToDeg(azimuthValue)
        : azimuthValue

  const weatherInputs = useWeatherInputs(
    initial?.weather ?? null,
    hasWeather,
    azimuthDeg
  )

  const invalidInputs = [
    distance,
    azimuth,
    ownHeight,
    targetHeight,
    ...(hasWeather ? weatherInputs.fields : []),
  ].some(isInvalid)

  // ---- расчёт ----
  const results =
    profile && baseRange !== null
      ? solveAllCharges(
          profile,
          mode,
          selectedAmmo?.charges,
          baseRange,
          heightDifference,
          weatherInputs.weather
        )
      : []

  const applicable = results.filter((r) => r.solution !== null)

  // Режимы, для которых у боеприпаса есть таблицы
  const profileModes = MODES.filter(
    (item) => profile?.modes[item] !== undefined
  )

  // Явно выбранный заряд важнее предпочтения по умолчанию.
  const activeResult =
    applicable.find((r) => r.charge === chosenCharge) ??
    pickCharge(results, chargePreference)

  const solution = activeResult?.solution ?? null
  const range = overallRange(results)
  const w = solution?.weather

  // Доворот: боковой ветер + корректировка по направлению, мил.
  const lateralMil =
    validDistance && lateralAdjust !== 0
      ? lateralCorrectionMil(lateralAdjust, distanceValue)
      : 0
  const azimuthCorrectionMil = (w?.azimuth ?? 0) + lateralMil

  // Азимут стрельбы в единицах ввода.
  const firingAzimuth =
    azimuthValue === null || !solution
      ? null
      : azimuthUnit === 'mil'
        ? normalizeAngle(azimuthValue + azimuthCorrectionMil, MILS_PER_TURN)
        : normalizeAngle(azimuthValue + milToDeg(azimuthCorrectionMil), 360)

  // ---- горячие клавиши ----
  const timerRef = useRef<FireTimerHandle>(null)
  const [showKeys, setShowKeys] = useState(false)
  const [combatOpen, setCombatOpen] = useState(false)

  function focusField(id: string) {
    const field = document.getElementById(id)
    if (field instanceof HTMLInputElement) {
      field.focus()
      field.select()
    }
  }

  function selectCharge(charge: number) {
    if (applicable.some((r) => r.charge === charge)) {
      setChosenCharge(charge)
      markEdited()
    }
  }

  const hotkeys: HotkeyMap = {
    KeyF: () => timerRef.current?.fire(),
    Escape: () => {
      // Сначала закрывается боевой экран, затем останавливается таймер
      if (combatOpen) setCombatOpen(false)
      else timerRef.current?.stop()
      setShowKeys(false)
    },
    KeyB: () => {
      if (solution) setCombatOpen((value) => !value)
    },
    KeyM: () => {
      if (profileModes.length > 1) {
        changeMode(mode === 'HIGH' ? 'LOW' : 'HIGH')
      }
    },
    KeyD: () => focusField('calc-distance'),
    KeyA: () => focusField('calc-azimuth'),
    KeyC: () => {
      const details = document.getElementById('adjust-fire')
      if (details instanceof HTMLDetailsElement) details.open = true
      focusField('adjust-range')
    },
    Question: () => setShowKeys((value) => !value),
  }
  for (let charge = 0; charge <= 9; charge += 1) {
    hotkeys[`Digit${charge}`] = () => selectCharge(charge)
    hotkeys[`Numpad${charge}`] = () => selectCharge(charge)
  }
  useHotkeys(hotkeys)

  function changeMode(value: ArtilleryMode) {
    if (value === mode) return
    setMode(value)
    setChosenCharge(null)
    markEdited()
  }

  function markEdited() {
    setJustSaved(null)
  }

  function edited(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      markEdited()
    }
  }

  function resetForm() {
    setMapTarget(null)
    setDistance('')
    setOwnHeight('')
    setTargetHeight('')
    setAzimuth('')
    setAdjustHistory([])
    setChosenCharge(null)
    setSaveName('')
    markEdited()
  }

  function handleAmmoChange(id: string) {
    setAmmoId(id)
    setChosenCharge(null)
    markEdited()
  }

  function changeAzimuthUnit(unit: AngleUnit) {
    if (unit === azimuthUnit) return
    // Пересчитываем уже введённый азимут в новые единицы.
    if (azimuthValue !== null) {
      const converted =
        unit === 'mil' ? degToMil(azimuthValue) : milToDeg(azimuthValue)
      setAzimuth(String(Math.round(converted * 10) / 10))
    }
    setAzimuthUnit(unit)
    markEdited()
  }

  function buildDraft(name: string): JournalDraft | null {
    if (!solution || !activeResult || !selectedAmmo) return null
    if (distanceValue === null) return null

    return {
      name,
      modelId,
      ammoId: selectedAmmo.id,
      charge: activeResult.charge,
      distance: distanceValue,
      ownHeight: bothHeightsValid ? own : null,
      targetHeight: bothHeightsValid ? target : null,
      rangeCorrection: rangeAdjust,
      lateralCorrection: lateralAdjust,
      elevation: solution.elevation,
      tof: solution.tof,
      azimuth: azimuthValue,
      azimuthUnit,
      firingAzimuth,
      weather: weatherInputs.toJournal(),
      mode,
      target: mapTarget,
    }
  }

  function handleSave() {
    const defaultName = `${ru ? 'Цель' : 'Target'} ${distanceValue} ${
      ru ? 'м' : 'm'
    }`
    const draft = buildDraft(saveName.trim() || defaultName)
    if (!draft) return

    onSave(draft)
    setSaveName('')
    setJustSaved('saved')
  }

  // Перезаписать текущую цель: те же имя и запись, новые вводные.
  function handleUpdate() {
    if (!activeEntry || !onUpdate) return
    const draft = buildDraft(activeEntry.name)
    if (!draft) return

    onUpdate(activeEntry.id, draft)
    setJustSaved('updated')
  }

  const unitM = ru ? 'м' : 'm'
  const unitMil = ru ? 'мил' : 'mil'
  const unitS = ru ? 'с' : 's'
  const unitAzimuth = azimuthUnit === 'mil' ? unitMil : '°'

  function formatAzimuth(value: number): string {
    return azimuthUnit === 'mil' ? value.toFixed(0) : value.toFixed(1)
  }

  function describeTurn(mil: number): string {
    const side = mil > 0 ? (ru ? 'вправо' : 'right') : ru ? 'влево' : 'left'
    return `${side} ${Math.abs(mil).toFixed(1)} ${unitMil}`
  }

  const totalRangeCorrection = rangeAdjust + (w?.total ?? 0)

  // ---- одновременный удар: все заряды во всех режимах ----
  const mrsiOptions: MrsiOption[] =
    profile && baseRange !== null
      ? profileModes.flatMap((item) =>
          (item === mode
            ? results
            : solveAllCharges(
                profile,
                item,
                selectedAmmo?.charges,
                baseRange,
                heightDifference,
                weatherInputs.weather
              )
          ).flatMap((result) =>
            result.solution
              ? [
                  {
                    mode: item,
                    charge: result.charge,
                    elevation: result.solution.elevation,
                    tof: result.solution.tof,
                  },
                ]
              : []
          )
        )
      : []

  // ---- цели журнала, поставленные на карте ----
  const activeEntryId = activeEntry?.id ?? null
  const journalTargets = useMemo(
    () =>
      journalEntries.flatMap((entry) =>
        entry.target
          ? [
              {
                id: entry.id,
                name: entry.name,
                target: entry.target,
                active: entry.id === activeEntryId,
              },
            ]
          : []
      ),
    [journalEntries, activeEntryId]
  )

  // ---- программа для ПК: оверлей поверх игры и глобальные клавиши ----
  const overlayState: OverlayState = {
    language,
    title: reference.name,
    targetName: activeEntry?.name ?? null,
    mode,
    modes: profileModes,
    charges: applicable.map((r) => r.charge),
    azimuthUnit: unitAzimuth,
    fields: { distance, azimuth, ownHeight, targetHeight },
    adjust: {
      range: rangeAdjust,
      lateral: lateralAdjust,
      count: adjustHistory.length,
    },
    fireAt:
      totAt !== null && solution ? fireMoment(totAt, solution.tof) : null,
    solution:
      solution && activeResult
        ? {
            charge: activeResult.charge,
            mode,
            elevation: solution.elevation,
            azimuth:
              firingAzimuth === null ? null : formatAzimuth(firingAzimuth),
            azimuthUnit: unitAzimuth,
            tof: solution.tof,
          }
        : null,
  }
  // Строка — чтобы отправлять в оверлей только реальные изменения
  const overlayJson = JSON.stringify(overlayState)
  const overlayJsonRef = useRef(overlayJson)

  useEffect(() => {
    overlayJsonRef.current = overlayJson
    publishSolution(JSON.parse(overlayJson))
  }, [overlayJson])

  useEffect(
    () =>
      onSolutionRequest(() =>
        publishSolution(JSON.parse(overlayJsonRef.current))
      ),
    []
  )

  // Обработчик глобальных клавиш видит актуальное состояние через ref
  const globalHotkeyRef = useRef<(action: HotkeyAction) => void>(() => {})
  useEffect(() => {
    globalHotkeyRef.current = (action) => {
      if (action === 'fire') timerRef.current?.fire()
      if (action === 'mode') hotkeys.KeyM()
    }
  })
  useEffect(() => onHotkey((action) => globalHotkeyRef.current(action)), [])

  // Ввод из оверлея — те же действия, что и в основном окне
  function describeSpot(over: number, right: number): string {
    const parts: string[] = []
    if (over !== 0) {
      const side =
        over > 0 ? (ru ? 'перелёт' : 'over') : ru ? 'недолёт' : 'short'
      parts.push(`${side} ${Math.abs(over)}`)
    }
    if (right !== 0) {
      const side =
        right > 0 ? (ru ? 'правее' : 'right') : ru ? 'левее' : 'left'
      parts.push(`${side} ${Math.abs(right)}`)
    }
    return `${parts.join(', ')} (${ru ? 'оверлей' : 'overlay'})`
  }

  const overlayCommandRef = useRef<(command: OverlayCommand) => void>(
    () => {}
  )
  useEffect(() => {
    overlayCommandRef.current = (command) => {
      switch (command.type) {
        case 'field': {
          const setters = {
            distance: setDistance,
            azimuth: setAzimuth,
            ownHeight: setOwnHeight,
            targetHeight: setTargetHeight,
          }
          edited(setters[command.field])(command.value)
          if (command.field === 'distance' || command.field === 'azimuth') {
            setMapTarget(null)
          }
          break
        }
        case 'charge':
          selectCharge(command.charge)
          break
        case 'mode':
          hotkeys.KeyM()
          break
        case 'spot':
          if (command.over === 0 && command.right === 0) break
          setAdjustHistory((list) => [
            ...list,
            {
              ...reportToAdjustment(command),
              label: describeSpot(command.over, command.right),
            },
          ])
          markEdited()
          break
        case 'undo-adjust':
          setAdjustHistory((list) => list.slice(0, -1))
          markEdited()
          break
      }
    }
  })
  useEffect(
    () => onOverlayCommand((command) => overlayCommandRef.current(command)),
    []
  )

  // ---- связка: наводчик отправляет установки, выстрел — у всех ----
  const sync = useSync()
  const sharing = sync.enabled && sync.role === 'computer'
  const syncSolution: SyncSolution | null = overlayState.solution
    ? {
        ...overlayState.solution,
        title: reference.name,
        targetName: activeEntry?.name ?? null,
        tot: totAt,
      }
    : null
  const syncJson = JSON.stringify(syncSolution)
  const { shareSolution, onShot, sendShot } = sync

  useEffect(() => {
    if (sharing) shareSolution(JSON.parse(syncJson))
  }, [sharing, syncJson, shareSolution])

  useEffect(
    () =>
      onShot(() => {
        timerRef.current?.remoteFire()
        notifyOverlayShot()
      }),
    [onShot]
  )

  function handleFire() {
    notifyOverlayShot()
    if (sync.active) sendShot()
  }

  const chargeValue =
    chosenCharge !== null && applicable.some((r) => r.charge === chosenCharge)
      ? String(chosenCharge)
      : 'auto'

  const alertClass = 'rounded-md bg-app-raised px-3 py-2 text-[13.5px]'

  return (
    <section>
      <div
        className={[
          'grid items-start gap-8 lg:gap-10',
          mapInput ? 'lg:grid-cols-2' : 'mx-auto max-w-xl',
        ].join(' ')}
      >
        {/* ---- Карта ---- */}
        {(mapInput || gridInput) && (
          <div className="min-w-0">
            {mapInput && (
              <Suspense
                fallback={
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-app-surface">
                    <p className="label">
                      {ru ? 'Загрузка карты…' : 'Loading the map…'}
                    </p>
                  </div>
                }
              >
                <MapPicker
                  language={language}
                  currentTarget={mapTarget}
                  journalTargets={journalTargets}
                  onPickJournalTarget={onLoadEntry}
                  onApply={(selection) => {
                    setDistance(String(Math.round(selection.distance)))
                    setAzimuth(
                      azimuthUnit === 'mil'
                        ? String(Math.round(selection.azimuthMil))
                        : String(
                            Math.round(milToDeg(selection.azimuthMil) * 10) / 10
                          )
                    )
                    setOwnHeight(String(Math.round(selection.ownHeight)))
                    setTargetHeight(String(Math.round(selection.targetHeight)))
                    setMapTarget(selection.target)
                    markEdited()
                  }}
                />
              </Suspense>
            )}

            {gridInput && (
              <GridInput
                azimuthUnit={azimuthUnit}
                language={language}
                onApply={(gridDistance, gridAzimuth) => {
                  setDistance(String(gridDistance))
                  setAzimuth(String(gridAzimuth))
                  setMapTarget(null)
                  markEdited()
                }}
              />
            )}
          </div>
        )}

        {/* ---- Решение и вводные: «подпись — значение» ---- */}
        <div className="min-w-0">
          <dl>
            <Row icon="elevation" label={ru ? 'Возвышение' : 'Elevation'}>
              <span
                className={[
                  'text-2xl font-semibold tabular-nums',
                  solution ? 'text-app-text' : 'text-app-faint',
                ].join(' ')}
              >
                {solution ? Math.round(solution.elevation) : '—'}
              </span>
              <span className="w-7 text-left text-app-muted">{unitMil}</span>
            </Row>
            <Row icon="azimuth" label={ru ? 'Азимут' : 'Azimuth'}>
              <span
                className={[
                  'text-2xl font-semibold tabular-nums',
                  firingAzimuth === null ? 'text-app-faint' : 'text-app-text',
                ].join(' ')}
              >
                {firingAzimuth === null ? '—' : formatAzimuth(firingAzimuth)}
              </span>
              <span className="w-7 text-left text-app-muted">
                {unitAzimuth}
              </span>
            </Row>
            <Row icon="time" label={ru ? 'Время полёта' : 'Time of flight'}>
              {solution ? solution.tof.toFixed(1) : '—'}
              <span className="w-7 text-left text-app-muted">{unitS}</span>
            </Row>
            <Row icon="charge" label={ru ? 'Заряд' : 'Charge'}>
              {/* «Быстрый» — заряд с наименьшим временем полёта,
                  «точный» — с наименьшим «1 мил ≈ X м». Оба
                  пересчитываются при смене дистанции. */}
              <div role="group" aria-label={ru ? 'Выбор заряда' : 'Charge choice'} className="seg">
                {(['fastest', 'precise'] as const).map((preference) => (
                  <button
                    key={preference}
                    type="button"
                    disabled={applicable.length === 0}
                    aria-pressed={
                      chosenCharge === null && chargePreference === preference
                    }
                    onClick={() => {
                      setChargePreference(preference)
                      setChosenCharge(null)
                      markEdited()
                    }}
                  >
                    {preference === 'fastest'
                      ? ru ? 'быстрый' : 'fast'
                      : ru ? 'точный' : 'precise'}
                  </button>
                ))}
              </div>
              <Dropdown
                label={ru ? 'Заряд' : 'Charge'}
                disabled={applicable.length === 0}
                value={chargeValue}
                onChange={(value) => {
                  if (value === 'auto') setChargePreference('lowest')
                  setChosenCharge(value === 'auto' ? null : Number(value))
                  markEdited()
                }}
                options={[
                  {
                    value: 'auto',
                    label:
                      (ru ? 'Авто' : 'Auto') +
                      (activeResult && chargeValue === 'auto'
                        ? ` · ${activeResult.charge}`
                        : ''),
                    description: ru ? 'наименьший подходящий' : 'lowest that fits',
                  },
                  ...applicable.map((result) => ({
                    value: String(result.charge),
                    label: `${ru ? 'Заряд' : 'Charge'} ${result.charge}`,
                    description: result.solution
                      ? `${Math.round(result.solution.elevation)} ${unitMil} · ${result.solution.tof.toFixed(1)} ${unitS}`
                      : undefined,
                  })),
                ]}
              />
            </Row>
            {profileModes.length > 1 && (
              <Row icon="trajectory" label={ru ? 'Траектория' : 'Trajectory'}>
                <Toggle
                  label={ru ? 'Режим траектории' : 'Trajectory mode'}
                  value={mode}
                  onChange={changeMode}
                  options={profileModes.map((item) => ({
                    value: item,
                    label:
                      item === 'HIGH'
                        ? ru
                          ? 'Навесная'
                          : 'High'
                        : ru
                          ? 'Настильная'
                          : 'Low',
                  }))}
                />
              </Row>
            )}
          </dl>

          <div className="my-3 h-px bg-app-border" />

          <dl>
            <Row icon="distance" label={ru ? 'Дистанция' : 'Distance'} htmlFor="calc-distance">
              <InlineNumber
                id="calc-distance"
                value={distance}
                onChange={edited((value) => {
                  setDistance(value)
                  setMapTarget(null)
                })}
                unit={unitM}
              />
            </Row>
            <Row icon="azimuth" label={ru ? 'Азимут на цель' : 'Target bearing'} htmlFor="calc-azimuth">
              <Toggle
                label={ru ? 'Единицы азимута' : 'Azimuth units'}
                value={azimuthUnit}
                onChange={changeAzimuthUnit}
                options={[
                  { value: 'mil', label: unitMil },
                  { value: 'deg', label: '°' },
                ]}
              />
              <InlineNumber
                id="calc-azimuth"
                value={azimuth}
                onChange={edited((value) => {
                  setAzimuth(value)
                  setMapTarget(null)
                })}
                placeholder={ru ? 'не задан' : 'not set'}
              />
            </Row>
            <Row icon="targetHeight" label={ru ? 'Высота цели' : 'Target height'} htmlFor="calc-target-height">
              <InlineNumber
                id="calc-target-height"
                value={targetHeight}
                onChange={edited(setTargetHeight)}
                unit={unitM}
              />
            </Row>
          </dl>

          <div className="my-3 h-px bg-app-border" />

          <dl>
            <Row icon="weapon" label={ru ? 'Орудие' : 'Weapon'}>{modelSelector}</Row>
            <Row icon="gunHeight" label={ru ? 'Высота орудия' : 'Gun height'} htmlFor="calc-own-height">
              <button
                type="button"
                aria-pressed={heightLocked}
                aria-label={
                  heightLocked
                    ? ru ? 'Разблокировать высоту орудия' : 'Unlock gun height'
                    : ru ? 'Заблокировать высоту орудия' : 'Lock gun height'
                }
                title={
                  heightLocked
                    ? ru ? 'Высота закреплена: её не меняют карта, журнал и сброс' : 'Locked: map, journal and reset leave it alone'
                    : ru ? 'Закрепить высоту орудия' : 'Lock the gun height'
                }
                onClick={() => setHeightLocked((v) => !v)}
                className={[
                  'inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition-colors',
                  heightLocked
                    ? 'bg-accent-soft text-accent'
                    : 'bg-app-raised text-app-muted hover:bg-app-raised-hover hover:text-app-text',
                ].join(' ')}
              >
                <FieldIcon name={heightLocked ? 'lock' : 'unlock'} className="h-[18px] w-[18px]" />
              </button>
              <InlineNumber
                id="calc-own-height"
                value={ownHeight}
                onChange={edited(setOwnHeight)}
                readOnly={heightLocked}
                unit={unitM}
              />
            </Row>
            <Row icon="shell" label={ru ? 'Снаряд' : 'Shell'}>
              <AmmunitionSelector
                ammunition={ammunition}
                selectedId={ammoId}
                onSelect={handleAmmoChange}
                language={language}
              />
            </Row>
          </dl>

          {targetBar}

          {/* ---- Состояние расчёта и предупреждения ---- */}
          <div className="mt-4 space-y-2">
            {!profile && (
              <p className={`${alertClass} text-app-muted`}>
                {ru
                  ? 'Для этого боеприпаса нет таблиц.'
                  : 'No tables for this ammunition.'}
              </p>
            )}

            {profile && validDistance && applicable.length === 0 && range && (
              <p className={`${alertClass} text-warn`}>
                {rangeAdjust !== 0
                  ? ru
                    ? `Дальность ${baseRange} м (дистанция ${distanceValue} м, корректировка ${formatSigned(rangeAdjust, 0)} м) вне таблиц. Доступно: ${range.min}–${range.max} м.`
                    : `Range ${baseRange} m (distance ${distanceValue} m, adjustment ${formatSigned(rangeAdjust, 0)} m) is outside the tables. Available: ${range.min}–${range.max} m.`
                  : ru
                    ? `Дистанция ${distanceValue} м вне таблиц. Доступно: ${range.min}–${range.max} м.`
                    : `Distance ${distanceValue} m is outside the tables. Available: ${range.min}–${range.max} m.`}
                {weatherInputs.entered &&
                  (ru
                    ? ' С погодной поправкой дальность могла выйти за край таблицы.'
                    : ' The weather correction may have pushed the range past the table edge.')}
              </p>
            )}

            {heightIncomplete && (
              <p className={`${alertClass} text-app-muted`}>
                {ru
                  ? 'Введите обе высоты — пока поправка на высоту не применяется.'
                  : 'Enter both heights — no height correction is applied yet.'}
              </p>
            )}

            {invalidInputs && (
              <p className={`${alertClass} text-danger`}>
                {ru
                  ? 'Некоторые значения не распознаны (подсвечены) и не применяются.'
                  : 'Some values were not recognised (highlighted) and are not applied.'}
              </p>
            )}

            {solution && activeResult && w && (
              <>
                {w.missing && (
                  <p className={`${alertClass} text-app-muted`}>
                    {ru
                      ? 'На этой дальности в таблице нет части погодных поправок (прочерк «-»). Они не применены.'
                      : 'The table lacks some weather corrections at this range ("-"). They are not applied.'}
                  </p>
                )}
                {solution.heightCorrectionMissing && (
                  <p className={`${alertClass} text-app-muted`}>
                    {ru
                      ? 'На этой дальности в таблице игры нет поправки на высоту (прочерк «-»). Результат дан без неё.'
                      : 'The game table has no height correction at this range ("-"). The result is shown without it.'}
                  </p>
                )}
                {activeResult.nearEdge && (
                  <p className={`${alertClass} text-warn`}>
                    {ru
                      ? `Заряд ${activeResult.charge} у края своей таблицы: поправки на погоду и высоту здесь менее надёжны. Если есть заряд выше — лучше взять его.`
                      : `Charge ${activeResult.charge} is at the edge of its table: weather and height corrections are less reliable here. Prefer a higher charge if available.`}
                  </p>
                )}
                {activeResult.wideGap && (
                  <p className={`${alertClass} text-warn`}>
                    {ru
                      ? 'В таблице игры здесь пропущены строки: значение интерполировано по далёким соседям, точность ниже. Сверьте с таблицей ниже.'
                      : 'The game table skips rows here: the value is interpolated between distant rows, accuracy is lower. Check the table below.'}
                  </p>
                )}
                {isLargeCorrection(solution) && (
                  <p className={`${alertClass} text-app-muted`}>
                    {ru
                      ? 'Большая разница высот: поправка линейная, точность снижена.'
                      : 'Large height difference: the correction is linear, accuracy is reduced.'}
                  </p>
                )}
              </>
            )}
          </div>

          {solution && activeResult && w && (
            <>
              <ul className="mt-3 space-y-0.5 text-[13px] text-app-muted">
                <li>
                  {ru ? 'По таблице' : 'Table value'}:{' '}
                  {solution.baseElevation.toFixed(1)} {unitMil}
                  {' · '}
                  {ru ? 'высота' : 'height'}{' '}
                  {formatSigned(solution.elevationCorrection)} {unitMil},{' '}
                  {formatSigned(solution.tofCorrection)} {unitS}
                </li>

                {totalRangeCorrection !== 0 && (
                  <li>
                    {ru ? 'Дальность по таблице' : 'Table range'}:{' '}
                    {solution.lookupRange.toFixed(0)} {unitM}
                    {rangeAdjust !== 0 &&
                      ` · ${ru ? 'корректировка' : 'adjust'} ${formatSigned(rangeAdjust, 0)} ${unitM}`}
                    {w.wind !== 0 &&
                      ` · ${ru ? 'ветер' : 'wind'} ${formatSigned(w.wind)} ${unitM}`}
                    {w.temperature !== 0 &&
                      ` · ${ru ? 'температура' : 'temperature'} ${formatSigned(w.temperature)} ${unitM}`}
                    {w.density !== 0 &&
                      ` · ${ru ? 'плотность' : 'density'} ${formatSigned(w.density)} ${unitM}`}
                  </li>
                )}

                {azimuthCorrectionMil !== 0 && (
                  <li>
                    {ru ? 'Доворот' : 'Turn'}: {describeTurn(azimuthCorrectionMil)}
                    {w.azimuth !== 0 &&
                      lateralMil !== 0 &&
                      ` (${ru ? 'ветер' : 'wind'} ${formatSigned(w.azimuth)}, ${ru ? 'корректировка' : 'adjust'} ${formatSigned(lateralMil)})`}
                    {azimuthValue === null &&
                      (ru
                        ? ' — введите азимут, чтобы получить готовое значение'
                        : ' — enter the azimuth to get the final value')}
                  </li>
                )}
              </ul>

              {!combatOpen && (
                <FireTimer
                  ref={timerRef}
                  tof={solution.tof}
                  language={language}
                  onFire={handleFire}
                />
              )}

              <SyncStatusLine language={language} />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setCombatOpen(true)}
                  className="btn flex-1"
                >
                  {ru ? 'Боевой экран' : 'Combat screen'}
                  <span className="kbd hidden sm:inline-block">B</span>
                </button>
                {activeEntry && onUpdate && (
                  <button
                    type="button"
                    onClick={handleUpdate}
                    className="btn flex-1 truncate"
                  >
                    {justSaved === 'updated'
                      ? ru
                        ? 'Обновлено ✓'
                        : 'Updated ✓'
                      : ru
                        ? `Обновить «${activeEntry.name}»`
                        : `Update "${activeEntry.name}"`}
                  </button>
                )}
              </div>

              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSave()
                  }}
                  maxLength={60}
                  aria-label={ru ? 'Название цели' : 'Target name'}
                  placeholder={ru ? 'Название цели' : 'Target name'}
                  className="field min-w-0 flex-1"
                />
                <button type="button" onClick={handleSave} className="btn btn-primary">
                  {justSaved === 'saved'
                    ? ru
                      ? 'Сохранено ✓'
                      : 'Saved ✓'
                    : ru
                      ? 'Сохранить'
                      : 'Save'}
                </button>
              </div>

              {combatOpen && (
                <CombatScreen
                  title={`${reference.name} · ${selectedAmmo ? `${selectedAmmo.designation} [${selectedAmmo.type}]` : ''}`}
                  targetName={activeEntry?.name ?? null}
                  charge={activeResult.charge}
                  mode={mode}
                  elevation={solution.elevation}
                  azimuth={
                    firingAzimuth === null ? null : formatAzimuth(firingAzimuth)
                  }
                  azimuthUnit={unitAzimuth}
                  tof={solution.tof}
                  timerRef={timerRef}
                  onFire={handleFire}
                  onClose={() => setCombatOpen(false)}
                  language={language}
                />
              )}
            </>
          )}

          <p className="mt-6 text-[15px] leading-relaxed text-app-text-2">
            {mapInput
              ? ru
                ? 'Нажмите ЛКМ на карте, чтобы задать положение орудия, ПКМ — положение цели. Перетаскивайте карту мышью, колесо — масштаб. Или введите дистанцию и азимут вручную.'
                : 'Left-click the map to place the gun, right-click to place the target. Drag to pan, scroll to zoom. Or type the distance and bearing in by hand.'
              : ru
                ? 'Введите дистанцию до цели и азимут — установки посчитаются сразу.'
                : 'Enter the distance and bearing to the target — the solution updates instantly.'}
          </p>

          <p className="note mt-3 text-[15px]">
            {isDesktop
              ? ru
                ? 'Оверлей поверх игры — Ctrl+Alt+O, ввод в нём — Ctrl+Alt+D.'
                : 'Overlay on top of the game — Ctrl+Alt+O, type in it — Ctrl+Alt+D.'
              : (
                <>
                  {ru
                    ? 'Скачайте программу с оверлеем поверх игры с '
                    : 'Get the desktop app with an in-game overlay from '}
                  <a href={RELEASES_URL} target="_blank" rel="noreferrer">
                    github.com
                  </a>
                  .
                </>
              )}
          </p>
        </div>
      </div>

      {/* ---- Дополнительно: раскрывающиеся разделы ---- */}
      <div className="mt-12 grid items-start gap-3 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <AdjustFire
            history={adjustHistory}
            onAdd={(entry) => {
              setAdjustHistory((list) => [...list, entry])
              markEdited()
            }}
            onUndo={() => {
              setAdjustHistory((list) => list.slice(0, -1))
              markEdited()
            }}
            onReset={() => {
              setAdjustHistory([])
              markEdited()
            }}
            gunAzimuthMil={azimuthMil}
            azimuthUnit={azimuthUnit}
            language={language}
          />

          {hasWeather ? (
            <WeatherSection
              inputs={weatherInputs}
              defaultOpen={(initial?.weather ?? null) !== null}
              language={language}
              onEdit={markEdited}
            />
          ) : (
            profile && (
              <p className="panel px-4 py-3 text-[13.5px] text-app-muted">
                {ru
                  ? 'Погодные поправки недоступны: в таблицах этой модели погодные столбцы пустые («-»).'
                  : 'Weather corrections are unavailable: the weather columns of this model’s tables are empty ("-").'}
              </p>
            )
          )}

          {solution && (
            <TotPanel
              tof={solution.tof}
              impactAt={totAt}
              onImpactChange={setTotAt}
              onFireMoment={() => {
                // Только у себя: стрелки по связке ведут свой отсчёт
                timerRef.current?.remoteFire()
                notifyOverlayShot()
              }}
              language={language}
            />
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {results.length > 0 && (
            <details className="disclosure panel p-4 sm:p-5">
              <summary>
                {ru ? 'Заряды' : 'Charges'}
                {activeResult && (
                  <span className="tag">
                    {ru ? 'выбран' : 'selected'} {activeResult.charge}
                  </span>
                )}
              </summary>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <span className="label">
                  {ru ? 'Заряд по умолчанию' : 'Default charge'}
                </span>
                <Toggle
                  label={ru ? 'Заряд по умолчанию' : 'Default charge'}
                  value={chargePreference}
                  onChange={(value) => {
                    setChargePreference(value)
                    setChosenCharge(null)
                    markEdited()
                  }}
                  options={[
                    { value: 'lowest', label: ru ? 'меньший' : 'lowest' },
                    { value: 'fastest', label: ru ? 'быстрее' : 'fastest' },
                    { value: 'precise', label: ru ? 'точнее' : 'precise' },
                  ]}
                />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {results.map((result) => {
                  const usable = result.solution !== null
                  const active = usable && result.charge === activeResult?.charge

                  return (
                    <button
                      key={result.charge}
                      type="button"
                      disabled={!usable}
                      aria-pressed={active}
                      onClick={() => {
                        setChosenCharge(result.charge)
                        markEdited()
                      }}
                      className={[
                        'rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        active
                          ? 'bg-accent-soft ring-1 ring-accent'
                          : 'bg-app-raised',
                        usable
                          ? 'cursor-pointer hover:bg-app-raised-hover'
                          : 'cursor-not-allowed opacity-40',
                      ].join(' ')}
                    >
                      <span className="block font-medium text-app-text">
                        {ru ? 'Заряд' : 'Charge'} {result.charge}
                      </span>
                      <span className="block text-[12.5px] text-app-muted tabular-nums">
                        {result.solution
                          ? `${Math.round(result.solution.elevation)} ${unitMil} · ${result.solution.tof.toFixed(1)} ${unitS}`
                          : `${result.minRange}–${result.maxRange} ${unitM}`}
                      </span>
                      {result.solution && result.metersPerMil !== null && (
                        <span
                          className={[
                            'block text-[12.5px] tabular-nums',
                            result.nearEdge ? 'text-warn' : 'text-app-muted',
                          ].join(' ')}
                        >
                          1 {unitMil} ≈ {result.metersPerMil.toFixed(1)} {unitM}
                          {result.nearEdge && (ru ? ' · край' : ' · edge')}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              <p className="mt-3 text-[13px] text-app-muted">
                {ru
                  ? '«1 мил ≈ X м» — насколько сдвинется разрыв при ошибке возвышения в 1 мил: чем меньше, тем точнее. «Точнее» выбирает заряд с наименьшим значением. Между строками таблицы — линейная интерполяция.'
                  : '"1 mil ≈ X m" is how far the impact moves for a 1 mil elevation error: smaller is more precise. "Precise" picks the charge with the smallest value. Linear interpolation between table rows.'}
              </p>

              <MrsiPanel
                options={mrsiOptions}
                showMode={profileModes.length > 1}
                language={language}
              />
            </details>
          )}

          {profile && (
            <BallisticTableView
              profile={profile}
              mode={mode}
              onModeChange={changeMode}
              charges={selectedAmmo?.charges}
              activeCharge={activeResult?.charge ?? null}
              highlightRange={solution?.lookupRange ?? null}
              language={language}
            />
          )}
        </div>
      </div>

      {showKeys && (
        <div className="panel mt-3 p-4 sm:p-5">
          <SectionHeading title={ru ? 'Горячие клавиши' : 'Keyboard shortcuts'} />
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            {[
              ['F', ru ? 'Огонь — запустить таймер' : 'Fire — start the timer'],
              ['B', ru ? 'Боевой экран' : 'Combat screen'],
              ['M', ru ? 'Режим HIGH / LOW' : 'HIGH / LOW mode'],
              ['N / P', ru ? 'Следующая / предыдущая цель' : 'Next / previous target'],
              ['Esc', ru ? 'Остановить таймер, выйти из поля' : 'Stop the timer, leave a field'],
              ['0 – 9', ru ? 'Выбрать заряд' : 'Select a charge'],
              ['D', ru ? 'К полю дистанции' : 'Go to distance'],
              ['A', ru ? 'К полю азимута' : 'Go to azimuth'],
              ['C', ru ? 'К корректировке огня' : 'Go to fire adjustment'],
              ['Enter', ru ? 'В поле доклада — учесть разрыв' : 'In a report field — apply'],
              ['?', ru ? 'Показать / скрыть эту справку' : 'Show / hide this help'],
            ].map(([key, text]) => (
              <div key={key} className="flex items-baseline gap-3">
                <dt className="min-w-12">
                  <kbd className="kbd">{key}</kbd>
                </dt>
                <dd className="text-app-muted">{text}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[13px] text-app-muted">
            {ru
              ? 'Клавиши работают в любой раскладке, когда курсор не в поле ввода.'
              : 'Shortcuts work in any keyboard layout when no input field is focused.'}
          </p>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setShowKeys((value) => !value)}
          aria-expanded={showKeys}
          className="btn btn-ghost hidden sm:inline-flex"
        >
          {ru ? 'Горячие клавиши' : 'Shortcuts'}
          <span className="kbd">?</span>
        </button>

        <button type="button" onClick={resetForm} className="btn btn-ghost btn-danger ml-auto">
          {ru ? 'Очистить поля' : 'Clear inputs'}
        </button>
      </div>
    </section>
  )
}
