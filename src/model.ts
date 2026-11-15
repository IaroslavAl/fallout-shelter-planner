import rawCatalog from './catalog.json' with { type: 'json' }

export const COLS = 26
export const FLOORS = 25
export const RULES = 'ps5-normal-1'
export const resources = ['power', 'food', 'water', 'stim', 'rad'] as const
export type Resource = typeof resources[number]
export type Essential = 'power' | 'food' | 'water'
export type Group = 'utility' | 'housing' | 'power' | 'food' | 'water' | 'storage' | 'medicine' | 'craft' | 'training' | 'nuka'
export type Language = 'en' | 'ru'
type Values = Partial<Record<Resource, number>>
type Totals = Record<Resource, number>

export interface Variant {
  sections: number
  level: number
  workers: number
  housing: number
  items: number
  capacity: Values
  batch: Values
  rate: Values
  draw: number
  upgrade: number | null
  refund: number
  refundEstimated: boolean
}

interface RoomType {
  id: string
  en: string
  ru: string
  group: Group
  stat: string
  unlock: number
  base: number
  increment: number
  widths: number[]
  maximum: number
  variants: Variant[]
  upgradeUnlocks: number[]
  source: string
}

export const catalog = rawCatalog as RoomType[]
export const byType = Object.fromEntries(catalog.map(type => [type.id, type])) as Record<string, RoomType>
export interface Point { row: number; col: number }
export interface Room extends Point {
  id: number
  type: string
  sections: number
  level: number
  workers: number
  locked?: boolean
}
export interface Cost { kind: 'build' | 'upgrade' | 'demolish' | 'rock'; type?: string; amount: number; estimated?: boolean }
export interface Vault {
  rooms: Room[]
  rocks: Point[]
  excavated: Point[]
  population: number
  outside: number
  special: number
  happiness: number
  robots: number
  handyFloors: number[]
  delay: number
  minutes: number
  offline: number[]
  stock: Partial<Record<Essential, number>>
  red: Partial<Record<Essential, number>>
  inventory: number
  remodel: boolean
  costs: Cost[]
}

export const variant = (room: Pick<Room, 'type' | 'sections' | 'level'>): Variant =>
  byType[room.type]!.variants.find(v => v.sections === room.sections && v.level === room.level)!
export const width = (room: Pick<Room, 'type' | 'sections'>) => room.type === 'Elevator' ? 1 : room.sections * 3
export const cellKey = ({row, col}: Point) => row * COLS + col
export const rockPrice = (row: number) => 50 + row * 25
export const overlaps = (a: Room, b: Room) => a.row === b.row && a.col < b.col + width(b) && b.col < a.col + width(a)
export const contains = (room: Room, p: Point) => room.row === p.row && room.col <= p.col && p.col < room.col + width(room)
export const buildable = ({row, col}: Point) => row >= 0 && row < FLOORS && col >= (row === 0 ? 9 : 0) && col < COLS
export const housingCapacity = (rooms: Room[]) => rooms.reduce((sum, r) => sum + variant(r).housing, 0)
export const itemCapacity = (rooms: Room[]) => rooms.reduce((sum, r) => sum + variant(r).items, 10)
export const nextId = (rooms: Room[]) => Math.max(0, ...rooms.map(r => r.id)) + 1

export function connected(rooms: Room[]): Set<number> {
  const start = rooms.find(r => r.type === 'Entrance')
  const visited = new Set<number>()
  if (!start) return visited
  const cells = new Map<number, Room>()
  for (const room of rooms) {
    for (let offset = 0; offset < width(room); offset++) cells.set(cellKey(room) + offset, room)
  }
  const queue = [start]
  visited.add(start.id)
  for (const room of queue) {
    const key = cellKey(room)
    const neighbors = [room.col > 0 ? cells.get(key - 1) : undefined,
      room.col + width(room) < COLS ? cells.get(key + width(room)) : undefined]
    if (room.type === 'Elevator') {
      for (const step of [-COLS,COLS]) {
        const lift = cells.get(key + step)
        if (lift?.type === 'Elevator') neighbors.push(lift)
      }
    }
    for (const candidate of neighbors) {
      if (candidate && !visited.has(candidate.id)) {
        visited.add(candidate.id)
        queue.push(candidate)
      }
    }
  }
  return visited
}

