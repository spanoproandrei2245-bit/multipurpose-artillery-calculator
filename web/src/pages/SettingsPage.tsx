import { t, type MessageKey } from '../i18n'
import type { ReactNode } from 'react'

import { wakeLockSupported } from '../lib/useWakeLock'
import { OpenOnPhone } from '../components/OpenOnPhone'
import { GLOBAL_HOTKEYS, isDesktop, toggleOverlay } from '../lib/desktop'
import { SoundSettings } from '../components/SoundSettings'
import { FeaturePreview } from '../components/FeaturePreview'
import { SectionHeading, Switch, Toggle } from '../components/FormControls'
import { setFlightOnMap, setFlightStyle, useFlightOnMap, useFlightStyle } from '../lib/animation'
import { setFeature, useFeature } from '../lib/features'
import { setMotion, useMotion, type MotionKind } from '../lib/motion'

interface SettingsPageProps {
  gridInput: boolean
  onGridInputChange: (value: boolean) => void
  mapInput: boolean
  onMapInputChange: (value: boolean) => void
  showMarkers: boolean
  onShowMarkersChange: (value: boolean) => void
  showScreenMarkers: boolean
  onShowScreenMarkersChange: (value: boolean) => void
  keepAwake: boolean
  onKeepAwakeChange: (value: boolean) => void
}

function Card({
  index,
  title,
  description,
  children,
  className = '',
}: {
  index: string
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`panel  p-4 sm:p-5 ${className}`}>
      <SectionHeading index={index} title={title} />
      {description && (
        <p className="mt-3 text-sm text-app-muted">{description}</p>
      )}
      {children}
    </div>
  )
}

