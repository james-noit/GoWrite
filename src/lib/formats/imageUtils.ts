import type { JSONContent } from '@tiptap/core'

export interface DecodedImage {
  mime: string
  bytes: Uint8Array
}

export function decodeDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) return null
  const [, mime, base64] = match
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return { mime, bytes }
}

export function extensionForMime(mime: string): string {
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('gif')) return 'gif'
  if (mime.includes('bmp')) return 'bmp'
  if (mime.includes('svg')) return 'svg'
  return 'png'
}

export interface ImageSize {
  width: number
  height: number
}

function loadImageSize(src: string): Promise<ImageSize> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 })
    img.onerror = () => resolve({ width: 300, height: 200 })
    img.src = src
  })
}

/** Walks the doc collecting every distinct image src, then resolves their natural pixel size
 * (needed by docx/odt, which require explicit width/height rather than "auto"). */
export async function collectImageSizes(json: JSONContent): Promise<Map<string, ImageSize>> {
  const srcs = new Set<string>()
  const walk = (node: JSONContent) => {
    if (node.type === 'image' && typeof node.attrs?.src === 'string') srcs.add(node.attrs.src)
    node.content?.forEach(walk)
  }
  walk(json)

  const sizes = new Map<string, ImageSize>()
  await Promise.all(
    Array.from(srcs).map(async (src) => {
      sizes.set(src, await loadImageSize(src))
    }),
  )
  return sizes
}

/** Scales natural size down to a target display width (capped so exported pages stay sane),
 * preserving aspect ratio. */
export function scaledSize(natural: ImageSize, requestedWidth: number | null | undefined, maxWidth = 600): ImageSize {
  const targetWidth = Math.min(requestedWidth ?? natural.width, maxWidth)
  const scale = natural.width > 0 ? targetWidth / natural.width : 1
  return { width: Math.round(targetWidth), height: Math.round(natural.height * scale) }
}
