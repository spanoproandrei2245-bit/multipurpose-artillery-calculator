#!/usr/bin/env node
/**
 * Сборка программы для ПК без встроенных карт: тайлы весят десятки
 * мегабайт, а программа берёт их с опубликованного сайта
 * (src/lib/builtinMaps.ts, MAPS_BASE).
 */
import { rmSync } from 'node:fs'

rmSync(new URL('../dist/maps/', import.meta.url), { recursive: true, force: true })
console.log('dist/maps removed for the desktop bundle')