export function canPlace(room: Room, list: Room[]) {
  return buildable(room) && buildable({row: room.row, col: room.col + width(room) - 1}) &&
    !list.some(other => other.id !== room.id && overlaps(room, other)) &&
    (room.type !== 'Overseer' || !list.some(other => other.id !== room.id && other.type === 'Overseer'))
}

export function mergeCandidates(room: Room, list: Room[]) {
  const type = byType[room.type]
  if (type.widths.length === 1) return []
  const group: Room[] = []
  let remaining = 3 - room.sections
  const same = list.filter(r => r.id !== room.id && r.type === room.type && r.level === room.level)
  for (const side of [-1, 1]) {
    let edge = room
    while (remaining > 0) {
      const next = same.find(r => side === -1 ? r.row === edge.row && r.col + width(r) === edge.col : r.row === edge.row && edge.col + width(edge) === r.col)
      if (!next || next.sections > remaining) break
      group.push(next)
      remaining -= next.sections
      edge = next
    }
  }
  return group
}

export type Failure = 'placement' | 'locked' | 'housing' | 'housingLimit' | 'disconnected' | 'mergeConflict' | 'inventory' | 'unlock'
export type EditResult = { vault: Vault; id?: number; warning?: Failure } | { error: Failure }

function topologyError(vault: Vault, rooms: Room[], removal = false): Failure | undefined {
  const housing = housingCapacity(rooms)
  if (housing > 200) return 'housingLimit'
  if (removal && housing < vault.population && housing < housingCapacity(vault.rooms)) return 'housing'
  if (removal && itemCapacity(rooms) < vault.inventory && itemCapacity(rooms) < itemCapacity(vault.rooms)) return 'inventory'
  if (vault.remodel && connected(rooms).size < rooms.length) return 'disconnected'
}

function countedUnits(type: RoomType, sections: number) {
  return type.widths.length === 1 ? 1 : sections
}
function buildCost(room: Room, existing: Room[]): Cost[] {
  const type = byType[room.type]
  const previous = existing.filter(r => r.type === room.type).reduce((sum, r) => sum + countedUnits(type, r.sections), 0)
  const units = countedUnits(type, room.sections)
  const buy = units * type.base + (previous * units + units * (units - 1) / 2) * type.increment
  const costs: Cost[] = [{ kind: 'build', type: room.type, amount: buy }]
  for (let level = 1; level < room.level; level++) {
    const amount = variant({...room, level}).upgrade
    if (amount) costs.push({kind: 'upgrade', type: room.type, amount})
  }
  return costs
}

export function newBuildCost(rooms: Room[], rocks = 0) {
  const starter = rooms.filter(r => r.type === 'Elevator' && r.col === 9 && r.row < 3)
  const accounted: Room[] = [...starter]
  let total = rocks
  for (const room of [...rooms].sort((a, b) => a.row - b.row || a.col - b.col)) {
    if (starter.includes(room)) continue
    if (room.type === 'Entrance') {
      for (let level = 1; level < room.level; level++) total += variant({...room, level}).upgrade ?? 0
    } else {
      total += buildCost(room, accounted).reduce((sum, item) => sum + item.amount, 0)
    }
    accounted.push(room)
  }
  return total
}

