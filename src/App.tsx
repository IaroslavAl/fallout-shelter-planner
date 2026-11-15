import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowDownToLine, ArrowUpRight, Bot, Cross, Droplet, Drill, Dumbbell, GitBranch, Layers3, Link2, Lock, Move, Package, Plus, Redo2, Search, Shield, Trash2, Undo2, Unlock, Users, Utensils, X, Zap } from 'lucide-react'
import { buildable, byType, canPlace, catalog, cellKey, COLS, contains, editRoom, example, FLOORS, newBuildCost, nextId, outage, raidRoute, removeRoom, resources, rockPrice, roomRate, summarize, toggleRock, variant, width, type EditResult, type Essential, type Failure, type Group, type Language, type Point, type Resource, type Room, type Vault } from './model'
import { colors, exportPNG, legendGroups, hasPlan, num, parseFragment, planFragment, planJSON, readPlan, saveFile } from './portable'
import { messages, type Label } from './i18n'

const baseResources = ['power','food','water'] as const
const icons = {power:Zap,food:Utensils,water:Droplet,housing:Users,storage:Package,utility:Layers3,medicine:Cross,craft:Drill,training:Dumbbell,nuka:Droplet}
const categories: Group[] = ['power','food','water','nuka','housing','medicine','training','craft','storage','utility']
const setup = () => {
  const hash = window.location.hash
  if (hasPlan(hash)) {
    try { return {vault:parseFragment(hash), error:false} } catch { return {vault:example('starter'),error:true} }
  }
  return {vault:example('starter'),error:false}
}
const preferred = (): Language => {
  try {
    const saved = localStorage.getItem('planner-lang')
    if (saved==='ru'||saved==='en') return saved
  } catch { /* Browser storage is optional. */ }
  return navigator.language.toLowerCase().startsWith('ru')?'ru':'en'
}

type History = {past:Vault[]; vault:Vault; future:Vault[]}
type Tool = {kind:'place'; type:string; sections:number} | {kind:'move'; id:number} | {kind:'rock'}
type Tab = 'stats'|'details'|'raid'
type Translator = (key:Label)=>string
function NumberField({label,value,min=0,max,onChange,placeholder,step=1}:{
  label:string;value:number|undefined;min?:number;max:number;onChange:(n:number|undefined)=>void;placeholder?:string;step?:number
}) {
  return <label className="field"><span>{label}</span><input type="number" inputMode="decimal" min={min} max={max} step={step}
    value={value ?? ''} placeholder={placeholder} onChange={e=>{
      const n=e.currentTarget.valueAsNumber
      if (!Number.isFinite(n)) onChange(undefined)
      else onChange(Math.min(max,Math.max(min,step===1?Math.trunc(n):n)))
    }}/></label>
}
function Section({title, children}:{title:string;children:ReactNode}) {
  return <section className="panel-section"><h3>{title}</h3>{children}</section>
}
function Row({label,children}:{label:string;children:ReactNode}) {
  return <div className="data-row"><span>{label}</span><strong>{children}</strong></div>
}
function fault(error:Failure,t:Translator) {
  if (error==='housing') return t('housingShort')
  if (error==='inventory') return t('inventoryError')
  if (error==='unlock') return t('upgradeUnlock')
  return t(error)
}
function keyboardStep(event: KeyboardEvent<HTMLElement>, p:Point) {
  const arrow:Record<string,Point> = {ArrowLeft:{row:0,col:-1},ArrowRight:{row:0,col:1},ArrowDown:{row:1,col:0},ArrowUp:{row:-1,col:0}}
  const direction = arrow[event.key]
  if (!direction) return
  event.preventDefault()
  const target = {row:p.row+direction.row,col:p.col+direction.col}
  if (!buildable(target)) return
  document.querySelector<HTMLElement>('[data-cell="'+cellKey(target)+'"]')?.focus()
}

