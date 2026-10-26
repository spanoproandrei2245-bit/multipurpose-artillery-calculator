import { t } from '../i18n'
import { Dropdown } from './Dropdown'
import { FieldIcon } from './FieldIcon'
import { useEffect, useRef, useState, type JSX } from 'react'

import { isDesktop } from '../lib/desktop'
import { syncStatusColor, useSync } from '../lib/syncContext'
import { setPanel, togglePanel } from '../lib/uiPanels'
import { LANGUAGES } from '../i18n'
import type { Language, Theme } from '../types/settings'

const REPO_URL =
  'https://github.com/spanoproandrei2245-bit/multipurpose-artillery-calculator'

// Страница автора на GitHub
const AUTHOR_URL = 'https://github.com/spanoproandrei2245-bit'

// Профиль автора в Steam
const AUTHOR_STEAM_URL: string | null = 'https://steamcommunity.com/id/Aron_Heis/'

// Релизы с установщиком программы для ПК
const RELEASES_URL = `${REPO_URL}/releases`

export type View = 'dashboard' | 'sync' | 'settings'

interface Props {
  view: View
  onViewChange: (view: View) => void
  language: Language
  onLanguageChange: (language: Language) => void
  theme: Theme
  // Центр кнопки — откуда расходится круг смены темы
  onToggleTheme: (origin: { x: number; y: number }) => void
}

function FlagRu() {
  return (
    <svg viewBox="0 0 9 6" className="h-3.5 w-5 rounded-[2px]" aria-hidden="true">
      <rect width="9" height="2" fill="#fff" />
      <rect y="2" width="9" height="2" fill="#0039a6" />
      <rect y="4" width="9" height="2" fill="#d52b1e" />
    </svg>
  )
}

function FlagGb() {
  return (
    <svg viewBox="0 0 60 30" className="h-3.5 w-5 rounded-[2px]" aria-hidden="true">
      <clipPath id="flag-gb">
        <path d="M0 0v30h60V0z" />
      </clipPath>
      <g clipPath="url(#flag-gb)">
        <path d="M0 0v30h60V0z" fill="#012169" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
        <path d="M0 0l60 30m0-30L0 30" stroke="#C8102E" strokeWidth="4" />
        <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
      </g>
    </svg>
  )
}

// Простые флаги: полосы и круг, без внешних файлов
function Stripes({ colors, vertical = false }: { colors: string[]; vertical?: boolean }) {
  const n = colors.length
  return (
    <svg viewBox="0 0 9 6" className="h-3.5 w-5 rounded-[2px]" aria-hidden="true">
      {colors.map((color, i) =>
        vertical ? (
          <rect key={i} x={(9 / n) * i} width={9 / n + 0.02} height="6" fill={color} />
        ) : (
          <rect key={i} y={(6 / n) * i} width="9" height={6 / n + 0.02} fill={color} />
        )
      )}
    </svg>
  )
}

function FlagUa() {
  return <Stripes colors={['#0057b7', '#ffd700']} />
}
function FlagDe() {
  return <Stripes colors={['#000000', '#dd0000', '#ffce00']} />
}
function FlagFr() {
  return <Stripes colors={['#0055a4', '#ffffff', '#ef4135']} vertical />
}
function FlagJp() {
  return (
    <svg viewBox="0 0 9 6" className="h-3.5 w-5 rounded-[2px]" aria-hidden="true">
      <rect width="9" height="6" fill="#fff" />
      <circle cx="4.5" cy="3" r="1.8" fill="#bc002d" />
    </svg>
  )
}
function FlagCn() {
  return (
    <svg viewBox="0 0 9 6" className="h-3.5 w-5 rounded-[2px]" aria-hidden="true">
      <rect width="9" height="6" fill="#de2910" />
      <path d="m1.9 .6.4 1.1h1.1l-.9.7.3 1.1-.9-.7-.9.7.3-1.1-.9-.7h1.1z" fill="#ffde00" />
    </svg>
  )
}

function Flag({ id }: { id: Language }) {
  const Component = FLAGS[id]
  return <Component />
}

const FLAGS: Record<Language, () => JSX.Element> = {
  ru: FlagRu,
  en: FlagGb,
  uk: FlagUa,
  de: FlagDe,
  fr: FlagFr,
  ja: FlagJp,
  zh: FlagCn,
}

