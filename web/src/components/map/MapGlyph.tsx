import { FieldIcon } from '../FieldIcon'

/** Значок карты слева от названия в списке карт. */
export function MapGlyph({ big = false }: { big?: boolean }) {
  return (
    <span
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-md bg-app-raised-hover text-app-text',
        big ? 'h-9 w-9' : 'h-7 w-7',
      ].join(' ')}
    >
      <FieldIcon name="map" className={big ? 'h-[18px] w-[18px]' : 'h-4 w-4'} />
    </span>
  )
}
