import { describe, expect, it } from 'vitest'
import { byType, canPlace, catalog, connected, editRoom, example, housingCapacity, newBuildCost, nextId, outage, raidRoute, removeRoom, roomRate, summarize, toggleRock, variant, type EditResult, type Room, type Vault } from '../src/model'
import { parseFragment, planFragment, planJSON, readPlan } from '../src/portable'

const getVault = (result: EditResult) => {
  if ('error' in result) throw new Error(result.error)
  return result.vault
}
const candidate = (vault: Vault, type: string, row: number, col: number, sections=1, level=1, workers=0):Room =>
  ({id:nextId(vault.rooms),type,row,col,sections,level,workers})

describe('PlayStation catalog and geometry',()=>{
  it('covers all console menu types, including the entrance and elevator',()=>{
    expect(catalog).toHaveLength(26)
    expect(new Set(catalog.map(room=>room.id)).size).toBe(26)
    for (const room of catalog) {
      expect(room.variants).toHaveLength(room.widths.length*room.maximum)
      for (const row of room.variants) {
        expect(row.level<room.maximum).toBe(row.upgrade!==null)
        expect(row.draw).toBeGreaterThanOrEqual(0)
      }
    }
    expect(byType.WeaponFactory.widths).toEqual([3])
    expect(byType.Elevator.variants[0].workers).toBe(0)
    expect(variant({type:'LivingQuarters',sections:3,level:3}).housing).toBe(40)
    expect(variant({type:'NukaCola',sections:3,level:3}).batch).toEqual({food:55,water:55})
    expect(variant({type:'Energy2',sections:3,level:3}).capacity.power).toBe(1200)
    expect(variant({type:'MedBay',sections:2,level:3}).capacity.stim).toBe(20)
  })

  it('blocks overlap and the blocked surface, and detects broken elevator access',()=>{
    const draft=example('blank')
    expect(canPlace(candidate(draft,'Cafeteria',0,8),draft.rooms)).toBe(false)
    expect(canPlace(candidate(draft,'Cafeteria',0,24),draft.rooms)).toBe(false)
    expect(canPlace(candidate(draft,'Cafeteria',0,9),draft.rooms)).toBe(false)
    const isolated=getVault(editRoom(draft,candidate(draft,'Cafeteria',3,10)))
    expect(connected(isolated.rooms).size).toBe(4)
    const joined=getVault(editRoom(isolated,candidate(isolated,'Elevator',3,9)))
    expect(connected(joined.rooms).size).toBe(joined.rooms.length)
    expect(removeRoom({...joined,remodel:true},3)).toEqual({error:'disconnected'})
  })

  it('merges matching sections, charges the repeat price, and charges upgrades for the resulting width',()=>{
    let vault={...example('blank'),remodel:true}
    vault=getVault(editRoom(vault,candidate(vault,'Geothermal',0,10)))
    vault=getVault(editRoom(vault,candidate(vault,'Geothermal',0,13)))
    const merged=vault.rooms.find(r=>r.type==='Geothermal')!
    expect(merged.sections).toBe(2)
    expect(vault.costs.map(c=>c.amount)).toEqual([100,125])
    const next=getVault(editRoom(vault,{...merged,level:2}))
    expect(next.costs.at(-1)?.amount).toBe(375)
    expect(newBuildCost(next.rooms)).toBe(600)
  })

  it('charges the fourth elevator at the fourth-elevator price in a full build',()=>{
    const start=example('blank')
    const next=getVault(editRoom(start,candidate(start,'Elevator',0,10)))
    expect(newBuildCost(next.rooms)).toBe(175)
  })

  it('preserves 200 housing slots and exact stage capacity',()=>{
    const filled={...example('large'),remodel:true}
    const housing=filled.rooms.find(r=>r.type==='LivingQuarters')!
    expect(housingCapacity(filled.rooms)).toBe(200)
    expect(removeRoom(filled,housing.id)).toEqual({error:'housing'})
    expect(editRoom(filled,{...housing,row:6,col:19})).toEqual({error:'placement'})
    expect(editRoom(filled,candidate(filled,'LivingQuarters',12,10))).toEqual({error:'housingLimit'})
    expect(removeRoom({...filled,rooms:filled.rooms.map(r=>r.id===housing.id?{...r,locked:true}:r)},housing.id)).toEqual({error:'locked'})
  })

  it('preserves storage and books demolition refunds for permissible edits',()=>{
    const vault={...example('starter'),remodel:true}
    const storage=vault.rooms.find(r=>r.type==='Storage')!
    expect(removeRoom({...vault,inventory:11},storage.id)).toEqual({error:'inventory'})
    const updated=getVault(removeRoom(vault,storage.id))
    expect(updated.costs.at(-1)).toMatchObject({kind:'demolish',amount:-60})
  })

  it('removes marked rock in a build and records depth-dependent clearing once',()=>{
    const blank=example('blank')
    const marked=getVault(toggleRock(blank,{row:2,col:10}))
    const built=getVault(editRoom({...marked,remodel:true},candidate(marked,'Cafeteria',2,10)))
    expect(built.rocks).toEqual([])
    expect(built.excavated).toEqual([{row:2,col:10}])
    expect(built.costs.map(c=>[c.kind,c.amount])).toEqual([['rock',100],['build',100]])
  })
})

