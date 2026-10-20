import type { ReactNode } from 'react'

import type { Language, Theme } from '../types/settings'
import { translations } from '../i18n/translations'
import { wakeLockSupported } from '../lib/useWakeLock'
import { OpenOnPhone } from '../components/OpenOnPhone'
import { GLOBAL_HOTKEYS, isDesktop, toggleOverlay } from '../lib/desktop'
import { SoundSettings } from '../components/SoundSettings'
import { SectionHeading, Switch, Toggle } from '../components/FormControls'
import { setFeature, useFeature } from '../lib/features'

interface SettingsPageProps {
  language: Language
  onLanguageChange: (language: Language) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
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
  language,
  onLanguageChange,
  theme,
  onThemeChange,
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
  const t = translations[language].settings
  const ru = language === 'ru'
  const adjust = useFeature('adjust')
  const weather = useFeature('weather')
  const tot = useFeature('tot')
  const journal = useFeature('journal')

  return (
    <section className="space-y-4">
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Card index="01" title={t.preferences}>
            <div className="mt-4 flex flex-wrap gap-6">
              <div>
                <p className="label mb-1.5">{t.language}</p>
                <Toggle
                  label={t.language}
                  value={language}
                  onChange={onLanguageChange}
                  options={[
                    { value: 'ru', label: 'Русский' },
                    { value: 'en', label: 'English' },
                  ]}
                />
              </div>

              <div>
                <p className="label mb-1.5">{t.theme}</p>
                <Toggle
                  label={t.theme}
                  value={theme}
                  onChange={onThemeChange}
                  options={[
                    { value: 'dark', label: t.dark },
                    { value: 'light', label: t.light },
                  ]}
                />
              </div>
            </div>

            <div className="mt-5">
              <Switch
                checked={keepAwake}
                onChange={onKeepAwakeChange}
                disabled={!wakeLockSupported}
                label={t.keepAwake}
                description={
                  wakeLockSupported
                    ? t.keepAwakeDescription
                    : t.keepAwakeUnsupported
                }
              />
            </div>

            <p className="label mt-5 text-app-faint">{t.autoSave}</p>
          </Card>

          <SoundSettings language={language} />
        </div>

        <div className="space-y-4">
          {isDesktop && (
            <Card index="03" title={t.desktop} description={t.desktopDescription}>
              <button
                type="button"
                onClick={() => void toggleOverlay()}
                className="btn btn-primary mt-4"
              >
                {t.toggleOverlay}
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
                    <dd className="text-app-muted">{t.hotkeys[action]}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded-md bg-app-raised px-3 py-2 text-xs text-app-muted">
                {t.armaDisplayMode}
              </p>
            </Card>
          )}

          <Card
            index="04"
            title={t.openOnPhone}
            description={t.openOnPhoneDescription}
          >
            <OpenOnPhone language={language} />
          </Card>

          <Card
            index="04"
            title={ru ? 'Разделы калькулятора' : 'Calculator sections'}
            description={
              ru
                ? 'Включайте только то, чем пользуетесь: главный экран останется чистым.'
                : 'Turn on only what you use to keep the main screen clean.'
            }
          >
            <div className="mt-4 space-y-4">
              <Switch
                checked={adjust}
                onChange={(v) => setFeature('adjust', v)}
                label={ru ? 'Корректировка огня' : 'Adjust fire'}
                description={
                  ru
                    ? 'Доклады «недолёт / перелёт, левее / правее». По связке стрелок получает уже готовые установки с учётом поправок — включать у него не нужно.'
                    : 'Short / over, left / right reports. Over the link a gunner gets the corrected settings anyway — no need to enable it there.'
                }
              />
              <Switch
                checked={weather}
                onChange={(v) => setFeature('weather', v)}
                label={ru ? 'Погодные поправки' : 'Weather corrections'}
                description={
                  ru
                    ? 'Ветер, температура, давление. Нужны, только если на сервере включена продвинутая баллистика.'
                    : 'Wind, temperature, pressure. Only for servers with advanced ballistics.'
                }
              />
              <Switch
                checked={tot}
                onChange={(v) => setFeature('tot', v)}
                label={ru ? 'Огонь по времени' : 'Time on target'}
                description={
                  ru
                    ? 'Задать момент разрыва: выстрел — по отсчёту. Время от наводчика приходит стрелку и без этой настройки.'
                    : 'Set the impact time and fire on the countdown. A time from the FDC reaches a gunner even without this.'
                }
              />
              <Switch
                checked={journal}
                onChange={(v) => setFeature('journal', v)}
                label={ru ? 'Журнал целей' : 'Target journal'}
                description={
                  ru
                    ? 'Сохранение целей, быстрый список на карте и журнал внизу страницы.'
                    : 'Saving targets, the quick list on the map and the journal below.'
                }
              />
            </div>
          </Card>

          <Card
            index="05"
            title={t.experimental}
            description={t.experimentalDescription}
          >
            <div className="mt-4 space-y-4">
              <Switch
                checked={mapInput}
                onChange={onMapInputChange}
                label={t.mapInput}
                description={t.mapInputDescription}
              />
              <Switch
                checked={showMarkers}
                onChange={onShowMarkersChange}
                label={language === 'ru' ? 'Метки на карте' : 'Map markers'}
                description={
                  language === 'ru'
                    ? 'Панель меток, инструмент «метка» и метки от стрелков по связке.'
                    : 'The markers panel, the marker tool and markers from gunners over the link.'
                }
              />
              <Switch
                checked={showScreenMarkers}
                onChange={onShowScreenMarkersChange}
                label={language === 'ru' ? 'Метки с экрана игры' : 'Markers from the game screen'}
                description={
                  language === 'ru'
                    ? 'Распознавание меток со скриншота карты игры. Работает только вместе с метками на карте.'
                    : 'Recognise markers on a game map screenshot. Needs the map markers above.'
                }
                disabled={!showMarkers}
              />
              <Switch
                checked={gridInput}
                onChange={onGridInputChange}
                label={t.gridInput}
                description={t.gridInputDescription}
              />
            </div>
          </Card>
        </div>
      </div>
    </section>
  )
}
