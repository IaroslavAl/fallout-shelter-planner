import { loadArt, paintTiles, roomTiles, stones, type View } from './roomArt'
import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate'
import { byType, buildable, canPlace, contains, FLOORS, RULES, variant, width, type Vault } from './model'

const LIMIT = 180_000
const MAX_LINK = 8_000
const prefix = '#plan='
const encoderVersion = 1

type Obj = Record<string, unknown>
const object = (value: unknown): value is Obj => !!value && typeof value === 'object' && !Array.isArray(value)
const integer = (value: unknown, max: number, min = 0): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
const amount = (value: unknown, max = 1_000_000) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max
const unique = (values: unknown[]) => new Set(values).size === values.length
const essential = new Set(['power','food','water'])

function valid(v: unknown): v is Vault {
  if (!object(v) || !Array.isArray(v.rooms) || v.rooms.length > 650 ||
      !Array.isArray(v.rocks) || !Array.isArray(v.excavated) || v.rocks.length+v.excavated.length > 217 ||
      !Array.isArray(v.costs) || v.costs.length > 3000 ||
      !integer(v.population, 200) || !integer(v.outside, v.population) ||
      !integer(v.special, 17, 1) || !integer(v.happiness, 100) ||
      !integer(v.robots, FLOORS) || !integer(v.delay, 300) || !amount(v.minutes, 180) ||
      !integer(v.inventory, 100_000) || typeof v.remodel !== 'boolean') return false

  for (const name of ['stock','red']) {
    const values = v[name]
    if (!object(values) || !Object.entries(values).every(([key, value]) => essential.has(key) && amount(value))) return false
  }

  const ids = new Set<number>()
  let entrance = 0
  for (const room of v.rooms) {
    if (!object(room) || typeof room.type !== 'string' || !Object.hasOwn(byType,room.type) ||
        !integer(room.id, 1_000_000, 1) || ids.has(room.id) || !integer(room.row,FLOORS-1) || !integer(room.col,25) ||
        !integer(room.level,3,1) || !integer(room.sections,3,1) ||
        (room.locked !== undefined && typeof room.locked !== 'boolean')) return false
    if (!byType[room.type].variants.some(x => x.sections === room.sections && x.level === room.level)) return false
    const candidate = room as unknown as Vault['rooms'][number]
    if (!integer(room.workers, variant(candidate).workers)) return false
    if (room.type === 'Entrance') {
      entrance++
      if (entrance > 1 || room.row !== 0 || room.col !== 3) return false
    } else if (!canPlace(candidate,v.rooms)) return false
    ids.add(room.id)
  }
  if (entrance !== 1) return false

  const occupiedRock = new Set<number>()
  for (const [rock, cleared] of [...v.rocks.map(rock=>[rock,false]),...v.excavated.map(rock=>[rock,true])]) {
    if (!object(rock) || !integer(rock.row,FLOORS-1) || !integer(rock.col,23)) return false
    for (let offset=0; offset<3; offset++) {
      const cell = {row:rock.row,col:rock.col+offset}
      const key = cell.row*26+cell.col
      if (!buildable(cell) || occupiedRock.has(key) || (!cleared && v.rooms.some(r => contains(r,cell)))) return false
      occupiedRock.add(key)
    }
  }
  return Array.isArray(v.handyFloors) && v.handyFloors.length <= v.robots &&
    unique(v.handyFloors) && v.handyFloors.every(f => integer(f,FLOORS-1)) &&
    Array.isArray(v.offline) && unique(v.offline) && v.offline.every(id => typeof id === 'number' && ids.has(id)) &&
    v.costs.every(entry => object(entry) && ['build','upgrade','demolish','rock'].includes(String(entry.kind)) &&
      typeof entry.amount === 'number' && Math.abs(entry.amount) <= 10_000_000 && Number.isInteger(entry.amount) &&
      (entry.type === undefined || typeof entry.type === 'string' && Object.hasOwn(byType,entry.type)) &&
      (entry.estimated === undefined || typeof entry.estimated === 'boolean'))
}

export const hasPlan = (hash: string) => hash.startsWith(prefix)
export const planJSON = (vault: Vault) => JSON.stringify({v:encoderVersion,rules:RULES,vault})
export function readPlan(data: string): Vault {
  if (data.length > LIMIT) throw new Error('size')
  const snapshot: unknown = JSON.parse(data)
  if (!object(snapshot) || snapshot.v !== encoderVersion || snapshot.rules !== RULES || !valid(snapshot.vault)) throw new Error('format')
  return snapshot.vault
}

export function planFragment(vault: Vault) {
  const binary = Array.from(deflateSync(strToU8(planJSON(vault))), x => String.fromCharCode(x)).join('')
  const encoded = btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'')
  if (encoded.length > MAX_LINK) throw new Error('size')
  return prefix + encoded
}

export function parseFragment(hash: string) {
  const encoded = hash.slice(prefix.length)
  if (!hasPlan(hash) || encoded.length > MAX_LINK || !/^[A-Za-z0-9_-]+$/.test(encoded)) throw new Error('format')
  const compressed = Uint8Array.from(atob(encoded.replaceAll('-','+').replaceAll('_','/')), x => x.charCodeAt(0))
  return readPlan(strFromU8(inflateSync(compressed,{out:new Uint8Array(LIMIT+1)})))
}

