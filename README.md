# Multipurpose Artillery Calculator

A firing calculator for **Arma 3 with ACE3** mortars and artillery. Pick a
weapon, enter the distance and heights, and get the charge, elevation,
azimuth and time of flight from the in-game ACE range tables, with weather
corrections and fire adjustment.

> Калькулятор стрельбы для миномётов и артиллерии **Arma 3 + ACE3**.
> Выберите орудие, введите дистанцию и высоты — получите заряд, возвышение,
> азимут и время полёта по таблицам ACE из игры, с погодными поправками
> и корректировкой огня. Интерфейс на русском и английском.

**Status:** alpha (v0.10). Made by Heis.

## Features

- **Supported weapons:** Mk6 (82 mm, vanilla), M252 (81 mm, RHSUSAF),
  M29 (81 mm), M2 (60 mm) and M101 (105 mm) from S.O.G. Prairie Fire,
  Seara / M5 Sandstorm MLRS (227 mm, vanilla)
- **HIGH and LOW** (high- and low-angle) tables where the game has both
- **Firing solution for every charge**, with interpolation between table rows
- **Height difference correction** (the ACE "D ELEV per 100 m" rule)
- **Weather corrections** for ACE advanced corrections: wind (speed and
  direction, or head/cross from the Kestrel 4500), air temperature, and air
  pressure converted to air density
- **Azimuth** in mils or degrees, with crosswind deflection
- **Fire adjustment** from observer reports ("over 50, left 20"), accumulated
  round after round
- **Fire → impact timer** with a "splash" beep 5 s before impact
- **Shot journal** grouped by day: save, load, rename, delete
- **In-game table viewer** with the rows used for the current solution highlighted
- **Observer adjustment**: reports along the observer–target line are
  rotated into the gun frame; history with undo
- **Target bar**: switch between saved targets in one click, update a target
  after adjusting fire
- **Charge preference**: lowest, fastest or most precise ("1 mil ≈ X m"),
  with a warning at the edge of a charge table
- **Keyboard shortcuts** (press `?` in the app), work in any layout
- **Journal search, export and import** to move targets between devices
- **Installable app (PWA)** that works offline, **combat screen** with large
  numbers and a keep-screen-on option for a phone next to the keyboard
- Light and dark theme, desktop and mobile layout
- Experimental: distance and azimuth from grid references (Settings)

## Quick start

Requires [Node.js](https://nodejs.org/) 22 or newer.

```bash
cd web
npm install
npm run dev
```

Then open http://localhost:5173.

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Type check and production build into `web/dist` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest) |
| `npm run tables:import` | Rebuild table JSON from `web/data-sources` |
| `npm run tables:check` | Check that table JSON matches `web/data-sources` |
| `node scripts/make-icons.mjs` | Regenerate the app icons in `web/public` |

## Deployment

`.github/workflows/deploy-pages.yml` builds the app and publishes it to
GitHub Pages on every push to `main`. Enable it once in the repository:
**Settings → Pages → Source: GitHub Actions**. The build uses relative paths,
so it works under `https://<user>.github.io/<repo>/`.

## How the tables work

Range tables are transcribed from in-game screenshots of the ACE artillery
table menu into plain text files, one file per mode and charge:

```
web/data-sources/<model>/HIGH-<charge>.txt   →   web/src/data/artillery/<model>.json
```

The text format, column order and rules (a dash `-` means "no value", values
are never invented) are described in
[web/data-sources/README.md](web/data-sources/README.md).

### Adding a weapon

1. Take screenshots of every charge of the ACE table in game.
2. Create `web/data-sources/<id>/HIGH-<charge>.txt` files from them.
3. Create `web/src/data/artillery/<id>.json` with the model metadata and
   ammunition (copy an existing one), then run `npm run tables:import`.
4. Register it in `web/src/data/artillery/catalog.ts`,
   `web/src/data/artillery/registry.ts` and `web/src/data/models.ts`.
5. Run `npm test`. The tests check every bundled table for typos, such as
   elevation that does not fall with range or weather values with the wrong sign.
6. Verify a few shots in game.

## Project layout

```
web/
  data-sources/        text copies of the in-game tables
  scripts/             table import script
  src/
    lib/               calculations: ballistics, grid, journal, input
    data/              models and table JSON
    components/        UI components
    pages/             Dashboard, Models, Settings
    i18n/              Russian and English strings
```

## Roadmap

See [ROADMAP.md](ROADMAP.md) (in Russian): in-game verification, phone app
(PWA), more RHS / Vanilla / TBD Mortars weapons, a desktop overlay with
hotkeys, and maps with automatic heights.

## License

[MIT](LICENSE)
