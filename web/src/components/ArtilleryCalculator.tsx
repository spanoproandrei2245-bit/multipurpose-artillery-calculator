import { t } from '../i18n'
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
import { models, type ModelId } from '../data/models'
import type { ArtilleryCategory } from '../types/gameModel'
import {
  degToMil,
  isLargeCorrection,
  lateralCorrectionMil,
  milToDeg,
  MILS_PER_TURN,
  normalizeAngle,
  overallRange,
  profileHasWeather,
  pickBest,
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
import { recentEntries } from '../lib/journal'
import { useFeature } from '../lib/features'
import { togglePanel } from '../lib/uiPanels'
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
import { AnimatedNumber } from './AnimatedNumber'
import { ConfirmClear } from './ConfirmClear'
import { ChargeStrip } from './ChargeStrip'
import { FieldIcon } from './FieldIcon'
import { selectProfile } from '../lib/profileSelect'
import { BallisticTableView } from './BallisticTableView'
import { CombatScreen } from './CombatScreen'
import { FireTimer, type FireTimerHandle } from './FireTimer'
import type { FlightShot } from './FlightCanvas'
import type { JournalActions } from '../lib/journalIO'
import { InlineNumber, Row, Toggle } from './FormControls'
import { GridInput } from './GridInput'
import { GunLayPanel } from './GunLayPanel'
import { MrsiPanel, MrsiUnavailable } from './MrsiPanel'
import { TerrainWarning } from './TerrainWarning'
import { clearance, isBlocked, isTight, type Clearance, type TerrainProfile } from '../lib/terrainClearance'
import { SyncStatusLine } from './SyncStatusLine'
import { TotPanel } from './TotPanel'
import { fireMoment } from '../lib/tot'
import { CrashProbe, ErrorBoundary } from './ErrorBoundary'
import { readCalcDraft, readModelDraft, writeCalcDraft, writeModelDraft } from '../lib/calcDraft'
import { WeatherRows } from './WeatherRows'

const MODES: readonly ArtilleryMode[] = ['HIGH', 'LOW']

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
  // Метки на карте и метки с экрана игры (из настроек)
  showMarkers?: boolean
  showScreenMarkers?: boolean
  // Выбор модели — в одной строке с выбором боеприпаса
  modelSelector?: ReactNode
  // Полоска быстрого выбора сохранённых целей
  targetBar?: ReactNode
  // Цель из журнала, с которой сейчас работаем: её можно обновить
  activeEntry?: Pick<JournalEntry, 'id' | 'name'> | null
  // Все цели журнала — для отметок на карте
  journalEntries?: readonly JournalEntry[]
  onLoadEntry?: (id: string) => void
  // Экспорт, импорт, переименование и удаление целей — в панели целей на карте
  journalActions?: JournalActions
  onSave: (draft: JournalDraft) => void
  onUpdate?: (id: string, draft: JournalDraft) => void
}