export function editRoom(vault: Vault, candidate: Room): EditResult {
  const previous = vault.rooms.find(r => r.id === candidate.id)
  const relocating = !!previous && (candidate.row !== previous.row || candidate.col !== previous.col)
  const resizing = !!previous && candidate.sections !== previous.sections
  const replacing = relocating || resizing
  const plan = vault.rooms.filter(r => r.id !== candidate.id)
  if (previous && previous.type !== candidate.type) return {error: 'placement'}
  if ((replacing && (previous?.locked || candidate.type === 'Entrance')) ||
      (previous?.locked && candidate.level !== previous.level)) return {error: 'locked'}
  if (!byType[candidate.type]?.variants.some(v => v.level === candidate.level && v.sections === candidate.sections)) return {error: 'placement'}
  if (candidate.type !== 'Entrance' && !canPlace(candidate, plan)) return {error: 'placement'}
  if (candidate.type === 'Entrance' && !previous) return {error: 'placement'}
  if (previous && candidate.level < previous.level && !replacing) return {error: 'locked'}
  const type = byType[candidate.type]
  if (vault.remodel && candidate.level > (previous && !replacing ? previous.level : 1) &&
      (type.upgradeUnlocks[candidate.level - 2] ?? 0) > vault.population) return {error: 'unlock'}
  if (previous && replacing && vault.remodel) {
    const error = topologyError(vault, plan, true)
    if (error) return {error}
  }
  const adjacent = mergeCandidates(candidate, plan)
  const combined = candidate.sections + adjacent.reduce((sum, r) => sum + r.sections, 0)
  const buildChanged = !previous || replacing || candidate.level !== previous.level
  const canMerge = buildChanged && adjacent.length > 0 && combined <= 3 && adjacent.every(r => !r.locked)
  let room = {...candidate}
  let others = plan
  if (canMerge) {
    room = {...room, sections: combined, col: Math.min(room.col, ...adjacent.map(r => r.col)), workers: room.workers + adjacent.reduce((n, r) => n + r.workers, 0)}
    others = plan.filter(r => !adjacent.some(a => a.id === r.id))
  }
  room.workers = Math.min(room.workers, variant(room).workers)
  const rooms = [...others, room]
  const error = topologyError(vault, rooms, !!previous && resizing && candidate.sections < previous.sections)
  if (error) return {error}
  if (vault.remodel && buildChanged && adjacent.length && !canMerge && combined <= 3) return {error: 'mergeConflict'}
  const captured = vault.rocks.filter(rock => room.row === rock.row && room.col < rock.col + 3 && rock.col < room.col + width(room))
  const costs = captured.map(({row}): Cost => ({kind: 'rock', amount: rockPrice(row), estimated: true}))
  if (!previous || replacing) {
    if (previous) costs.push(demolition(previous))
    costs.push(...buildCost(candidate, plan))
  } else {
    for (let level = previous.level; level < candidate.level; level++) {
      const amount = variant({...candidate, level}).upgrade
      if (amount) costs.push({kind: 'upgrade', type: candidate.type, amount})
    }
  }
  const replacedIds = new Set(adjacent.filter(() => canMerge).map(r => r.id))
  const offline = vault.offline.filter(id => !replacedIds.has(id))
  if (vault.offline.some(id => replacedIds.has(id)) && !offline.includes(room.id)) offline.push(room.id)
  return {id: room.id, warning: buildChanged && adjacent.length && !canMerge ? 'mergeConflict' : undefined,
    vault: {...vault, rooms, rocks: vault.rocks.filter(rock => !captured.includes(rock)), excavated: [...vault.excavated,...captured], offline,
      costs: vault.remodel ? [...vault.costs, ...costs] : vault.costs}}
}

function demolition(room: Room): Cost {
  const stats = variant(room)
  return {kind:'demolish', type:room.type, amount:-stats.refund, estimated:stats.refundEstimated}
}
export function removeRoom(vault: Vault, id: number): EditResult {
  const room = vault.rooms.find(r => r.id === id)
  if (!room || room.type === 'Entrance' || room.locked) return {error: 'locked'}
  const rooms = vault.rooms.filter(r => r.id !== id)
  const error = topologyError(vault, rooms, true)
  if (error) return {error}
  return {vault: {...vault, rooms, offline: vault.offline.filter(key => key !== id), costs: vault.remodel ? [...vault.costs, demolition(room)] : vault.costs}}
}

export function startRemodel(vault: Vault): EditResult {
  if (connected(vault.rooms).size < vault.rooms.length) return {error:'disconnected'}
  if (housingCapacity(vault.rooms) < vault.population) return {error:'housing'}
  if (itemCapacity(vault.rooms) < vault.inventory) return {error:'inventory'}
  return {vault:{...vault,remodel:true,costs:[]}}
}

