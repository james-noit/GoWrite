import TiptapImage from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageView } from './ImageView'

/** Extends the base image node with resize/align/border/caption attributes, all persisted as
 * plain HTML attributes on the <img> so they round-trip through getHTML()/setContent() and
 * through tiptap-markdown's default image serializer without any extra wiring. */
export const Image = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const style = (el as HTMLElement).style.width
          if (style) return parseInt(style, 10) || null
          const attr = el.getAttribute('width')
          return attr ? parseInt(attr, 10) || null : null
        },
        renderHTML: (attrs) => (attrs.width ? { style: `width: ${attrs.width}px` } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs.align || 'center' }),
      },
      bordered: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-bordered') === 'true',
        renderHTML: (attrs) => ({ 'data-bordered': attrs.bordered ? 'true' : 'false' }),
      },
      caption: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-caption'),
        renderHTML: (attrs) => (attrs.caption ? { 'data-caption': attrs.caption } : {}),
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}
