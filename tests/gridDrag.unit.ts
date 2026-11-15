import { describe, expect, it } from 'vitest'
import { snapToGrid } from '../src/gridDrag'

const grid = {left:100, top:80, cell:20, row:86, height:82}
const anchor = {columns:2.5, height:.5}

describe('room drag geometry', () => {
  it('keeps the same grab point while snapping onto another floor', () => {
    expect(snapToGrid(grid, {x:230, y:293}, anchor, () => true))
      .toEqual({point:{row:2,col:4}, valid:true})
  })

  it('uses a nearby legal cell on the same floor without jumping a gap', () => {
    const cursor = {x:237, y:293}
    expect(snapToGrid(grid, cursor, anchor, ({col}) => col === 5))
      .toEqual({point:{row:2,col:5}, valid:true})
    expect(snapToGrid(grid, cursor, anchor, ({col}) => col === 6))
      .toEqual({point:{row:2,col:4}, valid:false})
  })
})
