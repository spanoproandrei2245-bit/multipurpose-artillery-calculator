import { t, type MessageKey } from '../i18n'
import { useState, type ReactNode } from 'react'

import { useFeature } from '../lib/features'
import { FieldIcon } from './FieldIcon'

export type PreviewId =
  | 'map'
  | 'grid'
  | 'markers'
  | 'screenMarkers'
  | 'adjust'
  | 'weather'
  | 'tot'
  | 'mrsi'
  | 'journal'
  | 'table'
  | 'keepAwake'

const GUN = '#4393e4'
const TARGET = '#e47474'
const ACCENT = 'var(--color-accent)'
const INK = 'var(--color-muted)'
const LOOP = '6s'

// Сетка карты
function MapBase({ children }: { children?: ReactNode }) {
  return (
    <>
      <rect x="10" y="10" width="220" height="120" rx="6" fill="var(--color-surface)" />
      {[50, 90, 130, 170, 210].map((x) => (
        <path key={x} d={`M${x} 10V130`} stroke={INK} strokeOpacity=".25" />
      ))}
      {[40, 70, 100].map((y) => (
        <path key={y} d={`M10 ${y}H230`} stroke={INK} strokeOpacity=".25" />
      ))}
      {children}
    </>
  )
}

// Появление элемента на доле цикла [from, to] и исчезновение в конце
function Appear({
  from,
  children,
}: {
  from: number
  children: ReactNode
}) {
  return (
    <g opacity="0">
      <animate
        attributeName="opacity"
        dur={LOOP}
        repeatCount="indefinite"
        keyTimes={`0;${from};${from + 0.05};0.92;1`}
        values="0;0;1;1;0"
      />
      {children}
    </g>
  )
}

function Dot({ x, y, color }: { x: number; y: number; color: string }) {
  return <circle cx={x} cy={y} r="5" fill={color} stroke="#fff" strokeWidth="1.2" />
}