export default function App() {
  const [language,setLanguage]=useState<Language>(preferred)
  const t:Translator=key=>messages[language][key]
  const [initial]=useState(setup)
  const [history,setHistory]=useState<History>({past:[],vault:initial.vault,future:[]})
  const {vault}=history
  const [tab,setTab]=useState<Tab>('stats')
  const [selection,select]=useState<number>()
  const [tool,setTool]=useState<Tool>()
  const [hover,setHover]=useState<Point>()
  const [search,setSearch]=useState('')
  const [group,setGroup]=useState<Group|'all'>('all')
  const [notice,setNotice]=useState<Label|{error:Failure}|null>(initial.error?'invalid':null)
  const [exportOpen,setExportOpen]=useState(false)
  const [shareLink,setShareLink]=useState<string>()
  const [showRoute,setShowRoute]=useState(true)
  const [chooseOutage,setChooseOutage]=useState(false)
  const file=useRef<HTMLInputElement>(null)
  const board=useRef<HTMLDivElement>(null)
  const drag=useRef<Tool>(undefined)
  const stats=useMemo(()=>summarize(vault),[vault])
  const route=useMemo(()=>raidRoute(vault.rooms),[vault.rooms])
  const stress=useMemo(()=>outage(vault,stats),[vault,stats])
  const occupied=useMemo(()=> {
    const cells = new Map<number,Room>()
    for (const r of vault.rooms) for(let i=0;i<width(r);i++) cells.set(cellKey({row:r.row,col:r.col+i}),r)
    return cells
  },[vault.rooms])
  const rockCells=useMemo(()=>new Set(vault.rocks.flatMap(r=>[cellKey(r),cellKey(r)+1,cellKey(r)+2])),[vault.rocks])
  const routeSteps=useMemo(()=>{
    const entries = new Map<number,number[]>()
    route.steps.forEach((room,index)=>entries.set(room.id,[...(entries.get(room.id)??[]),index+1]))
    return entries
  },[route])
  const vaultFloorCount=Math.max(0,...vault.rooms.map(r=>r.row),...vault.rocks.map(r=>r.row))+1
  const freeCells=COLS*FLOORS-9-(occupied.size-6)-rockCells.size
  const selectedRoom=vault.rooms.find(r=>r.id===selection)
  const buildEstimate=newBuildCost(vault.rooms,vault.excavated.reduce((n,rock)=>n+rockPrice(rock.row),0))
  const remodelEstimate=vault.costs.reduce((n,c)=>n+c.amount,0)
  const printMetrics=[
    baseResources.map(key=>t(key)+' '+num(stats.output[key],language)+' / '+num(stats.consumed[key],language)+' '+t('perMin')).join('    ·    '),
    t('population')+' '+vault.population+' / '+stats.housing+'    ·    '+t('costNew')+' '+num(buildEstimate,language,0)+' '+t('caps')+
      (vault.remodel?'    ·    '+t('costChange')+' '+num(remodelEstimate,language,0)+' '+t('caps'):''),
  ]
  const setVault=(value:Vault)=>setHistory(h=>({past:[...h.past.slice(-79),h.vault],vault:value,future:[]}))
  const patch=(value:Partial<Vault>)=>setVault({...vault,...value})
  const undo=()=>setHistory(h=>h.past.length?{past:h.past.slice(0,-1),vault:h.past.at(-1)!,future:[h.vault,...h.future]}:h)
  const redo=()=>setHistory(h=>h.future.length?{past:[...h.past,h.vault],vault:h.future[0],future:h.future.slice(1)}:h)
  useEffect(()=>{
    document.documentElement.lang=language
    try { localStorage.setItem('planner-lang',language) } catch { /* Optional preference. */ }
  },[language])
  useEffect(()=>{
    const listener=(event:globalThis.KeyboardEvent)=>{
      if (event.key==='Escape') { setTool(undefined); setHover(undefined); setChooseOutage(false);setExportOpen(false) }
      if ((event.ctrlKey||event.metaKey) && event.key.toLowerCase()==='z' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    window.addEventListener('keydown',listener)
    return ()=>window.removeEventListener('keydown',listener)
  },[])
  useEffect(()=>{
    const listener=()=>{
      if (!hasPlan(window.location.hash)) return
      try {
        const imported=parseFragment(window.location.hash)
        setHistory({past:[],vault:imported,future:[]})
        setTool(undefined); select(undefined); setNotice(null)
      } catch { setNotice('invalid') }
    }
    window.addEventListener('hashchange',listener)
    return ()=>window.removeEventListener('hashchange',listener)
  },[])

  function accept(result:EditResult) {
    if ('error' in result) {setNotice({error:result.error});return false}
    setVault(result.vault)
    if (result.id!==undefined) select(result.id)
    setNotice(result.warning?{error:result.warning}:null)
    return true
  }

  function candidate(p:Point,current=tool): Room|undefined {
    if (current?.kind==='place') return {id:nextId(vault.rooms),type:current.type,sections:current.sections,level:1,workers:0,...p}
    if (current?.kind==='move') {
      const r=vault.rooms.find(r=>r.id===current.id)
      return r?{...r,...p}:undefined
    }
  }

  function act(p:Point,current=tool) {
    if (current?.kind==='rock') {accept(toggleRock(vault,p));return}
    const room=candidate(p,current)
    if (room && accept(editRoom(vault,room))) {
      if (current?.kind==='move') setTool(undefined)
      setTab('details')
    }
  }
  function pickRoom(room:Room) {
    if (chooseOutage && tab==='raid') {
      patch({offline:vault.offline.includes(room.id)?vault.offline.filter(id=>id!==room.id):[...vault.offline,room.id]})
      return
    }
    select(room.id)
    setTab('details')
    setTool(undefined)
  }
  function assign(row:number) {
    const used=vault.handyFloors.includes(row)
    if (!used && vault.handyFloors.length>=vault.robots) {setNotice('noRobots');return}
    patch({handyFloors:used?vault.handyFloors.filter(f=>f!==row):[...vault.handyFloors,row]})
    setNotice(null)
  }
  function startDrag(event:DragEvent,current:Tool) {
    drag.current=current
    setTool(current)
    event.dataTransfer.setData('text/plain','vault-room')
    event.dataTransfer.effectAllowed=current.kind==='move'?'move':'copy'
  }
  function drop(event:DragEvent,p:Point) {
    if (!drag.current) return
    event.preventDefault()
    act(p,drag.current)
    drag.current=undefined
    setHover(undefined)
  }
  const template=(choice:'starter'|'large'|'blank')=>{
    if ((history.past.length || hasPlan(window.location.hash)) && !window.confirm(t('replace'))) return
    setVault(example(choice));select(undefined);setTool(undefined);setTab('stats');setNotice(null)
    board.current?.scrollTo({top:0,left:0})
  }
  const loadFile=async (input:HTMLInputElement)=>{
    const selected=input.files?.[0]
    input.value=''
    if (!selected) return
    try {
      if (selected.size > 180_000) throw new Error('size')
      setVault(readPlan(await selected.text()))
      setTool(undefined);select(undefined);setNotice(null);setTab('stats')
    } catch {setNotice('invalid')}
  }
  async function share(){
    let link:string
    try {link=window.location.href.split('#')[0]+planFragment(vault)}
    catch {setNotice('tooLong');return}
    try { await navigator.clipboard.writeText(link);setNotice('copied') }
    catch {setShareLink(link)}
  }

  const query=search.trim().toLocaleLowerCase(language)
  const listed=catalog.filter(entry=>entry.id!=='Entrance' && (group==='all'||group===entry.group) &&
    (!query||[entry.en,entry.ru,entry.stat].some(s=>s.toLocaleLowerCase(language).includes(query))))
  const estimateFits=tool && tool.kind!=='rock' ? Array.from({length:COLS*FLOORS},(_,i)=>candidate({row:Math.floor(i/COLS),col:i%COLS}))
    .filter(r=>r && canPlace(r,vault.rooms)).length : null
  const ghost=hover ? candidate(hover) : undefined

  return <>
    <header className="topbar">
      <div className="brand"><span className="brand-icon"><Layers3 size={19}/></span><span>Vault <b>Planner</b></span></div>
      <div className="top-right">
        <a className="method" href="https://github.com/IaroslavAl/fallout-shelter-planner/blob/main/docs/data.md" target="_blank" rel="noreferrer">{t('guide')} <ArrowUpRight size={14}/></a>
        <div className="languages" aria-label="Language">
          {(['en','ru'] as const).map(lang=><button key={lang} className={language===lang?'active':''} aria-pressed={language===lang} onClick={()=>setLanguage(lang)}>{lang.toUpperCase()}</button>)}
        </div>
      </div>
    </header>
    <main className="app">
      <section className="intro">
        <div>
          <div className="platform"><span/>{t('platform')}</div>
          <h1>{t('title')} <em>{t('planner')}</em></h1>
          <p>{t('subtitle')}</p>
        </div>
        <div className="intro-actions">
          <select aria-label={t('template')} value="" onChange={e=>template(e.currentTarget.value as 'starter'|'large'|'blank')}>
            <option value="" disabled>{t('template')}</option>
            <option value="starter">{t('starter')}</option><option value="large">{t('large')}</option><option value="blank">{t('blank')}</option>
          </select>
          <div className="export-wrap">
            <button className="button" aria-expanded={exportOpen} onClick={()=>setExportOpen(v=>!v)}><ArrowDownToLine size={16}/>{t('export')}</button>
            {exportOpen&&<div className="export-menu">
              <button onClick={()=>{exportPNG(vault,t('title')+' · '+t('planner'),printMetrics,language,legendGroups.map(t));setExportOpen(false)}}>{t('download')}</button>
              <button onClick={()=>{setExportOpen(false);window.print()}}>{t('print')}</button>
              <button onClick={()=>{saveFile(new Blob([planJSON(vault)],{type:'application/json'}),'fallout-shelter-plan.json');setExportOpen(false)}}>{t('json')}</button>
              <button onClick={()=>{file.current?.click();setExportOpen(false)}}>{t('import')}</button>
            </div>}
          </div>
          <button className="button primary" onClick={share}><Link2 size={16}/>{t('share')}</button>
          <input type="file" accept=".json,application/json" ref={file} hidden onChange={e=>void loadFile(e.currentTarget)}/>
        </div>
      </section>
      <section aria-label={t('dashboard')} className="metrics">
        {baseResources.map(key=>{
          const Icon=icons[key]
          const balance=stats.output[key]-stats.consumed[key]
          return <article className={'metric '+key} key={key}>
            <div className="metric-label"><Icon size={17}/>{t(key)}</div>
            <div className="metric-main"><b>{num(stats.output[key],language)}</b><span> / {num(stats.consumed[key],language)} {t('perMin')}</span></div>
            <div className="measure"><i style={{width:Math.min(100,stats.consumed[key]?stats.output[key]/stats.consumed[key]*70:0)+'%'}}/></div>
            <div className="metric-sub"><span className={balance<0?'negative':'positive'}>{balance>=0?'+':''}{num(balance,language)} {t('perMin')}</span><span>{num(stats.capacity[key],language,0)} {t('capacity').toLowerCase()}</span></div>
          </article>
        })}
        <article className="metric housing">
          <div className="metric-label"><Users size={18}/>{t('population')}</div>
          <div className="metric-main"><b>{vault.population}</b><span> / {stats.housing} {t('slots')}</span></div>
          <div className="measure"><i style={{width:Math.min(100,vault.population/Math.max(1,stats.housing)*100)+'%'}}/></div>
          <div className="metric-sub"><span>{stats.assigned} {t('assigned').toLowerCase()}</span><span>{stats.jobs} {t('jobs').toLowerCase()}</span></div>
        </article>
      </section>
      {(notice||shareLink)&&<div className="notice" role="status">
        {shareLink?<label>{t('copyManual')}<input readOnly value={shareLink} onFocus={e=>e.currentTarget.select()}/></label>:notice && (typeof notice==='string'?t(notice):fault(notice.error,t))}
        <button className="icon-button" aria-label={t('close')} onClick={()=>{setNotice(null);setShareLink(undefined)}}><X size={16}/></button>
      </div>}
      <div className="workspace">
        <aside className="panel palette">
          <div className="panel-heading"><Layers3 size={18}/><h2>{t('rooms')}</h2><span>{listed.length}</span></div>
          <div className="palette-search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('search')} aria-label={t('search')}/></div>
          <select className="group-select" aria-label={t('all')} value={group} onChange={e=>setGroup(e.currentTarget.value as Group|'all')}>
            <option value="all">{t('all')}</option>{categories.map(g=><option key={g} value={g}>{t(g)}</option>)}
          </select>
          <div className="catalog-list">
            {listed.map(entry=>{
              const Icon=icons[entry.group]
              const active=tool?.kind==='place'&&tool.type===entry.id
              const current:Tool={kind:'place',type:entry.id,sections:entry.widths[0]}
              return <div className={'palette-entry'+(active?' active':'')} key={entry.id}>
                <button className="palette-button" aria-pressed={active} draggable onDragStart={e=>startDrag(e,current)} onDragEnd={()=>{drag.current=undefined;setHover(undefined)}}
                  onClick={()=>{setTool(active?undefined:current);setChooseOutage(false);setNotice(null)}}>
                  <span className="room-icon" style={{color:colors[entry.group]}}><Icon size={16}/></span>
                  <span><b>{entry[language]}</b><small>{entry.stat||t(entry.group)} · {num(entry.base,language,0)} {t('caps')}</small></span>
                  <Plus size={14} className="palette-add"/>
                </button>
                {active && entry.widths.length>1 && <div className="width-pick"><span>{t('width')}</span>{entry.widths.map(sections=><button key={sections} aria-label={sections+' '+t('unit')} aria-pressed={tool.sections===sections} onClick={()=>setTool({...current,sections})}>{sections}</button>)}</div>}
              </div>
            })}
          </div>
        </aside>

        <section className="panel board">
          <div className="panel-heading map-heading">
            <Layers3 size={18}/><h2>{t('map')}</h2>
            <div className="map-tools">
              <button className="icon-button" aria-label={t('undo')} title={t('undo')} disabled={!history.past.length} onClick={undo}><Undo2 size={17}/></button>
              <button className="icon-button" aria-label={t('redo')} title={t('redo')} disabled={!history.future.length} onClick={redo}><Redo2 size={17}/></button>
              <button className={'icon-button'+(tool?.kind==='rock'?' active':'')} aria-label={t('rocks')} title={t('rocks')} aria-pressed={tool?.kind==='rock'} onClick={()=>setTool(tool?.kind==='rock'?undefined:{kind:'rock'})}><Drill size={16}/></button>
              <select aria-label={t('floor')} value="" onChange={e=>{
                const row=Number(e.currentTarget.value)
                board.current?.querySelector<HTMLElement>('[data-row="'+row+'"]')?.scrollIntoView({block:'nearest',inline:'nearest'})
              }}>
                <option value="" disabled>{t('floor')}</option>{Array.from({length:FLOORS},(_,i)=><option value={i} key={i}>{String(i+1).padStart(2,'0')}</option>)}
              </select>
            </div>
          </div>
          <div className="board-info">
            <span>{tool?.kind==='rock'?t('rockTip'):tool?.kind==='move'?t('moveTip'):chooseOutage&&tab==='raid'?t('outageTip'):t('selectRoom')}</span>
            <b>{estimateFits===null?freeCells+' '+t('cells'):estimateFits+' '+t('fits')}</b>
          </div>
          <div className="board-scroll" ref={board}>
            <div className={'map-content'+(chooseOutage&&tab==='raid'?' picking':'')}>
              <div className="ground"><span/><span/><span/></div>
              {Array.from({length:FLOORS},(_,row)=> <div key={row} data-row={row} className={'floor-row'+(row===0?' surface':'')}>
                <div className="floor-index">{String(row+1).padStart(2,'0')}</div>
                <div className="floor-grid">
                  {Array.from({length:COLS},(_,col)=>{
                    const p={row,col}
                    if (!buildable(p)) return <div key={col} className="void-cell" style={{gridColumn:col+1,gridRow:1}}/>
                    const key=cellKey(p)
                    const rock=rockCells.has(key)
                    const target=tool&&tool.kind!=='rock'&&hover?.row===row&&ghost&&col>=ghost.col&&col<ghost.col+width(ghost)
                    const valid=target&&ghost&&canPlace(ghost,vault.rooms)
                    const filled=occupied.has(key)
                    return <button key={col} data-cell={key} tabIndex={row===0&&col===9?0:-1} aria-label={t('floor')+' '+(row+1)+' · '+(col+1)}
                      className={'grid-cell'+(rock?' rock-cell':'')+(filled?' under-room':'')+(target?(valid?' ghost':' ghost-bad'):'')}
                      style={{gridColumn:col+1,gridRow:1}} onClick={()=>act(p)} onKeyDown={e=>keyboardStep(e,p)} onPointerEnter={()=>{if(tool)setHover(p)}}
                      onDragOver={e=>{if(drag.current){e.preventDefault();setHover(p)}}} onDrop={e=>drop(e,p)}
                      title={rock?t('rock')+' · '+rockPrice(row)+' '+t('caps'):undefined}/>
                  })}
                  {vault.rooms.filter(r=>r.row===row).map(room=>{
                    const entry=byType[room.type]
                    const Icon=icons[entry.group]
                    const routeMarks=tab==='raid'&&showRoute?routeSteps.get(room.id):undefined
                    const lift=room.type==='Elevator'
                    const disabled=room.type==='Entrance'||room.locked
                    return <button key={room.id} data-room-id={room.id} aria-pressed={tab==='raid'&&chooseOutage?vault.offline.includes(room.id):selection===room.id}
                      aria-label={lift?t('floor')+' '+(row+1)+' · '+entry[language]+' '+(room.col+1):entry[language]+' · '+t('floor')+' '+(row+1)}
                      className={'map-room '+entry.group+(lift?' elevator':'')+(room.type==='Entrance'?' entrance':'')+(selection===room.id?' selected':'')+(!stats.available.has(room.id)?' severed':'')+(routeMarks?' route-room':'')+(vault.offline.includes(room.id)&&tab==='raid'?' offline':'')}
                      style={{gridColumn:(room.col+1)+' / span '+width(room),gridRow:1,'--room':colors[entry.group]} as CSSProperties}
                      draggable={!disabled&&!chooseOutage} onDragStart={e=>startDrag(e,{kind:'move',id:room.id})} onDragEnd={()=>{drag.current=undefined;setHover(undefined)}}
                      onClick={()=>pickRoom(room)} title={entry[language]}>
                      {lift?<span className="elevator-symbol">↕</span>:<>
                        <span className="blueprint" aria-hidden="true"><i/><i/><i/><i/></span>
                        <span className="room-title"><Icon size={14}/><b>{entry[language]}</b></span>
                        <span className="room-meta">L{room.level}{variant(room).workers>0?' · '+room.workers+'/'+variant(room).workers:''}{room.locked&&<Lock size={10}/>}</span>
                      </>}
                      {routeMarks&&<span className="waypoint">{routeMarks.join('·')}</span>}
                    </button>
                  })}
                </div>
                <button className={'floor-bot'+(vault.handyFloors.includes(row)?' active':'')} aria-pressed={vault.handyFloors.includes(row)}
                  aria-label={t('helper')+' · '+t('floor')+' '+(row+1)} title={t('selectHandy')} onClick={()=>assign(row)}><Bot size={16}/></button>
              </div>)}
            </div>
          </div>
          <div className="board-footer"><span>{t('mapLegend')}</span><span>{vaultFloorCount} / {FLOORS} {t('floors').toLowerCase()}</span></div>
        </section>

        <aside className="panel inspector">
          <div className="tabs" aria-label={t('stats')}>
            {(['stats','details','raid'] as const).map(name=><button key={name} aria-pressed={tab===name} className={tab===name?'active':''} onClick={()=>{setTab(name);setTool(undefined);if(name!=='raid')setChooseOutage(false)}}>{t(name)}</button>)}
          </div>
          <div className="inspector-scroll">
            {tab==='stats'&&<Overview vault={vault} stats={stats} t={t} language={language} patch={patch} buildEstimate={buildEstimate}/>}
            {tab==='details' && (selectedRoom ? <RoomDetails room={selectedRoom} vault={vault} t={t} language={language} accept={accept} move={()=>{setTool({kind:'move',id:selectedRoom.id});setNotice(null)}} lock={()=>patch({rooms:vault.rooms.map(r=>r.id===selectedRoom.id?{...r,locked:!r.locked}:r)})}/> : <p className="hint inset">{t('noRoom')}</p>)}
            {tab==='raid'&&<div>
              <Section title={t('route')}>
                <label className="check"><input type="checkbox" checked={showRoute} onChange={e=>setShowRoute(e.target.checked)}/>{t('showRoute')}</label>
                <p className="hint">{t('routeScope')} {route.partial&&t('routePartial')}</p>
                <div className="route-list">{route.steps.map((r,index)=><span key={index}>{index+1} · {byType[r.type][language]}</span>)}</div>
              </Section>
              <Section title={t('outage')}>
                <p className="hint">{t('outageTip')}</p>
                <div className="inline-actions">
                  <button className={'button compact'+(chooseOutage?' active':'')} aria-pressed={chooseOutage} onClick={()=>{setTool(undefined);setChooseOutage(x=>!x)}}>{t('affected')} ({vault.offline.length})</button>
                  <button className="button compact" onClick={()=>patch({offline:[]})}>{t('clear')}</button>
                </div>
                <button className="button compact wide" onClick={()=>patch({offline:[...new Set(route.steps.filter(r=>resources.some(key=>(variant(r).rate[key]??0)>0)).map(r=>r.id))]})}>{t('useRoute')}</button>
                <NumberField label={t('duration')} value={vault.minutes} max={180} step={.5} onChange={n=>patch({minutes:n??0})}/>
                {stress.map(line=><div className="stress-row" key={line.key}>
                  <Row label={t(line.key)}>{num(line.starting,language)} → {num(line.after,language)}</Row>
                  <Row label={t('redIn')}><span className={line.untilRed!==null&&line.untilRed<=vault.minutes?'negative':'positive'}>{line.untilRed===null?t('sustainable'):num(line.untilRed,language)+' '+(language==='ru'?'мин':'min')}</span></Row>
                  <NumberField label={t('stock')} value={vault.stock[line.key]} placeholder={String(Math.round(stats.capacity[line.key]))} max={1000000} onChange={n=>patch({stock:{...vault.stock,[line.key]:n}})}/>
                  <NumberField label={t('red')} value={vault.red[line.key]} placeholder={String(Math.round(line.cutoff))} max={1000000} onChange={n=>patch({red:{...vault.red,[line.key]:n}})}/>
                </div>)}
              </Section>
            </div>}
          </div>
        </aside>
      </div>
      <footer className="footer"><span>{t('estimates')}</span><a href="https://github.com/IaroslavAl/fallout-shelter-planner"><GitBranch size={14}/> GitHub</a></footer>
    </main>
    <PrintPlan vault={vault} t={t} language={language} metrics={printMetrics}/>
  </>
}

function Overview({vault,stats,t,language,patch,buildEstimate}:{
  vault:Vault;stats:ReturnType<typeof summarize>;t:Translator;language:Language;patch:(p:Partial<Vault>)=>void;buildEstimate:number
}){
  const money=(n:number)=>num(n,language,0)+' '+t('caps')
  const cleared=vault.excavated
  const spent=vault.costs.filter(c=>c.amount>0).reduce((s,c)=>s+c.amount,0)
  const returned=-vault.costs.filter(c=>c.amount<0).reduce((s,c)=>s+c.amount,0)
  return <>
    <Section title={t('global')}>
      <NumberField label={t('population')} value={vault.population} max={200} onChange={n=>patch({population:n??0,outside:Math.min(vault.outside,n??0)})}/>
      <NumberField label={t('outside')} value={vault.outside} max={vault.population} onChange={n=>patch({outside:n??0})}/>
      <label className="field"><span>{t('special')}</span><select value={vault.special} onChange={e=>patch({special:Number(e.target.value)})}>{Array.from({length:17},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label>
      <NumberField label={t('happiness')+' (%)'} value={vault.happiness} max={100} onChange={n=>patch({happiness:n??0})}/>
      <NumberField label={t('robotCount')} value={vault.robots} max={FLOORS} onChange={n=>patch({robots:n??0,handyFloors:vault.handyFloors.slice(0,n??0)})}/>
      <NumberField label={t('delay')} value={vault.delay} max={300} onChange={n=>patch({delay:n??0})}/>
      <p className="hint">{t('delayHelp')}</p>
      <Row label={t('coverage')}>{vault.handyFloors.filter(f=>stats.productionFloors.has(f)).length} / {stats.productionFloors.size}</Row>
      {(vault.population>stats.housing||stats.assigned>stats.inside||stats.available.size<vault.rooms.length) && <div className="warnings">
        {vault.population>stats.housing&&<p>{t('housingShort')}</p>}
        {stats.assigned>stats.inside&&<p>{t('overstaffed')}</p>}
        {stats.available.size<vault.rooms.length&&<p>{t('disconnected')}</p>}
      </div>}
    </Section>
    <Section title={t('capacity')}>
      <Row label={t('unassigned')}>{Math.max(0,stats.inside-stats.assigned)}</Row>
      <NumberField label={t('inventory')} value={vault.inventory} max={100000} onChange={n=>patch({inventory:n??0})}/>
      <Row label={t('storage')}>{vault.inventory} / {stats.items}</Row>
      <Row label={t('stim')}>{num(stats.output.stim,language,2)} {t('perMin')} · {stats.capacity.stim}</Row>
      <Row label={t('rad')}>{num(stats.output.rad,language,2)} {t('perMin')} · {stats.capacity.rad}</Row>
      <Row label={t('trainingSlots')}>{Object.values(stats.training).reduce((n,x)=>n+x,0)}</Row>
      <div className="stat-chips">{[...'SPECIAL'].map(stat=><span key={stat}>{stat} <b>{stats.training[stat]??0}</b></span>)}</div>
      {baseResources.map(key=><Row key={key} label={t(key)+' · '+t('auto')}>{num(stats.automated[key],language)}</Row>)}
    </Section>
    <Section title={t('cost')}>
      <Row label={t('costNew')}>{money(buildEstimate)}</Row>
      {vault.rocks.length>0 && <Row label={t('rocks')}>{vault.rocks.length}</Row>}
      {!vault.remodel&&cleared.length>0&&<Row label={t('rock')}>{money(cleared.reduce((n,c)=>n+rockPrice(c.row),0))}</Row>}
      {vault.remodel&&<>
        <Row label={t('spent')}>{money(spent)}</Row><Row label={t('refund')}>{money(returned)}</Row><Row label={t('net')}>{money(spent-returned)}</Row>
        <div className="ledger">{vault.costs.length ? vault.costs.map((cost,index)=><Row key={index} label={t(cost.kind)+(cost.type?' · '+byType[cost.type][language]:'')+(cost.estimated?' ≈':'')}>{money(cost.amount)}</Row>) : <p className="hint">{t('noCosts')}</p>}</div>
      </>}
      <p className="hint">{t('sketchNote')}</p>
      <button className="button compact wide" onClick={()=>patch({remodel:!vault.remodel,costs:[]})}>{t(vault.remodel?'costReset':'costStart')}</button>
    </Section>
  </>
}

function RoomDetails({room,vault,t,language,accept,move,lock}:{
  room:Room;vault:Vault;t:Translator;language:Language;accept:(r:EditResult)=>boolean;move:()=>void;lock:()=>void
}) {
  const entry=byType[room.type]
  const data=variant(room)
  const rate=roomRate(vault,room)
  const fixed=room.type==='Entrance'
  return <>
    <Section title={entry[language]}>
      <Row label={t('floor')}>{room.row+1}</Row>
      <Row label={t('minimum')}>{entry.unlock}</Row>
      {entry.stat&&<Row label="SPECIAL">{entry.stat}</Row>}
      <label className="field"><span>{t('width')}</span><select value={room.sections} disabled={entry.widths.length===1||!!room.locked} onChange={e=>accept(editRoom(vault,{...room,sections:Number(e.target.value)}))}>
        {entry.widths.map(n=><option key={n} value={n}>{room.type==='Elevator'?1:n*3} {language==='ru'?'кл.':'cells'}</option>)}
      </select></label>
      <Row label={t('level')}>{room.level} / {entry.maximum}</Row>
      {data.workers>0&&<NumberField label={t('workers')} value={room.workers} max={data.workers} onChange={n=>accept(editRoom(vault,{...room,workers:n??0}))}/>}
      {entry.group==='craft'&&entry.id!=='DesignFactory'&&<p className="hint">{t('workshop')}</p>}
      {entry.widths.length>1&&<p className="hint">{t('resizeTip')}</p>}
      {data.upgrade!==null&&<button className="button compact wide" disabled={room.locked} onClick={()=>accept(editRoom(vault,{...room,level:room.level+1}))}>
        {t('upgrade')} · {num(data.upgrade,language,0)} {t('caps')}
      </button>}
    </Section>
    <Section title={t('stats')}>
      {resources.map((key:Resource)=>data.rate[key] ? <Row key={key} label={t(key)}>{num(rate.collected[key],language,2)} {t('perMin')}</Row>:null)}
      {resources.map(key=>data.batch[key]?<Row key={key+'batch'} label={t(key)+' · '+t('batch')}>{data.batch[key]}</Row>:null)}
      {resources.map(key=>data.capacity[key]?<Row key={key+'capacity'} label={t(key)+' · '+t('capacity')}>{data.capacity[key]}</Row>:null)}
      <Row label={t('draw')}>{num(data.draw,language,2)} {t('perMin')}</Row>
      {data.housing>0&&<Row label={t('housing')}>{data.housing}</Row>}
      {data.items>0&&<Row label={t('storage')}>{data.items}</Row>}
      {!fixed&&<Row label={t('refund')}>{data.refundEstimated?'≈ ':''}{num(data.refund,language,0)} {t('caps')}</Row>}
      <a className="source" href={entry.source} target="_blank" rel="noreferrer">{t('source')} <ArrowUpRight size={13}/></a>
    </Section>
    {!fixed&&<Section title={t('edit')}>
      <div className="inline-actions">
        <button className="button compact" disabled={room.locked} onClick={move}><Move size={14}/>{t('move')}</button>
        <button className="button compact" onClick={lock}>{room.locked?<Unlock size={14}/>:<Lock size={14}/>} {t(room.locked?'unlock':'lock')}</button>
      </div>
      <button className="button compact danger wide" disabled={room.locked} onClick={()=>accept(removeRoom(vault,room.id))}><Trash2 size={14}/>{t('demolish')}</button>
    </Section>}
  </>
}
function PrintPlan({vault,t,language,metrics}:{vault:Vault;t:Translator;language:Language;metrics:string[]}){
  const rows=Math.max(0,...vault.rooms.map(r=>r.row),...vault.rocks.map(r=>r.row))+1
  return <section className="print-plan">
    <h1>{t('title')} · {t('planner')}</h1>
    {metrics.map(line=><p key={line}>{line}</p>)}
    {Array.from({length:rows},(_,row)=><div className="print-row" key={row}>
      <b>{row+1}</b><div className="print-grid">
        {vault.rooms.filter(r=>r.row===row).map(r=><div key={r.id} style={{gridColumn:(r.col+1)+' / span '+width(r),gridRow:1,borderColor:colors[byType[r.type].group]}}>{r.type==='Elevator'?'↕':byType[r.type][language]+' L'+r.level}</div>)}
        {vault.rocks.filter(r=>r.row===row).map(r=><div key={r.col} style={{gridColumn:(r.col+1)+' / span 3',gridRow:1}}>{t('rocks')}</div>)}
      </div>
    </div>)}
    <div className="print-legend">{legendGroups.map(group=><span key={group} style={{borderColor:colors[group]}}>{t(group)}</span>)}</div>
  </section>
}
