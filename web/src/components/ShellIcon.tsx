import type { ArtilleryCategory } from '../types/gameModel'
import { t, type MessageKey } from '../i18n'
import { categoryMarks } from '../data/categories'
import { shellKind, type ShellKind } from '../lib/shellKind'

const kindNames: Record<ShellKind, MessageKey> = {
  he: 'shellIcon.high-explosive',
  illum: 'shellIcon.illumination',
  smoke: 'shellIcon.smoke',
}

// Корпус снаряда по центру сетки 24×24; значок вида — в правом верхнем углу.
// Миномётная мина — каплевидный корпус, хвостовая трубка и стабилизатор;
// артиллерийский снаряд — ogive, ведущие пояски и скошенное донце;
// реактивный — корпус с иллюминатором, крылья и струя двигателя.
function Body({ category }: { category: ArtilleryCategory }) {
  switch (category) {
    case 'mortar':
      return (
        <g transform="translate(1 0)">
          <path d="M11 3.2c2.5 1.9 3.5 4.3 3.5 7v3h-7v-3c0-2.7 1-5.1 3.5-7z" />
          <path d="M9.4 13.2v3.6h3.2v-3.6" />
          <path d="M9.4 16.8 7 21.2h8l-2.4-4.4" />
          <path d="M7.5 11.2h7" />
        </g>
      )
    case 'mlrs':
      return (
        <>
          <path d="M12 2.2c2 1.8 3 4 3 6.8v7.5H9V9c0-2.8 1-5 3-6.8z" />
          <circle cx="12" cy="9" r="1.3" />
          <path d="M9 12.6 5.8 18 9 16.5M15 12.6l3.2 5.4-3.2-1.5" />
          <path d="M10.4 18.6 12 22l1.6-3.4" />
        </>
      )
    default:
      return (
        <>
          <path d="M12 2.4c2.8 2.3 3.6 5.1 3.6 8V19l-1.7 2h-3.8l-1.7-2v-8.6c0-2.9.8-5.7 3.6-8z" />
          <path d="M8.4 14.8h7.2M8.4 17h7.2" />
        </>
      )
  }
}

function Badge({ kind }: { kind: ShellKind }) {
  switch (kind) {
    case 'illum':
      // Вспышка: солнышко
      return (
        <g transform="translate(2.6 -0.4)">
          <circle cx="18" cy="6" r="1.5" />
          <path d="M18 2.6v1M18 8.4v1M14.6 6h1M20.4 6h1M15.6 3.6l.7.7M19.7 7.7l.7.7M20.4 3.6l-.7.7M16.3 7.7l-.7.7" />
        </g>
      )
    case 'smoke':
      // Облачко дыма
      return (
        <path d="M16.6 9a1.7 1.7 0 0 1 .2-3.4 2.4 2.4 0 0 1 4.5.4 1.6 1.6 0 0 1-.2 3z" />
      )
    default:
      // Фугас: разрыв — звёздочка
      return <path d="m19 2.6.8 2.2 2.2.8-2.2.8L19 8.6l-.8-2.2-2.2-.8 2.2-.8z" />
  }
}

interface Props {
  category: ArtilleryCategory
  type: string
  size?: 'xs' | 'sm'
}

/** Значок снаряда: форма по классу орудия, вид (HE / осветительный / дымовой) — в углу. */
export function ShellIcon({ category, type, size = 'xs' }: Props) {
  const kind = shellKind(type)

  return (
    <span
      title={t(kindNames[kind])}
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
