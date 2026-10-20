import type { ArtilleryCategory } from '../types/gameModel'
import type { Language } from '../types/settings'
import { categoryLabels, categoryMarks } from '../data/categories'


// Линейные значки в сетке 24×24: контур 1.5, скруглённые стыки.
function Glyph({ category }: { category: ArtilleryCategory }) {
  switch (category) {
    case 'mortar':
      return (
        <>
          <path d="M6.6 17.6 L15.4 5.4 L17.4 6.8 L8.6 19 Z" />
          <path d="M13.6 10.4 L10.5 19.5 M13.6 10.4 L18 19.5" />
          <path d="M4 19.5 H11" />
        </>
      )

    case 'towed':
      return (
        <>
          <path d="M10 12.2 L21 7.8 L21.6 9.3 L10.7 14" />
          <path d="M7 11.5 H11.5 V15.5 H7 Z" />
          <circle cx="9.5" cy="17.2" r="2.6" />
          <path d="M7.4 18.4 L2.5 20.5" />
        </>
      )

    case 'spg':
      return (
        <>
          <rect x="3" y="15.5" width="16" height="4" rx="2" />
          <path d="M4.5 15.5 L6.5 12.5 H16 L18 15.5" />
          <path d="M8.5 12.5 L9.8 9.5 H13.8 L15 12.5" />
          <path d="M13.8 10.6 L21.5 7.8" />
        </>
      )

    case 'mlrs':
      return (
        <>
          <path d="M3.8 13.6 L13.4 8 L14.6 10.2 L5 15.6 Z" />
          <path d="M8.5 13 V16.5" />
          <path d="M2.5 16.5 H21 V14 L19 11.5 H16 V16.5" />
          <circle cx="6" cy="18.6" r="1.4" />
          <circle cx="10" cy="18.6" r="1.4" />
          <circle cx="18" cy="18.6" r="1.4" />
        </>
      )
  }
}

interface Props {
  category: ArtilleryCategory
  // xs — на кнопке выбора, sm — в списке, md — в карточках
  size?: 'xs' | 'sm' | 'md'
  language: Language
}

export function ArtilleryIcon({ category, size = 'sm', language }: Props) {
  return (
    <span
      title={categoryLabels[category][language]}
      className={[
        'relative inline-flex shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text',
        size === 'xs' ? 'h-7 w-7' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12',
      ].join(' ')}
    >
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 h-1.5 w-1.5 rounded-full ${categoryMarks[category]}`}
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={size === 'xs' ? 'h-[18px] w-[18px]' : size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'}
      >
        <Glyph category={category} />
      </svg>
    </span>
  )
}