export function toggleRock(vault: Vault, location: Point): EditResult {
  const rock = vault.rocks.find(r => r.row === location.row && r.col <= location.col && location.col < r.col + 3)
  if (rock) return {vault: {...vault, rocks:vault.rocks.filter(r => r !== rock), excavated:[...vault.excavated,rock],
    costs:vault.remodel ? [...vault.costs, {kind:'rock', amount:rockPrice(rock.row), estimated:true}] : vault.costs}}
  const cells = Array.from({length:3}, (_, i) => ({row:location.row, col:location.col+i}))
  const restored = vault.excavated.find(r=>r.row===location.row && r.col===location.col)
  const obstacles = [...vault.rocks,...vault.excavated.filter(r=>r!==restored)]
  if (vault.remodel || cells.some(p => !buildable(p) || vault.rooms.some(r => contains(r,p)) || obstacles.some(r => r.row===p.row && r.col<=p.col && p.col<r.col+3))) return {error:'placement'}
  return {vault: {...vault, rocks:[...vault.rocks, location], excavated:vault.excavated.filter(r=>r!==restored)}}
}

const zeros = (): Totals => ({power:0, food:0, water:0, stim:0, rad:0})
export function roomRate(vault: Vault, room: Room) {
  const data = variant(room)
  const efficiency = data.workers > 0 ? room.workers * vault.special / (data.workers * 10) : 0
  const happinessBonus = Math.floor(vault.happiness / 10) / 100
  const nominal = zeros()
  const collected = zeros()
  for (const key of resources) {
    const rate = (data.rate[key] ?? 0) * efficiency * (1 + happinessBonus)
    const batch = data.batch[key] ?? 0
    nominal[key] = rate
    collected[key] = rate > 0 && batch && vault.handyFloors.includes(room.row)
      ? batch / (batch / rate + vault.delay / 60) : rate
  }
  return {nominal, collected}
}

export function summarize(vault: Vault) {
  const available = connected(vault.rooms)
  const capacity = {...zeros(), stim:5, rad:5}
  const nominal = zeros()
  const output = zeros()
  const automated = zeros()
  const interrupted = zeros()
  const inside = vault.population - vault.outside
  const consumed = {power:0, food:inside * .36, water:inside * .36}
  const training: Record<string, number> = {}
  let assigned = 0
  let jobs = 0
  const productionFloors = new Set<number>()
  for (const room of vault.rooms) {
    if (!available.has(room.id)) continue
    const data = variant(room)
    const type = byType[room.type]
    const {nominal:rate,collected} = roomRate(vault, room)
    consumed.power += data.draw
    assigned += room.workers
    jobs += data.workers
    if (type.group === 'training') training[type.stat] = (training[type.stat] ?? 0) + data.workers
    if (resources.some(key => rate[key] > 0)) productionFloors.add(room.row)
    const handy = vault.handyFloors.includes(room.row)
    const stopped = vault.offline.includes(room.id)
    for (const key of resources) {
      capacity[key] += data.capacity[key] ?? 0
      nominal[key] += rate[key]
      output[key] += collected[key]
      if (handy) automated[key] += collected[key]
      if (!stopped) interrupted[key] += collected[key]
    }
  }
  return {available, capacity, nominal, output, automated, interrupted, consumed, training, assigned, jobs, inside, productionFloors,
    housing: housingCapacity(vault.rooms.filter(r => available.has(r.id))),
    items: itemCapacity(vault.rooms.filter(r => available.has(r.id)))}
}

export function outage(vault: Vault, stats = summarize(vault)) {
  return (['power','food','water'] as const).map(key => {
    const starting = Math.min(vault.stock[key] ?? stats.capacity[key], stats.capacity[key])
    const cutoff = vault.red[key] ?? (key === 'power' ? stats.consumed.power * 13.5 : stats.inside)
    const balance = stats.interrupted[key] - stats.consumed[key]
    const untilRed = starting < cutoff ? 0 : balance < 0 ? (starting - cutoff) / -balance : null
    const after = Math.max(0, Math.min(stats.capacity[key], starting + balance * vault.minutes))
    return {key, starting, cutoff, balance, untilRed, after}
  })
}