function Demo({ id }: { id: PreviewId }) {
  switch (id) {
    case 'map':
      return (
        <>
          <MapBase />
          <Appear from={0.1}>
            <Dot x={70} y={100} color={GUN} />
            <text x="80" y="112" fontSize="9" fill={INK}>{t('featurePreview.lmb')}</text>
          </Appear>
          <Appear from={0.35}>
            <Dot x={175} y={42} color={TARGET} />
            <text x="148" y="34" fontSize="9" fill={INK}>{t('featurePreview.rmb')}</text>
          </Appear>
          <Appear from={0.55}>
            <path d="M70 100 175 42" stroke="#fff" strokeWidth="2" strokeDasharray="130">
              <animate attributeName="stroke-dashoffset" from="130" to="0" dur="1.2s" repeatCount="indefinite" />
            </path>
            <rect x="92" y="62" width="70" height="16" rx="4" fill="var(--color-raised)" />
            <text x="98" y="73.5" fontSize="9.5" fill="var(--color-text)">{t('featurePreview.1-286-m-6283-mil')}</text>
          </Appear>
        </>
      )
    case 'grid':
      return (
        <>
          <rect x="20" y="22" width="200" height="26" rx="5" fill="var(--color-raised)" />
          <text x="30" y="39" fontSize="12" fill="var(--color-text)">
            046 078
          </text>
          <rect x="20" y="58" width="200" height="26" rx="5" fill="var(--color-raised)" />
          <text x="30" y="75" fontSize="12" fill="var(--color-text)">
            052 081
          </text>
          <Appear from={0.4}>
            <path d="M120 92v10m-5-5 5 5 5-5" stroke={ACCENT} strokeWidth="2" fill="none" strokeLinecap="round" />
            <text x="30" y="124" fontSize="14" fontWeight="600" fill="var(--color-text)">
              {t('featurePreview.dist-612-m-bearing-1120')}
            </text>
          </Appear>
        </>
      )
    case 'markers':
      return (
        <>
          <MapBase />
          <Appear from={0.15}>
            <g>
              <animateTransform attributeName="transform" type="translate" values="0 -30;0 0;0 0" keyTimes="0;0.15;1" dur={LOOP} repeatCount="indefinite" />
              <path d="M120 74s12-10 12-22a12 12 0 1 0-24 0c0 12 12 22 12 22z" fill="#e60000" stroke="#fff" strokeWidth="1.5" />
              <circle cx="120" cy="52" r="4" fill="#fff" />
            </g>
            <rect x="136" y="44" width="62" height="16" rx="4" fill="var(--color-raised)" />
            <text x="141" y="55.5" fontSize="9.5" fill="var(--color-text)">{t('featurePreview.mg-nest')}</text>
          </Appear>
          <Appear from={0.5}>
            <circle cx="60" cy="98" r="5" fill="#00cc00" stroke="#fff" strokeWidth="1.2" />
            <circle cx="190" cy="100" r="5" fill="#0000ff" stroke="#fff" strokeWidth="1.2" />
          </Appear>
        </>
      )
    case 'screenMarkers':
      return (
        <>
          <rect x="18" y="14" width="130" height="112" rx="5" fill="var(--color-surface)" stroke={INK} strokeOpacity=".4" />
          <rect x="26" y="22" width="114" height="96" fill="var(--color-raised)" />
          <rect x="26" y="22" width="114" height="3" fill={ACCENT}>
            <animate attributeName="y" values="22;115;22" dur={LOOP} repeatCount="indefinite" />
          </rect>
          <Appear from={0.4}>
            <circle cx="60" cy="60" r="4" fill="#e60000" />
            <circle cx="100" cy="88" r="4" fill="#0000ff" />
          </Appear>
          <path d="M152 70h22m-6-5 6 5-6 5" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
          <MiniMap />
          <Appear from={0.6}>
            <circle cx="196" cy="57" r="3.5" fill="#e60000" />
            <circle cx="214" cy="80" r="3.5" fill="#0000ff" />
          </Appear>
        </>
      )
    case 'adjust':
      return (
        <>
          <MapBase />
          <Dot x={60} y={100} color={GUN} />
          <Dot x={180} y={40} color={TARGET} />
          <path d="M60 100 180 40" stroke={INK} strokeOpacity=".6" strokeDasharray="4 4" />
          <Appear from={0.2}>
            <circle cx="150" cy="70" r="6" fill="none" stroke="#ffb020" strokeWidth="2" />
            <text x="80" y="124" fontSize="10.5" fill="var(--color-text)">{t('featurePreview.short-40-m-left-10')}</text>
          </Appear>
          <Appear from={0.6}>
            <circle cx="180" cy="40" r="7" fill="none" stroke="#62c462" strokeWidth="2.5" />
          </Appear>
        </>
      )
    case 'weather':
      return (
        <>
          <rect x="10" y="10" width="220" height="120" rx="6" fill="var(--color-surface)" />
          <path d="M20 110H220" stroke={INK} strokeOpacity=".4" />
          {[34, 56, 78].map((y, i) => (
            <path key={y} d={`M10 ${y}h28`} stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".6">
              <animateTransform attributeName="transform" type="translate" values="-30 0;260 0" dur={`${2 + i * 0.4}s`} repeatCount="indefinite" />
            </path>
          ))}
          <path d="M30 110C70 10 150 10 190 110" stroke="#fff" strokeOpacity=".5" strokeWidth="1.5" fill="none" strokeDasharray="3 4" />
          <path d="M30 110C70 10 150 10 205 110" stroke="#ffb020" strokeWidth="2" fill="none" strokeDasharray="3 4" />
          <text x="24" y="28" fontSize="9.5" fill={INK}>{t('featurePreview.wind-pushes-the-shell')}</text>
          <text x="150" y="124" fontSize="9.5" fill="#ffb020">{t('featurePreview.correction')}</text>
        </>
      )
    case 'tot':
      return (
        <>
          <circle cx="70" cy="70" r="40" fill="var(--color-raised)" stroke={INK} strokeOpacity=".5" strokeWidth="2" />
          <path d="M70 70V40" stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round">
            <animateTransform attributeName="transform" type="rotate" from="0 70 70" to="360 70 70" dur={LOOP} repeatCount="indefinite" />
          </path>
          <text x="124" y="52" fontSize="10" fill={INK}>{t('featurePreview.impact-at')}</text>
          <text x="124" y="74" fontSize="20" fontWeight="700" fill="var(--color-text)">18:30:00</text>
          <rect x="124" y="92" width="96" height="8" rx="4" fill="var(--color-raised)" />
          <rect x="124" y="92" width="0" height="8" rx="4" fill={ACCENT}>
            <animate attributeName="width" values="0;96;96" keyTimes="0;0.85;1" dur={LOOP} repeatCount="indefinite" />
          </rect>
          <text x="124" y="118" fontSize="9.5" fill={INK}>{t('featurePreview.countdown-5-4-3-2')}</text>
        </>
      )
    case 'mrsi': {
      // Вылет: высокая дуга первой, низкая последней; разрыв у всех в 0.8 цикла
      const arcs = [
        { d: 'M28 116 Q120 -36 212 116', from: 0 },
        { d: 'M28 116 Q120 14 212 116', from: 0.2 },
        { d: 'M28 116 Q120 64 212 116', from: 0.38 },
      ]
      return (
        <>
          <path d="M14 118H226" stroke={INK} strokeOpacity=".4" />
          {arcs.map((arc) => (
            <g key={arc.d}>
              <path d={arc.d} fill="none" stroke={INK} strokeOpacity=".35" strokeDasharray="3 4" />
              <circle r="3.5" fill="var(--color-text)">
                <animateMotion
                  path={arc.d}
                  dur={LOOP}
                  repeatCount="indefinite"
                  calcMode="linear"
                  keyPoints="0;0;1;1"
                  keyTimes={`0;${arc.from};0.8;1`}
                />
                <animate
                  attributeName="opacity"
                  dur={LOOP}
                  repeatCount="indefinite"
                  keyTimes={`0;${arc.from};${arc.from + 0.01};0.8;0.81;1`}
                  values="0;0;1;1;0;0"
                />
              </circle>
            </g>
          ))}
          <Dot x={28} y={116} color={GUN} />
          <Dot x={212} y={116} color={TARGET} />
          <circle cx="212" cy="116" r="0" fill="none" stroke="#ffb020" strokeWidth="3">
            <animate attributeName="r" dur={LOOP} repeatCount="indefinite" keyTimes="0;0.8;0.95;1" values="0;0;18;18" />
            <animate attributeName="opacity" dur={LOOP} repeatCount="indefinite" keyTimes="0;0.8;0.95;1" values="0;1;0;0" />
          </circle>
        </>
      )
    }
    case 'journal':
      return (
        <>
          {([t('featurePreview.target-1'), t('featurePreview.bridge'), t('featurePreview.tree-line')]).map((t, i) => (
            <g key={t}>
              <rect x="24" y={20 + i * 34} width="192" height="28" rx="6" fill="var(--color-raised)" />
              <text x="36" y={38 + i * 34} fontSize="11.5" fill="var(--color-text)">{t}</text>
              <rect x="24" y={20 + i * 34} width="192" height="28" rx="6" fill="none" stroke={ACCENT} strokeWidth="2" opacity="0">
                <animate attributeName="opacity" values={['0;1;1;0;0;0;0', '0;0;0;1;1;0;0', '0;0;0;0;0;1;1'][i]} dur={LOOP} repeatCount="indefinite" />
              </rect>
            </g>
          ))}
        </>
      )
    case 'table':
      return (
        <>
          {[0, 1, 2, 3, 4].map((r) => (
            <g key={r}>
              <path d={`M20 ${30 + r * 22}H220`} stroke={INK} strokeOpacity=".25" />
              <text x="26" y={24 + r * 22} fontSize="11" fill="var(--color-text)">{800 + r * 100} {t('unit.m')}</text>
              <text x="120" y={24 + r * 22} fontSize="11" fill="var(--color-text)">{1180 - r * 63} {t('unit.mil')}</text>
              <text x="180" y={24 + r * 22} fontSize="11" fill={INK}>{(25.5 - r * 1.5).toFixed(1)} {t('unit.s')}</text>
            </g>
          ))}
          <rect x="18" y="12" width="204" height="20" rx="4" fill={ACCENT} fillOpacity=".25" stroke={ACCENT}>
            <animate attributeName="y" values="12;12;34;56;78;100;100" dur={LOOP} repeatCount="indefinite" />
          </rect>
        </>
      )
    case 'keepAwake':
      return (
        <>
          <rect x="94" y="12" width="52" height="108" rx="9" fill="var(--color-raised)" stroke={INK} strokeWidth="2" />
          <rect x="100" y="24" width="40" height="80" rx="3" fill="var(--color-surface)" />
          <circle cx="120" cy="64" r="11" fill="#ffd166">
            <animate attributeName="opacity" values="1;0.55;1" dur="2.4s" repeatCount="indefinite" />
          </circle>
          {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
            <path key={a} d="M120 46v-5" stroke="#ffd166" strokeWidth="2" strokeLinecap="round" transform={`rotate(${a} 120 64)`} />
          ))}
          <text x="150" y="68" fontSize="10" fill={INK}>{t('featurePreview.screen-stays-on')}</text>
        </>
      )
  }
}

