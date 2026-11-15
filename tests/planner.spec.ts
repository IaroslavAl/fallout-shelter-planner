import { readFile } from 'node:fs/promises'
import { devices, expect, test } from '@playwright/test'
import { example } from '../src/model'
import { planFragment } from '../src/portable'

test('place and staff a room, undo, switch language, and recover shared state',async ({page, browser, baseURL, isMobile})=>{
  const errors:string[] = []
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(baseURL!)
  await expect(page.getByRole('heading',{name:'Fallout Shelter Planner'})).toBeVisible()
  const palette=page.locator('.palette')
  await palette.getByRole('textbox',{name:'Find a room…'}).fill('Diner')
  const diner=palette.getByRole('button',{name:/Diner/})
  if (isMobile) await diner.tap()
  else await diner.click()
  const cell=page.getByRole('button',{name:'Floor 3 · 23',exact:true})
  if (isMobile) await cell.tap()
  else await cell.click()
  const newRoom=page.getByRole('button',{name:'Diner · Floor 3',exact:true})
  await expect(newRoom).toBeVisible()
  await page.getByLabel('Assigned workers').fill('2')
  const after=await page.locator('.metric.food .metric-main b').textContent()
  await page.getByRole('button',{name:'Undo',exact:true}).click()
  const before=await page.locator('.metric.food .metric-main b').textContent()
  expect(after).not.toBe(before)
  await page.getByRole('button',{name:'Redo',exact:true}).click()
  await page.getByRole('button',{name:'RU',exact:true}).click()
  await expect(page.getByRole('heading',{name:'План убежища'})).toBeVisible()
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{value:{
    writeText:async (value:string)=>{document.body.dataset.copied=value}
  },configurable:true}))
  await page.getByRole('button',{name:'Поделиться',exact:true}).click()
  const link=await page.locator('body').getAttribute('data-copied')
  expect(link).toContain('#plan=')
  const fresh=await browser.newContext({locale:'en-US'})
  try {
    const opened=await fresh.newPage()
    await opened.goto(link!)
    await expect(opened.getByRole('button',{name:'Diner · Floor 3',exact:true})).toBeVisible()
    await expect(opened.locator('.metric.food .metric-main b')).toHaveText(after!)
  } finally { await fresh.close() }
  expect(errors).toEqual([])
})

test('show the entry route, simulate an outage, and export the full plan',async ({page,baseURL,isMobile})=>{
  await page.goto(baseURL!+planFragment(example('large')))
  await page.getByRole('button',{name:'Raid',exact:true}).click()
  await expect(page.locator('.waypoint').first()).toBeVisible()
  await page.getByRole('button',{name:'Affected rooms (0)',exact:true}).click()
  await page.getByRole('button',{name:'Nuclear Reactor · Floor 1',exact:true}).click()
  await expect(page.getByRole('button',{name:'Affected rooms (1)',exact:true})).toBeVisible()
  await expect(page.locator('.stress-row').first()).toContainText('To red')
  if (!isMobile) {
    await page.getByRole('button',{name:'Export',exact:true}).click()
    const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download PNG'}).click()])
    const png=await readFile((await download.path())!)
    expect(png.subarray(1,4).toString()).toBe('PNG')
    expect(png.readUInt32BE(20)).toBeGreaterThan(2*11*62)
    const pdf=await page.pdf({format:'A4',printBackground:true})
    expect(pdf.subarray(0,4).toString()).toBe('%PDF')
    await page.emulateMedia({media:'print'})
    await expect(page.locator('.print-row')).toHaveCount(12)
    await expect(page.locator('.print-legend')).toBeVisible()
  }
})

test('rejects an invalid share link and opens an imported snapshot',async ({page,baseURL})=>{
  await page.goto(baseURL!+'#plan=broken')
  await expect(page.getByRole('status')).toContainText('damaged')
  await page.locator('input[type=file]').setInputFiles({name:'test.json',mimeType:'application/json',
    buffer:Buffer.from(JSON.stringify({v:1,rules:'ps5-normal-1',vault:example('large')}))})
  await expect(page.locator('.metric.housing .metric-main b')).toHaveText('200')
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('drag the selected width from the palette onto the map',async ({page,baseURL,isMobile})=>{
  test.skip(isMobile,'The touch placement path is covered separately.')
  await page.goto(baseURL!)
  const generator=page.locator('.palette').getByRole('button',{name:/Power Generator/})
  await generator.click()
  await page.getByRole('button',{name:'2 sections',exact:true}).click()
  const cell=page.getByRole('button',{name:'Floor 4 · 11',exact:true})
  await cell.scrollIntoViewIfNeeded()
  const source=(await generator.boundingBox())!
  const target=(await cell.boundingBox())!
  await page.mouse.move(source.x+source.width/2,source.y+source.height/2)
  await page.mouse.down()
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8})
  await expect(page.locator('[data-drop-row="3"][data-drop-col="10"]')).toHaveClass(/valid/)
  await page.mouse.up()
  const room=page.getByRole('button',{name:'Power Generator · Floor 4',exact:true})
  await expect(room).toBeVisible()
  await expect(room).toHaveCSS('grid-column-end','span 6')
})

