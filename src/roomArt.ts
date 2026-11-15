import type { CSSProperties } from 'react'
import type { Room } from './model'

type Sheet = 'interiors-a' | 'interiors-b' | 'wide-interiors'

interface Tile {
  sheet: Sheet
  col: number
  row: number
}

export type View = 'illustrated' | 'schematic'

const columns: Record<Sheet, number> = {
  'interiors-a': 4,
  'interiors-b': 4,
  'wide-interiors': 2,
}
const rows = 4
const assetUrl = (sheet: Sheet) => import.meta.env.BASE_URL + 'vault-art/' + sheet + '.webp'

function roomSheet(sheet: Sheet, types: string[]) {
  return Object.fromEntries(types.map((type, index) => [
    type, { sheet, col: index % columns[sheet], row: Math.floor(index / columns[sheet]) },
  ])) as Record<string, Tile>
}

const regular = {
  ...roomSheet('interiors-a', [
    'Entrance', 'Elevator', 'LivingQuarters', 'Geothermal',
    'Cafeteria', 'WaterPlant', 'Storage', 'MedBay',
    'ScienceLab', 'Overseer', 'Radio', 'WeaponFactory',
    'Gym', 'Dojo', 'Armory', 'Classroom',
  ]),
  ...roomSheet('interiors-b', [
    'OutfitFactory', 'SuperRoom2', 'Bar', 'DesignFactory',
    'Casino', 'BarberShop', 'Energy2', 'Hydroponic',
    'Water2', 'NukaCola',
  ]),
}
const wide = roomSheet('wide-interiors', [
  'Geothermal', 'Energy2', 'WaterPlant', 'Cafeteria',
  'NukaCola', 'LivingQuarters', 'MedBay', 'ScienceLab',
])
const fixedRooms = new Set(['Entrance', 'Elevator', 'Overseer', 'BarberShop'])

export const bedrock: Tile = { sheet: 'interiors-b', col: 3, row: 3 }
export const stones: Tile = { sheet: 'interiors-b', col: 3, row: 2 }
export const surface: Tile = { sheet: 'interiors-b', col: 0, row: 3 }

export const thumbnail = (type: string) => regular[type]

export function roomTiles(room: Pick<Room, 'type' | 'sections'>): Tile[] {
  const tile = regular[room.type]
  if (!tile) return []
  if (room.sections === 3 && wide[room.type]) return [wide[room.type]]
  return Array.from({length: fixedRooms.has(room.type) ? 1 : room.sections}, () => tile)
}

export function tileStyle(tile: Tile): CSSProperties {
  const width = columns[tile.sheet]
  return {
    backgroundImage: 'url(' + assetUrl(tile.sheet) + ')',
    backgroundSize: (width * 100) + '% ' + (rows * 100) + '%',
    backgroundPosition: (tile.col * 100 / (width - 1)) + '% ' + (tile.row * 100 / (rows - 1)) + '%',
  }
}

export async function loadArt(tiles: Tile[]) {
  const sheets = new Set(tiles.map(tile => tile.sheet))
  const assets = new Map<Sheet, HTMLImageElement>()
  await Promise.all([...sheets].map(async sheet => {
    const image = new Image()
    image.src = assetUrl(sheet)
    try {
      await image.decode()
      assets.set(sheet, image)
    } catch { /* Keep the schematic fill if a sheet is unavailable. */ }
  }))
  return assets
}

export function paintTiles(
  canvas: CanvasRenderingContext2D,
  assets: Awaited<ReturnType<typeof loadArt>>,
  tiles: Tile[],
  x: number, y: number, width: number, height: number,
) {
  let drawn = false
  const pane = width / tiles.length
  for (const [index, tile] of tiles.entries()) {
    const image = assets.get(tile.sheet)
    if (!image) continue
    const tileWidth = image.naturalWidth / columns[tile.sheet]
    const tileHeight = image.naturalHeight / rows
    canvas.drawImage(image, tile.col * tileWidth, tile.row * tileHeight, tileWidth, tileHeight,
      x + index * pane, y, pane, height)
    drawn = true
  }
  return drawn
}
