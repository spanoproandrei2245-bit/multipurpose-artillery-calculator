import type { ReactNode } from 'react'

import type { Language, Theme } from '../types/settings'
import { translations } from '../i18n/translations'
import { wakeLockSupported } from '../lib/useWakeLock'
import { OpenOnPhone } from '../components/OpenOnPhone'
import { GLOBAL_HOTKEYS, isDesktop, toggleOverlay } from '../lib/desktop'
import { SoundSettings } from '../components/SoundSettings'
import { SectionHeading, Switch, Toggle } from '../components/FormControls'

interface SettingsPageProps {
  language: Language
  onLanguageChange: (language: Language) => void
  theme: Theme
  onThemeChange: (theme: Theme) => void
  gridInput: boolean
  onGridInputChange: (value: boolean) => void
  mapInput: boolean
  onMapInputChange: (value: boolean) => void
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
  keepAwake,
  onKeepAwakeChange,
}: SettingsPageProps) {
  const t = translations[language].settings

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
