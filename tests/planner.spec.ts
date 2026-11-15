import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { example } from '../src/model'
import { planFragment } from '../src/portable'

test('place and staff a room, undo, switch language, and recover shared state',async ({page, browser, baseURL, isMobile})=>{
  const errors:string[] = []
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(baseURL!)
  await expect(page.getByRole('heading',{name:'Fallout Shelter Planner'})).toBeVisible()
  const palette=page.locator('.palette')
  await palette.getByRole('button',{name:/Diner/}).click()
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
  await generator.dragTo(cell)
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
  await expect(generator.locator('.room-art > span')).toHaveCount(1)
  const loaded=await generator.locator('.room-art > span').evaluate(async tile=>{
    const url=getComputedStyle(tile).backgroundImage.slice(5,-2)
    const image=new Image()
    image.src=url
    await image.decode()
    return image.naturalWidth
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