export function ArtilleryCalculator({
  modelId,
  language,
  initial = null,
  gridInput = false,
  mapInput = false,
  showMarkers = false,
  showScreenMarkers = false,
  modelSelector,
  targetBar,
  activeEntry = null,
  journalEntries = [],
  onLoadEntry,
  journalActions,
  onSave,
  onUpdate,
}: Props) {
  const showAdjust = useFeature('adjust')
  const showWeather = useFeature('weather')
  const showTot = useFeature('tot')
  const showMrsi = useFeature('mrsi')
  const showGunLay = useFeature('gunLay') && isDesktop
  const showJournal = useFeature('journal')
  const showTable = useFeature('table')
  const showHints = useFeature('hints')
  const hideUnfit = useFeature('hideUnfit')
  const onlyGood = useFeature('onlyGood')
  const reference = artilleryRegistry[modelId]
  const ammunition = reference.ammunition ?? []

  // Черновик: введённое ранее (другим орудием, до перезагрузки). Запись
  // журнала, если её загрузили, важнее черновика.
  const [draft] = useState(() => (initial ? null : readCalcDraft()))
  const [modelDraft] = useState(() => (initial ? {} : readModelDraft(modelId)))

  // Режим из загруженной записи журнала, если модель его поддерживает
  // Траектория: выбранная вручную или «авто» — лучшая по приоритету заряда
  const [modeChoice, setModeChoice] = useState<ArtilleryMode | 'auto'>(() =>
    initial?.mode && reference.availableModes.includes(initial.mode)
      ? initial.mode
      : modelDraft.modeChoice &&
          (modelDraft.modeChoice === 'auto'
            ? reference.availableModes.length > 1
            : reference.availableModes.includes(modelDraft.modeChoice))
        ? modelDraft.modeChoice
        : reference.availableModes.length > 1
          ? 'auto'
          : reference.availableModes[0]
  )
  const [ammoId, setAmmoId] = useState(
    initial && ammunition.some((a) => a.id === initial.ammoId)
      ? initial.ammoId
      : modelDraft.ammoId && ammunition.some((a) => a.id === modelDraft.ammoId)
        ? modelDraft.ammoId
        : (ammunition[0]?.id ?? '')
  )
  const [distance, setDistance] = useState(
    initial ? numberToField(initial.distance) : (draft?.distance ?? '')
  )
  // Высота орудия: блокировка сохраняет значение между запусками и
  // защищает его от карты, журнала и «Сброса».
  const [heightLocked, setHeightLocked] = useState(
    () => readStored<'on' | 'off'>('ownHeightLocked', ['on', 'off'], 'off') === 'on'
  )
  const [ownHeight, setOwnHeightRaw] = useState(() =>
    readStored<'on' | 'off'>('ownHeightLocked', ['on', 'off'], 'off') === 'on'
      ? readStoredText('ownHeightValue')
      : initial
        ? numberToField(initial.ownHeight)
        : (draft?.ownHeight ?? '')
  )
  const setOwnHeight = (value: string) => {
    if (!heightLocked) setOwnHeightRaw(value)
  }
  useEffect(() => {
    writeStored('ownHeightLocked', heightLocked ? 'on' : 'off')
    if (heightLocked) writeStored('ownHeightValue', ownHeight)
  }, [heightLocked, ownHeight])
  const [targetHeight, setTargetHeight] = useState(
    initial ? numberToField(initial.targetHeight) : (draft?.targetHeight ?? '')
  )
  const [azimuth, setAzimuth] = useState(
    initial ? numberToField(initial.azimuth) : (draft?.azimuth ?? '')
  )
  // Точка цели на карте, если цель ставили на карте; ручная правка
  // дистанции или азимута её сбрасывает.
  // Рельеф между орудием и целью с карты (если она открыта)
  const [terrain, setTerrain] = useState<TerrainProfile | null>(null)
  const [mapTarget, setMapTarget] = useState<MapTarget | null>(
    initial ? (initial.target ?? null) : (draft?.mapTarget ?? null)
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
      if (!initial) return draft?.adjust ?? []
      const range = initial.rangeCorrection ?? 0
      const lateral = initial.lateralCorrection ?? 0
      return range !== 0 || lateral !== 0
        ? [{ range, lateral, label: t('artilleryCalculator.from-journal') }]
        : []
    }
  )
  const { range: rangeAdjust, lateral: lateralAdjust } =
    sumAdjustments(adjustHistory)

  // Огонь по времени: момент разрыва, мс
  const [totAt, setTotAt] = useState<number | null>(null)

  const [chosenCharge, setChosenCharge] = useState<number | null>(
    initial ? (initial.charge ?? null) : (modelDraft.charge ?? null)
  )

  // Всё введённое сохраняется сразу: смена орудия, настройки, перезагрузка
  useEffect(() => {
    writeCalcDraft({ distance, ownHeight, targetHeight, azimuth, mapTarget, adjust: adjustHistory })
  }, [distance, ownHeight, targetHeight, azimuth, mapTarget, adjustHistory])
  useEffect(() => {
    writeModelDraft(modelId, { ammoId, modeChoice, charge: chosenCharge })
  }, [modelId, ammoId, modeChoice, chosenCharge])
  const [saveName, setSaveName] = useState('')
  const [justSaved, setJustSaved] = useState<'saved' | 'updated' | null>(
    null
  )

  const [chargePreference, setChargePreference] =
    useState<ChargePreference>(() =>
      // Прежнее «меньший» из старых версий читается как «лучший»
      readStored<ChargePreference>(
        'chargePreference',
        ['best', 'fastest', 'precise'],
        'best'
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

  // Погодные поправки и улучшенная баллистика — один переключатель: поправки
  // имеют смысл только при игре с сопротивлением воздуха и погодой.
  // substituted — траектории, для которых нет таблиц под эту физику
  const { profile, substituted } = selectProfile(
    reference,
    selectedAmmo,
    showWeather
  )

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
    hasWeather && showWeather,
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
  // Режимы, для которых у боеприпаса есть таблицы
  const profileModes = MODES.filter(
    (item) => profile?.modes[item] !== undefined
  )

  // Все способы выстрела по текущей дистанции: каждая траектория и заряд
  const modeResults =
    profile && baseRange !== null
      ? profileModes.map((item) => ({
          mode: item,
          results: solveAllCharges(
            profile,
            item,
            selectedAmmo?.charges,
            baseRange,
            heightDifference,
            weatherInputs.weather
          ),
        }))
      : []

  // ---- рельеф по пути снаряда ----
  // Профиль берётся с карты, только если дистанция в поле совпадает с картой
  // (её не правили руками): иначе он не про этот выстрел.
  const terrainActive =
    terrain !== null && validDistance && Math.abs(terrain.distance - distanceValue) <= Math.max(25, distanceValue * 0.01)
      ? terrain
      : null
  const terrainChecks = new Map<string, Clearance | null>()
  for (const group of modeResults) {
    for (const result of group.results) {
      if (terrainActive && result.solution) {
        terrainChecks.set(`${group.mode}:${result.charge}`, clearance(terrainActive, result.solution.elevation))
      }
    }
  }
  const terrainOf = (m: ArtilleryMode, charge: number) => terrainChecks.get(`${m}:${charge}`) ?? null
  // Выбор по приоритету — среди способов, которые не упираются в рельеф (если такие есть)
  const clearGroups = modeResults.map((group) => ({
    ...group,
    results: group.results.filter((r) => !isBlocked(terrainOf(group.mode, r.charge))),
  }))
  const anyClear = clearGroups.some((group) => group.results.some((r) => r.solution !== null))
  const pickGroups = anyClear ? clearGroups : modeResults

  // «Авто»: лучший способ по приоритету среди всех траекторий
  const autoBest =
    modeChoice === 'auto' ? pickBest(pickGroups, chargePreference) : undefined
  const mode: ArtilleryMode =
    modeChoice === 'auto'
      ? (autoBest?.group.mode ?? profileModes[0] ?? reference.availableModes[0])
      : modeChoice

  const results = modeResults.find((group) => group.mode === mode)?.results ?? []
  const clearResults = pickGroups.find((group) => group.mode === mode)?.results ?? []

  const applicable = results.filter((r) => r.solution !== null)

  // Явно выбранный заряд важнее предпочтения по умолчанию.
  const activeResult =
    applicable.find((r) => r.charge === chosenCharge) ??
    (modeChoice === 'auto'
      ? autoBest?.result
      : (pickCharge(clearResults, chargePreference) ?? pickCharge(results, chargePreference)))

  const solution = activeResult?.solution ?? null
  const range = overallRange(results)

  // Рельеф у выбранного способа и чем стрелять вместо, если он упирается
  const activeTerrain = activeResult ? terrainOf(mode, activeResult.charge) : null
  const terrainAlternative = (() => {
    if (!isBlocked(activeTerrain) || !anyClear) return null
    const best = pickBest(clearGroups, chargePreference)
    if (!best) return null
    const label =
      best.group.mode === 'HIGH'
        ? t('artilleryCalculator.high-trajectory')
        : t('artilleryCalculator.low-trajectory')
    return `${label.toLowerCase()}, ${t('mrsiPanel.charge')} ${best.result.charge}`
  })()

  // Огонь по линии: та же траектория и, пока достаёт, тот же заряд, что и в
  // основном расчёте; иначе — заряд по приоритету
  const solveLinePoint = (lineDistance: number, lineHeightDiff: number) => {
    if (!profile) return null
    const lineResults = solveAllCharges(
      profile,
      mode,
      selectedAmmo?.charges,
      lineDistance + rangeAdjust,
      lineHeightDiff,
      weatherInputs.weather
    )
    const result =
      lineResults.find((r) => r.charge === activeResult?.charge && r.solution !== null) ??
      pickCharge(lineResults, chargePreference)
    return result?.solution ? { elevation: result.solution.elevation, charge: result.charge } : null
  }
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
  // Снаряд в полёте — для анимации на карте
  const [flight, setFlight] = useState<FlightShot[]>([])
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
    Question: () => togglePanel('hotkeys'),
  }
  for (let charge = 0; charge <= 9; charge += 1) {
    hotkeys[`Digit${charge}`] = () => selectCharge(charge)
    hotkeys[`Numpad${charge}`] = () => selectCharge(charge)
  }
  useHotkeys(hotkeys)

  function changeMode(value: ArtilleryMode | 'auto') {
    if (value === modeChoice) return
    setModeChoice(value)
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
    const defaultName = `${t('artilleryCalculator.target')} ${distanceValue} ${
      t('unit.m')
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

  const unitM = t('unit.m')
  const unitMil = t('unit.mil')
  const unitS = t('unit.s')
  const unitAzimuth = azimuthUnit === 'mil' ? unitMil : '°'

  function formatAzimuth(value: number): string {
    return azimuthUnit === 'mil' ? value.toFixed(0) : value.toFixed(1)
  }

  function describeTurn(mil: number): string {
    const side = mil > 0 ? (t('adjustFire.right-2')) : t('adjustFire.left-2')
    return `${side} ${Math.abs(mil).toFixed(1)} ${unitMil}`
  }

  const totalRangeCorrection = rangeAdjust + (w?.total ?? 0)

  // ---- одновременный удар: все заряды во всех режимах ----
  // Только орудиям, которые успевают сменить заряд и возвышение между
  // выстрелами (буксируемые и САУ). Миномёт и РСЗО — нет: заряд мины
  // меняют руками, а пусковую не перенаведёшь за секунды.
  const category = models[modelId].category as ArtilleryCategory
  const mrsiAllowed = category === 'towed' || category === 'spg'
  const mrsiOptions: MrsiOption[] =
    mrsiAllowed && solution !== null
      ? modeResults.flatMap(({ mode: item, results: list }) =>
          list.flatMap((result) =>
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

  // Досягаемость орудия не зависит от введённой дистанции — для колец на карте
  const reach = profile
    ? overallRange(
        solveAllCharges(
          profile,
          mode,
          selectedAmmo?.charges,
          baseRange ?? 1000,
          heightDifference,
          weatherInputs.weather
        )
      )
    : null

  // Дистанция не достаёт или слишком мала для всех зарядов выбранной траектории
  const outOfRange =
    profile && validDistance && applicable.length === 0 && range && baseRange !== null
      ? baseRange > range.max
        ? ('far' as const)
        : baseRange < range.min
          ? ('near' as const)
          : null
      : null

  // Быстрый список сохранённых целей на карте
  const quickTargets = (showJournal ? recentEntries(journalEntries, 12) : []).map(
    (entry) => ({
        id: entry.id,
        name: entry.name,
        detail: `${entry.distance} ${t('unit.m')} · ${Math.round(entry.elevation)} ${t('unit.mil')}`,
        active: entry.id === (activeEntry?.id ?? null),
    })
  )

  // Закрепление орудия на карте закрепляет и высоту орудия — как будто
  // её ввели и заблокировали руками. Освобождение снимает только то
  // закрепление, которое поставила карта.
  const heightAutoLocked = useRef(false)
  function handleGunLock(locked: boolean, height: number | null) {
    if (locked) {
      if (height !== null) setOwnHeightRaw(String(Math.round(height)))
      if (!heightLocked) {
        heightAutoLocked.current = true
        setHeightLocked(true)
      }
    } else if (heightAutoLocked.current) {
      heightAutoLocked.current = false
      setHeightLocked(false)
    }
  }

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
        over > 0 ? (t('adjustFire.over')) : t('adjustFire.short')
      parts.push(`${side} ${Math.abs(over)}`)
    }
    if (right !== 0) {
      const side =
        right > 0 ? (t('adjustFire.right')) : t('adjustFire.left')
      parts.push(`${side} ${Math.abs(right)}`)
    }
    return `${parts.join(', ')} (${t('artilleryCalculator.overlay')})`
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
              <ErrorBoundary area="map" variant="inline">
                <CrashProbe area="map" />
              <Suspense
                fallback={
                  <div className="flex aspect-square items-center justify-center rounded-lg bg-app-surface">
                    <p className="label">
                      {t('artilleryCalculator.loading-the-map')}
                    </p>
                  </div>
                }
              >
                <MapPicker
                  language={language}
                  currentTarget={mapTarget}
                  journalTargets={journalTargets}
                  quickTargets={quickTargets}
                  targetActions={showJournal ? journalActions : undefined}
                  reach={reach}
                  flight={flight}
                  category={category}
                  shellType={selectedAmmo?.type}
                  onGunLockChange={handleGunLock}
                  solveLine={solveLinePoint}
                  solveKey={[modelId, selectedAmmo?.id, mode, activeResult?.charge, rangeAdjust, JSON.stringify(weatherInputs.weather)].join('|')}
                  onTerrainProfile={setTerrain}
                  showMarkers={showMarkers}
                  showScreenMarkers={showScreenMarkers}
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
              </ErrorBoundary>
            )}

            {gridInput && (
              <GridInput
                azimuthUnit={azimuthUnit}
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
          {/* «Огонь» и боевой экран — сверху: главное действие под рукой */}
          {!combatOpen && (
            <div className="mb-3">
              <FireTimer
                variant="bar"
                category={category}
                shellType={selectedAmmo?.type}
                onShotChange={setFlight}
                ref={timerRef}
                tof={solution?.tof ?? 0}
                disabled={!solution}
                onFire={handleFire}
                onCombat={() => solution && setCombatOpen(true)}
              />
            </div>
          )}

          <div className="relative">
            <dl>
              <Row icon="elevation" label={t('artilleryCalculator.elevation')}>
                <AnimatedNumber
                  value={solution ? solution.elevation : null}
                  className={[
                    'text-2xl font-semibold tabular-nums',
                    solution ? 'text-app-text' : 'text-app-faint',
                  ].join(' ')}
                />
                <span className="w-7 text-left text-app-muted">{unitMil}</span>
              </Row>
              <Row icon="azimuth" label={t('artilleryCalculator.azimuth')}>
                <AnimatedNumber
                  value={firingAzimuth}
                  format={formatAzimuth}
                  maxTween={azimuthUnit === 'mil' ? 3000 : 180}
                  className={[
                    'text-2xl font-semibold tabular-nums',
                    firingAzimuth === null ? 'text-app-faint' : 'text-app-text',
                  ].join(' ')}
                />
                <span className="w-7 text-left text-app-muted">{unitAzimuth}</span>
              </Row>
              <Row icon="time" label={t('artilleryCalculator.time-of-flight')}>
                <AnimatedNumber
                  value={solution ? solution.tof : null}
                  format={(v) => v.toFixed(1)}
                />
                <span className="w-7 text-left text-app-muted">{unitS}</span>
              </Row>
            </dl>
            {outOfRange && range && (
              <div
                role="alert"
                className="tour-fade absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-warn bg-app-bg/95 px-4 text-center backdrop-blur-sm"
              >
                <p className="font-semibold text-warn">
                  {outOfRange === 'far'
                    ? t('artilleryCalculator.target-too-far')
                    : t('artilleryCalculator.target-too-close')}
                </p>
                <p className="text-[13px] text-app-text-2 tabular-nums">
                  {t('artilleryCalculator.m-the-gun-reaches-m', Math.round(baseRange ?? 0), range.min, range.max)}
                </p>
              </div>
            )}
          </div>
          <dl>
            <Row icon="charge" control="full" tourId="charge" label={t('artilleryCalculator.charge')}>
              {/* Автовыбор: какой заряд брать, пока не выбран вручную */}
              <Toggle
                label={t('artilleryCalculator.which-charge-to-use')}
                equal
                className="min-w-0 flex-1 [&>button]:px-1.5 [&>button]:text-[13px]"
                value={chosenCharge !== null ? 'manual' : chargePreference}
                onChange={(value) => {
                  if (value === 'manual') return
                  setChargePreference(value)
                  setChosenCharge(null)
                  markEdited()
                }}
                options={[
                  { value: 'best', icon: 'balance', label: t('artilleryCalculator.best'), title: t('artilleryCalculator.priority-best'), disabled: applicable.length === 0 },
                  { value: 'fastest', label: t('artilleryCalculator.fast'), title: t('artilleryCalculator.priority-fastest'), disabled: applicable.length === 0 },
                  { value: 'precise', label: t('artilleryCalculator.precise-short'), title: t('artilleryCalculator.priority-precise'), disabled: applicable.length === 0 },
                ]}
              />
            </Row>
            {profileModes.length > 1 && (
              <Row icon="trajectory" control="full" label={t('artilleryCalculator.trajectory')}>
                <Toggle
                  equal
                  className="min-w-0 flex-1 overflow-hidden [&>button]:px-1.5 [&>button]:text-[13px]"
                  label={t('artilleryCalculator.trajectory-mode')}
                  value={modeChoice}
                  onChange={changeMode}
                  options={[
                    {
                      value: 'auto' as const,
                      icon: 'autoCycle' as const,
                      label: t('artilleryCalculator.auto'),
                      title: t('artilleryCalculator.trajectory-auto'),
                    },
                    ...profileModes.map((item) => ({
                      value: item,
                      label:
                        item === 'HIGH'
                          ? t('artilleryCalculator.high')
                          : t('artilleryCalculator.low'),
                    })),
                  ]}
                />
              </Row>
            )}
          </dl>

          {modeResults.length > 0 && (
            <div className="mt-2 mb-1">
              <ChargeStrip
                groups={modeResults.map((group) => ({
                  mode: group.mode,
                  results: group.results,
                  label:
                    group.mode === 'HIGH'
                      ? t('artilleryCalculator.high-trajectory')
                      : t('artilleryCalculator.low-trajectory'),
                }))}
                activeMode={mode}
                terrainOf={terrainOf}
                hideUnfit={hideUnfit}
                onlyGood={onlyGood}
                activeCharge={activeResult?.charge ?? null}
                onPick={(pickedMode, charge) => {
                  setModeChoice(pickedMode)
                  setChosenCharge(charge)
                  markEdited()
                }}
              />
            </div>
          )}

          <ConfirmClear
            label={t('artilleryCalculator.clear-inputs')}
            onConfirm={resetForm}
          />

          <dl>
            <Row icon="distance" control="unit" unit={unitM} label={t('artilleryCalculator.distance')} htmlFor="calc-distance">
              <InlineNumber
                id="calc-distance"
                value={distance}
                onChange={edited((value) => {
                  setDistance(value)
                  setMapTarget(null)
                })}
                block
              />
            </Row>
            <Row icon="azimuth" control="full" label={t('artilleryCalculator.target-bearing')} htmlFor="calc-azimuth">
              <Toggle
                label={t('artilleryCalculator.azimuth-units')}
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
                placeholder={t('artilleryCalculator.not-set')}
                block
              />
            </Row>
            <Row icon="targetHeight" control="unit" unit={unitM} label={t('artilleryCalculator.target-height')} htmlFor="calc-target-height">
              <InlineNumber
                id="calc-target-height"
                value={targetHeight}
                onChange={edited(setTargetHeight)}
                block
              />
            </Row>
          </dl>

          <div className="my-3 h-px bg-app-border" />

          <dl>
            <Row
              icon="weapon"
              control="full"
              label={t('artilleryCalculator.weapon')}
            >
              {modelSelector}
            </Row>
            <Row icon="shell" control="full" label={t('ammunitionSelector.shell')}>
              <AmmunitionSelector
                ammunition={ammunition}
                selectedId={ammoId}
                onSelect={handleAmmoChange}
                category={category}
              />
            </Row>
            <Row icon="gunHeight" control="unit" unit={unitM} label={t('artilleryCalculator.gun-height')} htmlFor="calc-own-height">
              <button
                type="button"
                aria-pressed={heightLocked}
                aria-label={
                  heightLocked
                    ? t('artilleryCalculator.unlock-gun-height')
                    : t('artilleryCalculator.lock-gun-height')
                }
                title={
                  heightLocked
                    ? t('artilleryCalculator.locked-map-journal-and-reset')
                    : t('artilleryCalculator.lock-the-gun-height')
                }
                onClick={() => setHeightLocked((v) => !v)}
                className={[
                  'inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md transition-colors',
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
                block
              />
            </Row>
          </dl>
          {showWeather && hasWeather && (
            <>
              <ConfirmClear
                label={t('weatherSection.clear-weather')}
                disabled={!weatherInputs.entered}
                onConfirm={() => {
                  weatherInputs.reset()
                  markEdited()
                }}
              />
              <dl>
                <WeatherRows inputs={weatherInputs} onEdit={markEdited} />
              </dl>
            </>
          )}
          {showWeather && !hasWeather && profile && (
            <p className="mt-2 text-[13px] text-app-muted">
              {t('artilleryCalculator.weather-corrections-are-unavailable-the')}
            </p>
          )}

          {showJournal && !mapInput && targetBar}

          {/* ---- Состояние расчёта и предупреждения ---- */}
          <div className="mt-4 space-y-2">
            {!profile && (
              <p className={`${alertClass} text-app-muted`}>
                {t('artilleryCalculator.no-tables-for-this-ammunition')}
              </p>
            )}

            {profile && substituted.includes(mode) && (
              <p className={`${alertClass} text-warn`}>
                {showWeather
                  ? t('artilleryCalculator.advanced-missing')
                  : t('artilleryCalculator.no-drag-missing')}
              </p>
            )}

            {showHints && heightIncomplete && (
              <p className={`${alertClass} text-app-muted`}>
                {t('artilleryCalculator.enter-both-heights-no-height')}
              </p>
            )}

            {invalidInputs && (
              <p className={`${alertClass} text-danger`}>
                {t('artilleryCalculator.some-values-were-not-recognised')}
              </p>
            )}

            {solution && activeTerrain && (isBlocked(activeTerrain) || isTight(activeTerrain)) && terrainActive && (
              <TerrainWarning
                terrain={terrainActive}
                hit={activeTerrain}
                elevationMil={solution.elevation}
                alternative={terrainAlternative}
              />
            )}

            {solution && activeResult && w && (
              <>
                {w.missing && (
                  <p className={`${alertClass} text-app-muted`}>
                    {t('artilleryCalculator.the-table-lacks-some-weather')}
                  </p>
                )}
                {solution.heightCorrectionMissing && (
                  <p className={`${alertClass} text-app-muted`}>
                    {t('artilleryCalculator.the-game-table-has-no')}
                  </p>
                )}
                {activeResult.nearEdge && (
                  <p className={`${alertClass} text-warn`}>
                    {t('artilleryCalculator.charge-is-at-the-edge', activeResult.charge)}
                  </p>
                )}
                {activeResult.wideGap && (
                  <p className={`${alertClass} text-warn`}>
                    {t('artilleryCalculator.the-game-table-skips-rows')}
                  </p>
                )}
                {isLargeCorrection(solution) && (
                  <p className={`${alertClass} text-app-muted`}>
                    {t('artilleryCalculator.large-height-difference-the-correction')}
                  </p>
                )}
              </>
            )}
          </div>

          {solution && activeResult && w && (
            <>
              <ul className="mt-3 space-y-0.5 text-[13px] text-app-muted">
                <li>
                  {t('artilleryCalculator.table-value')}:{' '}
                  {solution.baseElevation.toFixed(1)} {unitMil}
                  {' · '}
                  {t('artilleryCalculator.height')}{' '}
                  {formatSigned(solution.elevationCorrection)} {unitMil},{' '}
                  {formatSigned(solution.tofCorrection)} {unitS}
                </li>

                {totalRangeCorrection !== 0 && (
                  <li>
                    {t('artilleryCalculator.table-range')}:{' '}
                    {solution.lookupRange.toFixed(0)} {unitM}
                    {rangeAdjust !== 0 &&
                      ` · ${t('artilleryCalculator.adjust')} ${formatSigned(rangeAdjust, 0)} ${unitM}`}
                    {w.wind !== 0 &&
                      ` · ${t('artilleryCalculator.wind')} ${formatSigned(w.wind)} ${unitM}`}
                    {w.temperature !== 0 &&
                      ` · ${t('artilleryCalculator.temperature')} ${formatSigned(w.temperature)} ${unitM}`}
                    {w.density !== 0 &&
                      ` · ${t('artilleryCalculator.density')} ${formatSigned(w.density)} ${unitM}`}
                  </li>
                )}

                {azimuthCorrectionMil !== 0 && (
                  <li>
                    {t('artilleryCalculator.turn')}: {describeTurn(azimuthCorrectionMil)}
                    {w.azimuth !== 0 &&
                      lateralMil !== 0 &&
                      ` (${t('artilleryCalculator.wind')} ${formatSigned(w.azimuth)}, ${t('artilleryCalculator.adjust')} ${formatSigned(lateralMil)})`}
                    {azimuthValue === null &&
                      (t('artilleryCalculator.enter-the-azimuth-to-get'))}
                  </li>
                )}
              </ul>

              <SyncStatusLine />

              <div className="mt-3 flex flex-wrap gap-2">
                {showJournal && activeEntry && onUpdate && (
                  <button
                    type="button"
                    onClick={handleUpdate}
                    className="btn flex-1 text-center leading-tight whitespace-normal"
                  >
                    {justSaved === 'updated'
                      ? t('artilleryCalculator.updated')
                      : t('artilleryCalculator.update', activeEntry.name)}
                  </button>
                )}
              </div>

              {showJournal && (
              <div className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleSave()
                  }}
                  maxLength={60}
                  aria-label={t('artilleryCalculator.target-name')}
                  placeholder={t('artilleryCalculator.target-name')}
                  className="field min-w-0 flex-1"
                />
                <button type="button" onClick={handleSave} className="btn btn-primary">
                  <FieldIcon name="save" className="h-[18px] w-[18px]" />
                  {justSaved === 'saved'
                    ? t('artilleryCalculator.saved')
                    : t('artilleryCalculator.save')}
                </button>
              </div>
              )}

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
                />
              )}
            </>
          )}


        </div>
      </div>

      {/* ---- Дополнительно: раскрывающиеся разделы ---- */}
      <div className="mt-12 grid items-start gap-3 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          {(showAdjust || adjustHistory.length > 0) && (
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
          />
          )}

          {solution && (showTot || totAt !== null) && (
            <TotPanel
              tof={solution.tof}
              impactAt={totAt}
              onImpactChange={setTotAt}
              onFireMoment={() => {
                // Только у себя: стрелки по связке ведут свой отсчёт
                timerRef.current?.remoteFire()
                notifyOverlayShot()
              }}
            />
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {showGunLay && (
            <GunLayPanel solutionElevation={solution?.elevation ?? null} />
          )}

          {showMrsi &&
            (mrsiAllowed ? (
              solution && <MrsiPanel options={mrsiOptions} showMode={profileModes.length > 1} />
            ) : (
              <MrsiUnavailable />
            ))}

          {profile && showTable && (
            <BallisticTableView
              profile={profile}
              mode={mode}
              onModeChange={changeMode}
              charges={selectedAmmo?.charges}
              activeCharge={activeResult?.charge ?? null}
              highlightRange={solution?.lookupRange ?? null}
            />
          )}
        </div>
      </div>

    </section>
  )
}