describe('Production and outage',()=>{
  it('matches community test figures for a triple reactor and bottler at max staff and equipment',()=>{
    const vault={...example('large'),special:17,happiness:100,delay:0}
    const reactor=vault.rooms.find(r=>r.type==='Energy2')!
    const bottler=vault.rooms.find(r=>r.type==='NukaCola')!
    const batch=variant(bottler).batch.food!
    expect(roomRate(vault,bottler).nominal.food).toBeCloseTo(102.5,1)
    expect(batch/roomRate(vault,bottler).nominal.food*60).toBeCloseTo(32.2,1)
    expect(roomRate(vault,reactor).nominal.power).toBeCloseTo(117.25,1)
    expect(variant(reactor).batch.power).toBe(85)
    expect(summarize(vault).consumed.food).toBe(72)
    expect(summarize({...vault,outside:25}).consumed.water).toBe(63)
  })

  it('keeps nominal production while modeling delay and partial crews',()=>{
    const vault=example('large')
    const room=vault.rooms.find(r=>r.type==='NukaCola')!
    expect(roomRate(vault,{...room,workers:3}).nominal.food).toBeCloseTo(roomRate(vault,room).nominal.food/2)
    expect(roomRate(vault,room).collected.food).toBeLessThan(roomRate(vault,room).nominal.food)
    expect(roomRate({...vault,handyFloors:[]},room).collected.food).toBe(roomRate(vault,room).nominal.food)
  })

  it('predicts when a key bottler interruption reaches a measured red threshold',()=>{
    const vault=example('large')
    const bottlers=vault.rooms.filter(r=>r.type==='NukaCola')
    const stopped={...vault,offline:bottlers.map(r=>r.id),minutes:2,stock:{food:270},red:{food:200}}
    const food=outage(stopped).find(r=>r.key==='food')!
    expect(food.balance).toBe(-72)
    expect(food.after).toBe(126)
    expect(food.untilRed).toBeCloseTo(70/72)
    expect(outage(vault).find(r=>r.key==='food')?.untilRed).toBeNull()
  })
})

describe('Observed entry-floor patterns',()=>{
  it('uses the near shaft after backtracking through the previous room',()=>{
    const vault=example('blank')
    const roomA=candidate(vault,'Cafeteria',0,10,3)
    const roomB={...candidate(vault,'Radio',0,19,2),id:roomA.id+1}
    const raid=raidRoute([...vault.rooms,roomA,roomB])
    expect(raid.steps.slice(0,6).map(r=>r.type)).toEqual(['Entrance','Elevator','Cafeteria','Radio','Cafeteria','Elevator'])
    expect(raid.steps[6]).toMatchObject({type:'Elevator',row:1,col:9})
  })

  it('uses the far shaft if it leads down, then traverses the second floor from that edge',()=>{
    const vault=example('blank')
    for (const [type,row,col,sections] of [
      ['Cafeteria',0,10,3],['Radio',0,19,2],['Elevator',0,25,1],
      ['Cafeteria',1,10,3],['Radio',1,19,2],['Elevator',1,25,1],
    ] as const) vault.rooms.push(candidate(vault,type,row,col,sections))
    expect(raidRoute(vault.rooms).steps.slice(2,8).map(r=>[r.type,r.row,r.col])).toEqual([
      ['Cafeteria',0,10],['Radio',0,19],['Elevator',0,25],['Elevator',1,25],['Radio',1,19],['Cafeteria',1,10],
    ])
  })

  it('stops at a descent into a row with two branches',()=>{
    const raid=raidRoute(example('starter').rooms)
    expect(raid.partial).toBe(true)
    expect(raid.steps.at(-1)).toMatchObject({type:'Elevator',row:1})
  })
})

describe('Portable snapshots',()=>{
  it('reopens a complete plan with edits, configured thresholds and raid selection',()=>{
    const original={...example('large'),minutes:2.5,offline:[2],red:{power:250},stock:{water:0},costs:[{kind:'rock' as const,amount:100,estimated:true}]}
    expect(parseFragment(planFragment(original))).toEqual(original)
    expect(readPlan(planJSON(original))).toEqual(original)
  })

  it('rejects broken links and unknown or overlapping rooms',()=>{
    const original=example('large')
    expect(()=>parseFragment('#plan=__')).toThrow()
    expect(()=>readPlan(planJSON({...original,rooms:[...original.rooms,{...original.rooms[1],id:999}]}))).toThrow()
    expect(()=>readPlan(planJSON({...original,rooms:[...original.rooms,{...original.rooms[1],id:999,type:'toString'}]}))).toThrow()
    expect(()=>readPlan(planJSON(original).replace('ps5-normal-1','other'))).toThrow()
  })
})
