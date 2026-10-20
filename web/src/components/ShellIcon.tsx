import type { ArtilleryCategory } from '../types/gameModel'
import { categoryMarks } from '../data/categories'
import { shellKind, type ShellKind } from '../lib/shellKind'

const kindNames: Record<ShellKind, { ru: string; en: string }> = {
  he: { ru: 'Фугасный', en: 'High explosive' },
  illum: { ru: 'Осветительный', en: 'Illumination' },
  smoke: { ru: 'Дымовой', en: 'Smoke' },
}

// Корпус снаряда в сетке 24×24, сдвинут влево-вниз: справа вверху — значок вида.
// Миномётная мина — с оперением, артиллерийский снаряд — с ведущим пояском,
// реактивный — с крыльями стабилизатора и струёй.
function Body({ category }: { category: ArtilleryCategory }) {
  switch (category) {
    case 'mortar':
      return (
        <>
          <path d="M9.5 4c2.4 2.2 3.2 4.6 3.2 7.4H6.3C6.3 8.6 7.1 6.2 9.5 4z" />
          <path d="M8 11.4V15h3v-3.6" />
          <path d="M9.5 15v5.5M6.5 20.5 8 15M12.5 20.5 11 15" />
        </>
      )
    case 'mlrs':
      return (
        <>
          <path d="M9.5 3c1.9 1.9 2.8 4.2 2.8 7.5V17H6.7v-6.5c0-3.3.9-5.6 2.8-7.5z" />
          <path d="M6.7 13.5 4 17.5h2.7M12.3 13.5l2.7 4h-2.7" />
          <path d="M8 19l1.5 2.5L11 19" />
        </>
      )
    default:
      return (
        <>
          <path d="M9.5 3c2.3 2 3.4 4.6 3.4 7.8V20H6.1v-9.2C6.1 7.6 7.2 5 9.5 3z" />
          <path d="M6.1 15.5h6.8M6.1 18h6.8" />
        </>
      )
  }
}

function Badge({ kind }: { kind: ShellKind }) {
  switch (kind) {
    case 'illum':
      // Вспышка: солнышко
      return (
        <>
          <circle cx="18" cy="6.5" r="1.8" />
          <path d="M18 2.5v1M18 9.5v1M14 6.5h1M21 6.5h1M15.2 3.7l.7.7M20.1 8.6l.7.7M20.8 3.7l-.7.7M15.9 8.6l-.7.7" />
        </>
      )
    case 'smoke':
      // Облачко дыма
      return (
        <path d="M15.5 9.5a2 2 0 0 1 .3-4 2.7 2.7 0 0 1 5 .6 1.9 1.9 0 0 1-.3 3.4z" />
      )
    default:
      // Фугас: разрыв — звёздочка
      return <path d="m18 3 .9 2.6 2.6.9-2.6.9L18 10l-.9-2.6-2.6-.9 2.6-.9z" />
  }
}

interface Props {
  category: ArtilleryCategory
  type: string
  language: 'ru' | 'en'
  size?: 'xs' | 'sm'
}

/** Значок снаряда: форма по классу орудия, вид (HE / осветительный / дымовой) — в углу. */
export function ShellIcon({ category, type, language, size = 'xs' }: Props) {
  const kind = shellKind(type)

  return (
    <span
      title={kindNames[kind][language]}
      className={[
        'relative inline-flex shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text',
        size === 'xs' ? 'h-7 w-7' : 'h-9 w-9',
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
        className={size === 'xs' ? 'h-[18px] w-[18px]' : 'h-6 w-6'}
      >
        <Body category={category} />
        <Badge kind={kind} />
      </svg>
    </span>
  )
}
