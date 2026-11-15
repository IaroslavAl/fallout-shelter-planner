import type { Room } from './model'

export type View = 'illustrated' | 'schematic'

const assetUrl = (name: string) => (import.meta.env?.BASE_URL ?? '/') + 'vault-art/' + name + '.webp'
export const roomImage = ({type, sections}: Pick<Room, 'type' | 'sections'>) => assetUrl(type + '-' + sections)
export const bedrock = assetUrl('bedrock')
export const stones = assetUrl('stones')
export const surface = assetUrl('surface')

export async function loadArt(urls: string[]) {
  const assets = new Map<string, HTMLImageElement>()
  await Promise.all([...new Set(urls)].map(async url => {
    const image = new Image()
    image.src = url
    try {
      await image.decode()
      assets.set(url, image)
    } catch { /* Keep the schematic fill if an image is unavailable. */ }
  }))
  return assets
}

export function paintArt(
  canvas: CanvasRenderingContext2D,
  image: HTMLImageElement | undefined,
  x: number, y: number, width: number, height: number,
) {
  if (!image) return false
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const sourceWidth = width / scale
  const sourceHeight = height / scale
  canvas.drawImage(image, (image.naturalWidth - sourceWidth) / 2, (image.naturalHeight - sourceHeight) / 2,
    sourceWidth, sourceHeight, x, y, width, height)
  return true
}