export const colors = {
  utility:'#a1ab94', housing:'#e3a979', power:'#efcb74', food:'#b1cc80', water:'#83c7cf',
  storage:'#b9ab9b', medicine:'#de948f', craft:'#bd9de2', training:'#a2a8e0', nuka:'#e3aa81',
}
export const legendGroups = ['power','food','water','nuka','housing','medicine','training','craft','storage','utility'] as const
export const num = (value: number, locale: string, digits = 1) => new Intl.NumberFormat(locale,{maximumFractionDigits:digits}).format(value)

export function saveFile(data: Blob, name: string) {
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export async function exportPNG(vault: Vault, heading: string, metrics: string[], language: 'en'|'ru', legend: string[], view: View) {
  const illustrated = view === 'illustrated'
  const tiles = illustrated ? vault.rooms.flatMap(roomTiles) : []
  if (illustrated && vault.rocks.length) tiles.push(stones)
  const assets = await loadArt(tiles)
  const floors = Math.max(0,...vault.rooms.map(r=>r.row),...vault.rocks.map(r=>r.row))+1
  const pad = 40
  const top = 158
  const unit = 38
  const rowHeight = illustrated ? 84 : 62
  const canvas = document.createElement('canvas')
  canvas.width = 2*(26*unit+2*pad)
  canvas.height = 2*(top+rowHeight*floors+pad+66)
  const ctx = canvas.getContext('2d')!
  ctx.scale(2,2)
  ctx.fillStyle = '#171b18'
  ctx.fillRect(0,0,canvas.width/2,canvas.height/2)
  ctx.fillStyle = '#e9e7d7'
  ctx.font = 'bold 32px system-ui'
  ctx.fillText(heading,pad,51)
  ctx.fillStyle = '#b7c0a3'
  ctx.font = '15px system-ui'
  metrics.forEach((metric,i)=>ctx.fillText(metric, pad,84+i*25))
  ctx.font = '12px monospace'
  for (let row=0;row<floors;row++) {
    ctx.fillStyle = row%2 ? '#232823' : '#1d231e'
    ctx.fillRect(pad,top+row*rowHeight,unit*26,rowHeight-2)
    ctx.fillStyle = '#a1a891'
    ctx.fillText(String(row+1).padStart(2,'0'),13,top+row*rowHeight+33)
  }
  for (const rock of vault.rocks) {
    ctx.fillStyle='#64594a'
    const x = pad + rock.col * unit + 2
    const y = top + rock.row * rowHeight + 3
    ctx.fillRect(x,y,3*unit-4,rowHeight-8)
    if (illustrated) paintTiles(ctx,assets,[stones],x,y,3*unit-4,rowHeight-8)
  }
  for (const room of vault.rooms) {
    const type = byType[room.type]
    const roomWidth = width(room)*unit
    const x = pad + room.col * unit + 2
    const y = top + room.row * rowHeight + 3
    ctx.fillStyle = '#303930'
    ctx.fillRect(x,y,roomWidth-4,rowHeight-8)
    const art = illustrated && paintTiles(ctx, assets, roomTiles(room), x, y, roomWidth-4, rowHeight-8)
    if (art && room.type !== 'Elevator') {
      const shade = ctx.createLinearGradient(0,y+rowHeight-40,0,y+rowHeight-7)
      shade.addColorStop(0,'#0c0c0800')
      shade.addColorStop(1,'#0c0c08ec')
      ctx.fillStyle = shade
      ctx.fillRect(x,y+rowHeight-40,roomWidth-4,32)
    }
    ctx.strokeStyle = colors[type.group]
    ctx.strokeRect(x+.5,y+.5,roomWidth-5,rowHeight-9)
    ctx.fillStyle = art ? '#fff5dd' : colors[type.group]
    if (room.type === 'Elevator') {
      if (!art) {
        ctx.font = '15px monospace'
        ctx.fillText('↕',x+7,y+21,roomWidth-16)
      }
    } else {
      const titleY = art ? y+rowHeight-25 : y+21
      ctx.font = 'bold 14px system-ui'
      ctx.fillText(type[language],x+7,titleY,roomWidth-16)
      ctx.font = '11px monospace'
      ctx.fillText('L'+room.level+(variant(room).workers?'  ·  '+room.workers+'/'+variant(room).workers:''),x+7,titleY+13,roomWidth-16)
    }
  }
  ctx.font = '13px system-ui'
  legendGroups.forEach((group,i)=>{
    const x = pad + i%5 * (26*unit/5)
    const y = top + rowHeight*floors + 28 + Math.floor(i/5)*27
    ctx.fillStyle = colors[group]
    ctx.fillRect(x,y-10,10,10)
    ctx.fillStyle = '#e9e9db'
    ctx.fillText(legend[i],x+17,y,(26*unit/5)-22)
  })
  canvas.toBlob(blob => { if (blob) saveFile(blob,'fallout-shelter-plan.png') },'image/png')
}