export function SettingsPage({
  gridInput,
  onGridInputChange,
  mapInput,
  onMapInputChange,
  showMarkers,
  onShowMarkersChange,
  showScreenMarkers,
  onShowScreenMarkersChange,
  keepAwake,
  onKeepAwakeChange,
}: SettingsPageProps) {
  const adjust = useFeature('adjust')
  const weather = useFeature('weather')
  const tot = useFeature('tot')
  const journal = useFeature('journal')
  const table = useFeature('table')
  const hints = useFeature('hints')
  const hideUnfit = useFeature('hideUnfit')
  const volley = useFeature('volley')
  const onlyGood = useFeature('onlyGood')
  const flightStyle = useFlightStyle()
  const motionNumbers = useMotion('numbers')
  const motionSwitches = useMotion('switches')
  const motionAppear = useMotion('appear')
  const motionSmooth = useMotion('smooth')
  const motionFire = useMotion('fire')
  const motionImpact = useMotion('impact')
  const flightOnMap = useFlightOnMap()

  return (
    <section className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card index="01" title={t('settings.preferences')}>
            <div className="mt-1">
              <FeaturePreview id="keepAwake">
              <Switch
                checked={keepAwake}
                onChange={onKeepAwakeChange}
                disabled={!wakeLockSupported}
                label={t('settings.keepAwake')}
                description={
                  wakeLockSupported
                    ? t('settings.keepAwakeDescription')
                    : t('settings.keepAwakeUnsupported')
                }
              />
              </FeaturePreview>
            </div>

            <div className="mt-5">
              <Switch
                checked={hints}
                onChange={(v) => setFeature('hints', v)}
                label={t('settingsPage.hints')}
                description={
                  t('settingsPage.explanatory-notes-and-the-demos')
                }
              />
            </div>

            <p className="label mt-5 text-app-faint">{t('settings.autoSave')}</p>
          </Card>

          <Card
            index="02"
            title={t('settingsPage.animations')}
            description={
              t('settingsPage.shell-flight-and-impact-after')
            }
          >
            <div className="mt-4 space-y-4">
              {(
                [
                  ['numbers', motionNumbers, 'settingsPage.motion-numbers', 'settingsPage.motion-numbers-description'],
                  ['switches', motionSwitches, 'settingsPage.motion-switches', 'settingsPage.motion-switches-description'],
                  ['appear', motionAppear, 'settingsPage.motion-appear', 'settingsPage.motion-appear-description'],
                  ['smooth', motionSmooth, 'settingsPage.motion-smooth', 'settingsPage.motion-smooth-description'],
                  ['fire', motionFire, 'settingsPage.motion-fire', 'settingsPage.motion-fire-description'],
                  ['impact', motionImpact, 'settingsPage.motion-impact', 'settingsPage.motion-impact-description'],
                ] as [MotionKind, boolean, MessageKey, MessageKey][]
              ).map(([kind, on, label, description]) => (
                <Switch
                  key={kind}
                  checked={on}
                  onChange={(value) => setMotion(kind, value)}
                  label={t(label)}
                  description={t(description)}
                />
              ))}
              <p className="text-[12.5px] text-app-faint">{t('settingsPage.motion-always')}</p>
              <p className="label text-app-faint">{t('settingsPage.shot-animation')}</p>
              <Toggle
                label={t('settingsPage.animation-style')}
                value={flightStyle}
                onChange={setFlightStyle}
                options={[
                  { value: 'off', label: t('settingsPage.off') },
                  { value: 'minimal', label: t('settingsPage.minimal') },
                  { value: 'detailed', label: t('settingsPage.detailed') },
                ]}
              />
              <Switch
                checked={flightOnMap}
                onChange={setFlightOnMap}
                disabled={flightStyle === 'off'}
                label={t('settingsPage.show-on-the-map')}
                description={
                  t('settingsPage.the-shell-flies-from-the')
                }
              />
            </div>
          </Card>

          <SoundSettings />
        </div>

        <div className="space-y-4">
          {isDesktop && (
            <Card index="03" title={t('settings.desktop')} description={t('settings.desktopDescription')}>
              <button
                type="button"
                onClick={() => void toggleOverlay()}
                className="btn btn-primary mt-4"
              >
                {t('settings.toggleOverlay')}
              </button>

              <dl className="mt-4 divide-y divide-app-border overflow-hidden rounded-lg text-sm">
                {GLOBAL_HOTKEYS.map(({ keys, action }) => (
                  <div
                    key={action}
                    className="flex items-baseline gap-3 bg-app-raised px-3 py-2"
                  >
                    <dt className="min-w-32">
                      <kbd className="kbd">{keys}</kbd>
                    </dt>
                    <dd className="text-app-muted">{t(`settings.hotkeys.${action}` as MessageKey)}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded-md bg-app-raised px-3 py-2 text-xs text-app-muted">
                {t('settings.armaDisplayMode')}
              </p>
            </Card>
          )}

          <Card
            index="04"
            title={t('settings.openOnPhone')}
            description={t('settings.openOnPhoneDescription')}
          >
            <OpenOnPhone />
          </Card>

          <Card
            index="04"
            title={t('settingsPage.calculator-sections')}
            description={
              t('settingsPage.turn-on-only-what-you')
            }
          >
            <div className="mt-4 space-y-4">
              <FeaturePreview id="adjust">
              <Switch
                checked={adjust}
                onChange={(v) => setFeature('adjust', v)}
                label={t('adjustFire.adjust-fire')}
                description={
                  t('settingsPage.short-over-left-right-reports')
                }
              />
              </FeaturePreview>
              <FeaturePreview id="weather">
              <Switch
                checked={weather}
                onChange={(v) => setFeature('weather', v)}
                label={t('settingsPage.weather-ballistics')}
                description={t('settingsPage.weather-ballistics-description')}
              />
              </FeaturePreview>
              <FeaturePreview id="tot">
              <Switch
                checked={tot}
                onChange={(v) => setFeature('tot', v)}
                label={t('totPanel.time-on-target')}
                description={
                  t('settingsPage.set-the-impact-time-and')
                }
              />
              </FeaturePreview>
              <FeaturePreview id="table">
              <Switch
                checked={table}
                onChange={(v) => setFeature('table', v)}
                label={t('ballisticTableView.in-game-range-table')}
                description={
                  t('settingsPage.the-elevation-by-range-table')
                }
              />
              </FeaturePreview>
              <Switch
                checked={volley}
                onChange={(v) => setFeature('volley', v)}
                label={t('settingsPage.volley')}
                description={t('settingsPage.volley-description')}
              />
              <Switch
                checked={onlyGood}
                onChange={(v) => setFeature('onlyGood', v)}
                label={t('settingsPage.only-good')}
                description={t('settingsPage.only-good-description')}
              />
              <Switch
                checked={hideUnfit}
                onChange={(v) => setFeature('hideUnfit', v)}
                label={t('settingsPage.hide-unfit')}
                description={t('settingsPage.hide-unfit-description')}
              />
              <FeaturePreview id="journal">
              <Switch
                checked={journal}
                onChange={(v) => setFeature('journal', v)}
                label={t('settingsPage.target-journal')}
                description={
                  t('settingsPage.saving-targets-the-quick-list')
                }
              />
              </FeaturePreview>
            </div>
          </Card>

          <Card
            index="05"
            title={t('settings.experimental')}
            description={t('settings.experimentalDescription')}
          >
            <div className="mt-4 space-y-4">
              <FeaturePreview id="map">
              <Switch
                checked={mapInput}
                onChange={onMapInputChange}
                label={t('settings.mapInput')}
                description={t('settings.mapInputDescription')}
              />
              </FeaturePreview>
              <FeaturePreview id="markers">
              <Switch
                checked={showMarkers}
                onChange={onShowMarkersChange}
                label={t('settingsPage.map-markers')}
                description={
                  t('settingsPage.the-markers-panel-the-marker')
                }
              />
              </FeaturePreview>
              <FeaturePreview id="screenMarkers">
              <Switch
                checked={showScreenMarkers}
                onChange={onShowScreenMarkersChange}
                label={t('screenMarkers.markers-from-the-game-screen')}
                description={
                  t('settingsPage.recognise-markers-on-a-game')
                }
                disabled={!showMarkers}
              />
              </FeaturePreview>
              <FeaturePreview id="grid">
              <Switch
                checked={gridInput}
                onChange={onGridInputChange}
                label={t('settings.gridInput')}
                description={t('settings.gridInputDescription')}
              />
              </FeaturePreview>
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