/** Выбор языка: кнопка с флагом и меню вверх. */
function LanguageSelect({
  language,
  onChange,
  className = '',
}: {
  language: Language
  onChange: (language: Language) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const current = LANGUAGES.find((item) => item.id === language) ?? LANGUAGES[0]

  useEffect(() => {
    if (!open) return
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        aria-label={current.name}
        className="btn pr-2.5 max-sm:h-11 max-sm:w-11 max-sm:px-0"
      >
        <Flag id={current.id} />
        <span className="max-sm:hidden">{current.name}</span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-app-muted max-sm:hidden" aria-hidden="true">
          <path
            d="m7 15 5 5 5-5M7 9l5-5 5 5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 bottom-full z-30 mb-2 min-w-full rounded-lg bg-app-raised p-1 shadow-xl shadow-black/40"
        >
          {LANGUAGES.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={item.id === language}
                onClick={() => {
                  onChange(item.id)
                  setOpen(false)
                }}
                className={[
                  'flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[15px]',
                  item.id === language
                    ? 'bg-app-raised-hover text-app-text'
                    : 'text-app-text-2 hover:bg-app-raised-hover',
                ].join(' ')}
              >
                <Flag id={item.id} />
                {item.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Версия, автор и ссылка на проект — во всплывающей подписи за одной иконкой. */
/** Значок GitHub. */
function GithubMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.4-5.27 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  )
}

function AboutButton() {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function close(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('footer.about')}
        title={t('footer.about')}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost px-2 text-app-faint max-sm:h-11 max-sm:w-11 max-sm:bg-app-raised"
      >
        <FieldIcon name="info" className="h-5 w-5" />
      </button>
      {open && (
        <div className="tour-fade absolute bottom-full left-0 z-30 mb-2 w-72 rounded-xl bg-app-raised p-2 text-[13.5px] shadow-xl shadow-black/40">
          <p className="px-2.5 pt-1.5 pb-2 font-semibold text-app-text">
            Multipurpose Artillery Calculator
          </p>

          {/* Автор: ник и ссылки на его профили справа */}
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text">
              <FieldIcon name="user" className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words text-app-text">Heis</span>
              <span className="block break-words text-[12px] text-app-muted">
                {t('footer.author-on-github')}
              </span>
            </span>
            {AUTHOR_STEAM_URL && (
              <a
                href={AUTHOR_STEAM_URL}
                target="_blank"
                rel="noreferrer"
                title={t('footer.author-steam')}
                aria-label={t('footer.author-steam')}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-raised-hover hover:text-app-text"
              >
                <FieldIcon name="steam" className="h-[18px] w-[18px]" />
              </a>
            )}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              title={t('footer.author-github')}
              aria-label={t('footer.author-github')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-app-muted transition-colors hover:bg-app-raised-hover hover:text-app-text"
            >
              <GithubMark />
            </a>
          </div>

          {[
            {
              href: REPO_URL,
              title: t('footer.project-on-github'),
              text: t('footer.source-and-releases'),
              icon: <GithubMark />,
            },
            {
              href: `${REPO_URL}/issues`,
              title: t('footer.report-a-problem'),
              text: t('footer.report-hint'),
              icon: <FieldIcon name="help" className="h-4 w-4" />,
            },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors hover:bg-app-raised-hover"
            >
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text">
                {item.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-app-text">{item.title}</span>
                <span className="block break-words text-[12px] text-app-muted">{item.text}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Подвал: ссылка на проект слева; справа — связка, настройки и язык.
 */
export function Footer({
  view,
  onViewChange,
  language,
  onLanguageChange,
  theme,
  onToggleTheme,
}: Props) {
  const sync = useSync()

  // Телефон: сверху «О программе», обучение (тянется) и настройки шириной
  // в две кнопки; ниже связка (тянется), тема и язык. Пустых мест нет.
  // Компьютер: всё в одну строку, справа от «О программе».
  return (
    <footer className="mx-auto grid w-full max-w-[1240px] grid-cols-[auto_1fr_auto_auto] items-center gap-2 px-4 py-4 sm:flex sm:flex-nowrap sm:px-6 sm:py-5">
      <AboutButton />

      <div className="col-start-2 row-start-1 min-w-0">
        <Dropdown
          up
          variant="ghost"
          className="max-sm:w-full"
          buttonClassName="max-sm:h-11 max-sm:w-full max-sm:max-w-none max-sm:bg-app-raised max-sm:px-3"
          tourId="help"
          label={t('footer.tutorial')}
          value=""
          buttonLabel={
            <span className="flex items-center gap-2">
              <FieldIcon name="book" className="h-[18px] w-[18px]" />
              {t('footer.tutorial')}
            </span>
          }
          onChange={(value) => {
            if (value === 'help') {
              setPanel('help', true)
              return
            }
            onViewChange('dashboard')
            setPanel(value === 'advanced' ? 'tourAdvanced' : 'tour', true)
          }}
          options={[
            {
              value: 'basic',
              label: t('footer.basic-tutorial'),
              description: t('footer.map-input-charge-fire'),
            },
            {
              value: 'advanced',
              label: t('footer.advanced-tutorial'),
              description: t('footer.maps-line-link-details'),
            },
            {
              value: 'help',
              label: t('footer.help'),
              description: t('footer.help-description'),
              divider: true,
            },
          ]}
        />
      </div>

        <button
          type="button"
          onClick={() => togglePanel('hotkeys')}
          data-tour="hotkeys"
          title={t('footer.keyboard-shortcuts')}
          aria-label={t('footer.keyboard-shortcuts')}
          className="btn btn-ghost hidden sm:inline-flex"
        >
          <FieldIcon name="keyboard" className="h-[18px] w-[18px]" />
          {/* На средней ширине — только значок, подпись в подсказке */}
          <span className="hidden xl:inline">{t('footer.keyboard-shortcuts')}</span>
        </button>

        {!isDesktop && (
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            title={t('footer.overlay-on-top-of-the')}
            aria-label={t('footer.desktop-app')}
            className="btn btn-ghost max-sm:hidden"
          >
            <FieldIcon name="desktop" className="h-[18px] w-[18px]" />
            <span className="hidden lg:inline">{t('footer.desktop-app')}</span>
          </a>
        )}

        <button
          type="button"
          onClick={() => onViewChange(view === 'sync' ? 'dashboard' : 'sync')}
          data-tour="link"
          aria-pressed={view === 'sync'}
          className={[
            'btn col-span-2 col-start-1 row-start-2 justify-center max-sm:h-11 sm:ml-auto',
            view === 'sync' ? 'bg-app-raised-hover text-app-text' : '',
          ].join(' ')}
        >
          <span
            className={`h-2 w-2 rounded-full ${syncStatusColor(sync.enabled ? sync.status : 'off')}`}
          />
          <FieldIcon name="link" className="h-[18px] w-[18px]" />
          {t('footer.link')}
          {sync.enabled && sync.code && (
            <span className="text-app-muted">{sync.code}</span>
          )}
        </button>

        <button
          type="button"
          onClick={(event) => {
            const r = event.currentTarget.getBoundingClientRect()
            onToggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
          }}
          aria-label={t('footer.toggle-theme')}
          data-tour="theme"
          title={
            theme === 'dark'
              ? t('footer.light-theme')
              : t('footer.dark-theme')
          }
          className="btn col-start-3 row-start-2 px-2.5 max-sm:h-11 max-sm:w-11 max-sm:justify-center"
        >
          <FieldIcon
            key={theme}
            name={theme === 'dark' ? 'moon' : 'sun'}
            className="theme-icon h-5 w-5"
          />
        </button>

        <button
          type="button"
          onClick={() =>
            onViewChange(view === 'settings' ? 'dashboard' : 'settings')
          }
          aria-pressed={view === 'settings'}
          data-tour="settings"
          aria-label={t('app.settings')}
          title={t('app.settings')}
          className={[
            'btn col-span-2 col-start-3 row-start-1 px-2.5 max-sm:h-11 max-sm:justify-center',
            view === 'settings' ? 'bg-app-raised-hover text-app-text' : '',
          ].join(' ')}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.31-.09.64-.09.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.48.48 0 0 0-.12-.61l-2.01-1.58ZM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2Z" />
          </svg>
        </button>

        <LanguageSelect
          language={language}
          onChange={onLanguageChange}
          className="col-start-4 row-start-2"
        />
    </footer>
  )
}
