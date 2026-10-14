# Multipurpose Artillery Calculator

[![License](https://img.shields.io/github/license/spanoproandrei2245-bit/multipurpose-artillery-calculator?style=for-the-badge)](./LICENSE)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Rust](https://img.shields.io/badge/rust-%23000000.svg?style=for-the-badge&logo=rust&logoColor=white)
![Tauri](https://img.shields.io/badge/tauri-%2324C8DB.svg?style=for-the-badge&logo=tauri&logoColor=%23FFFFFF)
![Arma 3](https://img.shields.io/badge/Arma_3-ACE3-6b7b4b?style=for-the-badge)

Calculator for elevation, azimuth and charge (and more) for mortars and artillery in [Arma 3](https://arma3.com) with [ACE3](https://ace3.acemod.org).

Калькулятор стрельбы для Arma 3 + ACE3, на русском и английском.

| Branch    | multipurpose-artillery-calculator                                                                                                                  |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`    | [spanoproandrei2245-bit.github.io/multipurpose-artillery-calculator](https://spanoproandrei2245-bit.github.io/multipurpose-artillery-calculator/) |
| `develop` | in development                                                                                                                                     |

Weapons: Mk6, M252, M29, M2, M101, M5 Sandstorm (Seara). Works in the browser, installs on a phone and runs as a Windows app with an overlay on top of the game.

## Download

The Windows installer is on the [Releases](../../releases) page. To get it on a phone, open the website and pick "Add to Home screen" in the browser menu.

## Development

```bash
cd web
npm install
npm run dev
```

`npm test` runs the tests, `npm run build` builds the site, `npm run desktop:build` builds the Windows app (needs [Rust](https://rustup.rs) and Visual Studio C++ Build Tools).

## Adding a weapon

Range tables are copied by hand from screenshots of the ACE tables in game into `web/data-sources/<weapon>/`, then `npm run tables:import` turns them into JSON. The file format is in [web/data-sources/README.md](web/data-sources/README.md).

## License

[MIT](LICENSE) · made by Heis