function MiniMap() {
  return (
    <>
      <rect x="180" y="40" width="48" height="56" rx="4" fill="var(--color-surface)" />
      <path d="M196 40v56M212 40v56M180 60h48M180 78h48" stroke={INK} strokeOpacity=".25" />
    </>
  )
}

const CAPTIONS: Record<PreviewId, MessageKey> = {
  map: 'featurePreview.place-the-gun-and-target',
  grid: 'featurePreview.type-the-grid-references-of',
  markers: 'featurePreview.labelled-coloured-markers-on-the',
  screenMarkers: 'featurePreview.a-screenshot-of-the-in',
  adjust: 'featurePreview.the-observer-reports-short-over',
  weather: 'featurePreview.wind-temperature-and-pressure-adjust',
  tot: 'featurePreview.set-the-impact-time-the',
  mrsi: 'featurePreview.mrsi',
  journal: 'featurePreview.save-targets-and-switch-between',
  table: 'featurePreview.the-in-game-elevation-table',
  keepAwake: 'featurePreview.the-phone-screen-stays-on',
}

/**
 * Строка настройки с примером: под ней кнопка «Показать пример», по нажатию
 * открывается короткая анимация и подпись. Без наведения и долгого нажатия:
 * на телефоне так удобнее, и анимация не рисуется, пока её не открыли.
 */
export function FeaturePreview({
  id,
  children,
}: {
  id: PreviewId
  children: ReactNode
}) {
  const hints = useFeature('hints')
  const [open, setOpen] = useState(false)

  return (
    <div>
      {children}
      {hints && (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md text-[13px] font-medium text-accent hover:underline"
        >
          <FieldIcon name={open ? 'close' : 'play'} className="h-3.5 w-3.5" />
          {open ? t('featurePreview.hide') : t('featurePreview.show')}
        </button>
      )}
      {hints && open && (
        <div className="appear mt-2 max-w-sm rounded-lg bg-app-raised p-3">
          <svg viewBox="0 0 240 140" className="block w-full rounded-md bg-app-surface" aria-hidden="true">
            <Demo id={id} />
          </svg>
          <p className="mt-2 text-[13px] leading-snug text-app-text-2">{t(CAPTIONS[id])}</p>
        </div>
      )}
    </div>
  )
}
