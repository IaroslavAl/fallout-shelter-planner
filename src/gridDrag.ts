import { useEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import { COLS, FLOORS, width, type Point, type Room } from './model'

interface Cursor { x: number; y: number }
interface Anchor { columns: number; height: number }
interface Grid {
  left: number
  top: number
  cell: number
  row: number
  height: number
}

interface Landing {
  point: Point
  valid: boolean
}

const SNAP_DISTANCE = .7
const EDGE_DISTANCE = 28

export function snapToGrid(grid: Grid, cursor: Cursor, anchor: Anchor, fits: (point: Point) => boolean): Landing {
  const row = Math.max(0, Math.min(FLOORS - 1, Math.round((cursor.y - grid.top - anchor.height * grid.height) / grid.row)))
  const exactCol = (cursor.x - grid.left) / grid.cell - anchor.columns
  const col = Math.max(0, Math.min(COLS - 1, Math.round(exactCol)))
  const nearest = [col, col - 1, col + 1]
    .filter(candidate => candidate >= 0 && candidate < COLS && Math.abs(candidate - exactCol) <= SNAP_DISTANCE)
    .sort((a, b) => Math.abs(a - exactCol) - Math.abs(b - exactCol))
    .find(candidate => fits({row, col: candidate}))
  return {point: {row, col: nearest ?? col}, valid: nearest !== undefined}
}

function readGrid(board: HTMLDivElement): Grid | undefined {
  const first = board.querySelector('[data-row="0"] [data-floor-grid]')?.getBoundingClientRect()
  const second = board.querySelector('[data-row="1"] [data-floor-grid]')?.getBoundingClientRect()
  if (!first || !second || !first.width) return undefined
  return {left: first.left, top: first.top, cell: first.width / COLS, row: second.top - first.top, height: first.height}
}

function edgeSpeed(cursor: number, start: number, end: number) {
  if (cursor < start + EDGE_DISTANCE) return -12 * (1 - (cursor - start) / EDGE_DISTANCE)
  if (cursor > end - EDGE_DISTANCE) return 12 * (1 - (end - cursor) / EDGE_DISTANCE)
  return 0
}

function visibleBounds(board: HTMLDivElement) {
  const bounds = board.getBoundingClientRect()
  return {left: Math.max(0, bounds.left), right: Math.min(innerWidth, bounds.right),
    top: Math.max(0, bounds.top), bottom: Math.min(innerHeight, bounds.bottom)}
}

function insideBoard(board: HTMLDivElement, cursor: Cursor) {
  const bounds = visibleBounds(board)
  return cursor.x >= bounds.left && cursor.x < bounds.right && cursor.y >= bounds.top && cursor.y < bounds.bottom
}

interface Drag<T> {
  source: HTMLButtonElement
  pointer: number
  start: Cursor
  cursor: Cursor
  anchor: Anchor
  room: Room
  tool: T
  active: boolean
  landing?: Landing
  frame?: number
}

interface Preview {
  room: Room
  movingId?: number
  landing?: Landing
  cursor: Cursor
  offset: Cursor
  size: {width: number; height: number}
}

export function useRoomDrag<T>(
  board: RefObject<HTMLDivElement | null>,
  fits: (point: Point, tool: T) => boolean,
  commit: (point: Point, tool: T, valid: boolean) => void,
  isMove: (tool: T) => boolean,
) {
  const drag = useRef<Drag<T>>(undefined)
  const clickedSource = useRef<HTMLButtonElement>(undefined)
  const [preview, setPreview] = useState<Preview>()

  function stop(suppressClick = false) {
    const current = drag.current
    if (!current) return
    drag.current = undefined
    if (current.frame !== undefined) cancelAnimationFrame(current.frame)
    if (suppressClick && current.active) clickedSource.current = current.source
    if (current.source.hasPointerCapture(current.pointer)) current.source.releasePointerCapture(current.pointer)
    setPreview(undefined)
  }

  useEffect(() => () => {
    if (drag.current?.frame !== undefined) cancelAnimationFrame(drag.current.frame)
  }, [])

  function begin(event: PointerEvent<HTMLButtonElement>, tool: T, room: Room) {
    if (!event.isPrimary || event.button !== 0) return
    clickedSource.current = undefined
    if (event.pointerType === 'touch' && !(event.target as Element).closest('[data-room-grip]')) return
    if (drag.current || !board.current) return
    const grid = readGrid(board.current)
    if (!grid) return
    const source = event.currentTarget
    const cursor = {x: event.clientX, y: event.clientY}
    const bounds = source.getBoundingClientRect()
    const anchor = isMove(tool)
      ? {columns: (cursor.x - bounds.left) / grid.cell, height: (cursor.y - bounds.top) / bounds.height}
      : {columns: .5, height: .5}
    source.setPointerCapture(event.pointerId)
    drag.current = {source, pointer: event.pointerId, start: cursor, cursor, anchor, room, tool, active: false}
  }

  function resolve(current: Drag<T>) {
    const scroll = board.current
    const grid = scroll && readGrid(scroll)
    if (!scroll || !grid) return
    const cursor = current.cursor
    const overColumns = cursor.x >= grid.left && cursor.x < grid.left + grid.cell * COLS
    const overRows = cursor.y >= grid.top && cursor.y < grid.top + (FLOORS - 1) * grid.row + grid.height
    current.landing = insideBoard(scroll, cursor) && overColumns && overRows
      ? snapToGrid(grid, cursor, current.anchor, point => fits(point, current.tool))
      : undefined
    setPreview({
      room: current.room,
      movingId: isMove(current.tool) ? current.room.id : undefined,
      landing: current.landing,
      cursor,
      offset: {x: current.anchor.columns * grid.cell, y: current.anchor.height * grid.height},
      size: {width: width(current.room) * grid.cell, height: grid.height},
    })
  }

  function autoScroll(current: Drag<T>) {
    if (drag.current !== current) return
    const scroll = board.current
    if (scroll && insideBoard(scroll, current.cursor)) {
      const bounds = visibleBounds(scroll)
      const {scrollLeft, scrollTop} = scroll
      scroll.scrollBy(
        edgeSpeed(current.cursor.x, bounds.left, bounds.right),
        edgeSpeed(current.cursor.y, bounds.top, bounds.bottom),
      )
      if (scroll.scrollLeft !== scrollLeft || scroll.scrollTop !== scrollTop) resolve(current)
    }
    current.frame = requestAnimationFrame(() => autoScroll(current))
  }

  function move(event: PointerEvent) {
    const current = drag.current
    if (!current || event.pointerId !== current.pointer) return
    current.cursor = {x: event.clientX, y: event.clientY}
    if (!current.active) {
      const moved = Math.hypot(current.cursor.x - current.start.x, current.cursor.y - current.start.y)
      if (moved < (event.pointerType === 'touch' ? 7 : 5)) return
      current.active = true
      current.frame = requestAnimationFrame(() => autoScroll(current))
    }
    resolve(current)
  }

  function finish(event: PointerEvent) {
    const current = drag.current
    if (!current || event.pointerId !== current.pointer) return
    const {landing, room, tool, active} = current
    stop(true)
    if (active && landing && !(isMove(tool) && room.row === landing.point.row && room.col === landing.point.col)) {
      commit(landing.point, tool, landing.valid)
    }
  }

  function cancel(event: PointerEvent) {
    if (drag.current?.pointer === event.pointerId) stop(true)
  }

  function suppressClick(event: MouseEvent<HTMLDivElement>) {
    if (event.detail === 0 || (event.target as Element).closest('button') !== clickedSource.current) return
    clickedSource.current = undefined
    event.stopPropagation()
    event.preventDefault()
  }

  return {begin, move, finish, cancel, stop, preview, suppressClick}
}