export interface Raid { steps: Room[]; partial: boolean }
export function raidRoute(rooms: Room[]): Raid {
  const entrance = rooms.find(r => r.type === 'Entrance')
  if (!entrance) return {steps:[], partial:true}
  const live = connected(rooms)
  const steps: Room[] = [entrance]
  let current = entrance
  let direction = 1
  const descent = (lift: Room) => rooms.find(r => r.type === 'Elevator' && r.row === lift.row + 1 && r.col === lift.col && live.has(r.id))
  for (let row = 0; row < FLOORS; row++) {
    const line = rooms.filter(r => r.row === current.row && live.has(r.id)).sort((a,b) => a.col - b.col)
    const run = [current]
    const ahead = (r: Room, d: number) => line.find(candidate => d > 0 ? candidate.col === r.col + width(r) : candidate.col + width(candidate) === r.col)
    for (let next = ahead(current, direction); next; next = ahead(next, direction)) run.push(next)
    steps.push(...run.slice(1))
    const shafts = run.filter(r => r.type === 'Elevator' && descent(r))
    const far = run.at(-1)!
    if (shafts.length > 2 || (shafts.length === 2 && shafts.at(-1) !== far)) return {steps, partial:true}
    const exit = shafts.at(-1)
    if (!exit) return {steps, partial:rooms.some(r => r.row > current.row && live.has(r.id)) || (current !== entrance && !!ahead(current,-direction))}
    const down = descent(exit)!
    // Standard edge shafts are observed. Stop at a descent into the middle of a row.
    steps.push(...run.slice(run.indexOf(exit), -1).reverse(), down)
    const left = rooms.some(r => r.row === down.row && r.col + width(r) === down.col)
    const right = rooms.some(r => r.row === down.row && r.col === down.col + width(down))
    if (left && right) return {steps, partial:true}
    direction = left ? -1 : 1
    current = down
  }
  return {steps, partial:false}
}

export function example(which: 'starter' | 'large' | 'blank'): Vault {
  const rooms: Room[] = []
  const put = (type: string, row: number, col: number, sections = 1, level = 1, workers = 0) =>
    rooms.push({id:rooms.length+1,type,row,col,sections,level,workers})
  put('Entrance',0,3,2)
  for (let row=0; row<3; row++) put('Elevator',row,9)
  let population = 0
  if (which === 'starter') {
    put('LivingQuarters',0,10,2,2)
    put('MedBay',0,16,2,1,2)
    put('ScienceLab',0,22,1,1,1)
    put('Geothermal',1,0,3,2,6)
    put('Cafeteria',1,10,3,2,6)
    put('WaterPlant',1,19,2,2,4)
    put('Storage',2,3,2,1)
    put('Overseer',2,10,2)
    put('Gym',2,16,2,1,3)
    population = 22
  }
  if (which === 'large') {
    for (let row=0; row<12; row++) {
      if (row>=3) put('Elevator',row,9)
      if (row<5) put('Elevator',row,25)
      if (row>0 && row<5) put(row <= 3 ? 'Energy2' : 'NukaCola',row,0,3,3,6)
    }
    put('Energy2',0,10,3,3,6)
    put('Radio',0,19,2,3,4)
    put('NukaCola',1,10,3,3,6)
    put('MedBay',1,19,2,3,4)
    put('NukaCola',2,10,3,3,6)
    put('ScienceLab',2,19,2,3,4)
    put('WeaponFactory',3,10,3,3,6)
    put('Overseer',3,19,2,3)
    put('OutfitFactory',4,10,3,3,6)
    put('Storage',4,19,2,3)
    const trainers = ['Gym','Dojo','Armory','Classroom','SuperRoom2','Bar','Casino']
    for (let row=5; row<12; row++) {
      put(row<10 ? 'LivingQuarters' : 'Storage',row,0,3,3)
      put(trainers[row-5],row,10,3,3,6)
      put(row%2===0 ? 'MedBay' : 'ScienceLab',row,19,2,2,4)
    }
    population=200
  }
  return {rooms, rocks:[], excavated:[], population, outside:0, special:10, happiness:90,
    robots:which==='large' ? 5 : which==='starter' ? 2 : 0,
    handyFloors:which==='large' ? [0,1,2,3,4] : which==='starter' ? [0,1] : [],
    delay:5, minutes:2, offline:[], stock:{}, red:{}, inventory:0, remodel:false, costs:[]}
}