test('loads illustrated rooms and switches back to the schematic without editing the plan',async ({page,baseURL})=>{
  await page.goto(baseURL!)
  const board=page.locator('.board')
  const view=page.getByRole('button',{name:'Illustrated view',exact:true})
  const generator=board.getByRole('button',{name:'Power Generator · Floor 2',exact:true})
  await expect(view).toHaveAttribute('aria-pressed','true')
  await expect(generator.locator('.room-art img')).toHaveCount(1)
  const loaded=await generator.locator('.room-art img').evaluate(async image=>{
    await (image as HTMLImageElement).decode()
    return (image as HTMLImageElement).naturalWidth
  })
  expect(loaded).toBeGreaterThan(0)
  const balance=await page.locator('.metrics').textContent()
  await view.click()
  await expect(view).toHaveAttribute('aria-pressed','false')
  await expect(generator.locator('.room-art')).toHaveCount(0)
  await expect(page.locator('.metrics')).toHaveText(balance!)
  await page.reload()
  await expect(view).toHaveAttribute('aria-pressed','false')
  await view.click()
  await expect(generator.locator('.room-art')).toHaveCount(1)
})

test('moves a room from its grab point onto the exact displayed destination',async ({page,baseURL,isMobile})=>{
  test.skip(isMobile,'Mouse-specific grab test.')
  await page.goto(baseURL!)
  const room=page.getByRole('button',{name:'Science Lab · Floor 1',exact:true})
  const cell=page.getByRole('button',{name:'Floor 4 · 17',exact:true})
  await cell.scrollIntoViewIfNeeded()
  const target=(await cell.boundingBox())!
  const source=(await room.boundingBox())!
  await page.mouse.move(source.x+target.width*2.5,source.y+source.height/2)
  await page.mouse.down()
  await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:10})
  await expect(page.locator('[data-drop-row="3"][data-drop-col="14"]')).toHaveClass(/valid/)
  await page.mouse.up()
  await expect(page.getByRole('button',{name:'Science Lab · Floor 4',exact:true})).toHaveCSS('grid-column-start','15')
  await expect(room).toHaveCount(0)
})

test('drags a room from its grip with a touch pointer',async ({browser,browserName,baseURL})=>{
  test.skip(browserName!=='chromium','Chromium CDP drives touch movements. WebKit tap placement is tested separately.')
  const context=await browser.newContext({...devices['Pixel 7'],locale:'en-US'})
  try {
    const page=await context.newPage()
    await page.goto(baseURL!)
    const scroll=page.locator('.board-scroll')
    await scroll.evaluate(element=>element.scrollIntoView({block:'center'}))
    const room=page.getByRole('button',{name:'Power Generator · Floor 2',exact:true})
    const grip=room.locator('[data-room-grip]')
    const cell=page.getByRole('button',{name:'Floor 4 · 11',exact:true})
    await expect(grip).toBeVisible()
    const target=(await cell.boundingBox())!
    const source=(await grip.boundingBox())!
    const touch=await context.newCDPSession(page)
    const start={x:source.x+source.width/2,y:source.y+source.height/2}
    const end={x:target.x+target.width/2,y:target.y+target.height/2}
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]})
    for(let step=1;step<=10;step++) {
      await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{
        x:start.x+(end.x-start.x)*step/10,y:start.y+(end.y-start.y)*step/10,
      }]})
    }
    const preview=page.locator('.drop-preview.valid[data-drop-row="3"]')
    await expect(preview).toBeVisible()
    const expected=Number(await preview.getAttribute('data-drop-col'))
    await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
    await expect(page.getByRole('button',{name:'Power Generator · Floor 4',exact:true})).toHaveCSS('grid-column-start',String(expected+1))
    await expect(room).toHaveCount(0)
  } finally { await context.close() }
})
