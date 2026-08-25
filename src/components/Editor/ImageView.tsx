import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'
import { useRef } from 'react'
import { useI18n } from '../../hooks/useI18n'
import { ImageAlignCenterIcon, ImageAlignLeftIcon, ImageAlignRightIcon, ImageBorderIcon, TrashIcon } from '../icons'

const MIN_WIDTH = 80

type Align = 'left' | 'center' | 'right'

/** Selecting the image reveals a small floating toolbar (align / border / remove) and a
 * bottom-right resize handle; a text input below doubles as the figure's legend. */
export function ImageView({ node, updateAttributes, selected, deleteNode }: ReactNodeViewProps) {
  const { t } = useI18n()
  const bodyRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  const src = node.attrs.src as string
  const alt = (node.attrs.alt as string | null) ?? ''
  const caption = (node.attrs.caption as string | null) ?? ''
  const width = node.attrs.width as number | null
  const align = ((node.attrs.align as Align | null) ?? 'center') as Align
  const bordered = !!node.attrs.bordered

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const startWidth = bodyRef.current?.getBoundingClientRect().width ?? width ?? 300
    dragRef.current = { startX: e.clientX, startWidth }

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return
      const delta = ev.clientX - dragRef.current.startX
      const next = Math.max(MIN_WIDTH, Math.round(dragRef.current.startWidth + delta))
      updateAttributes({ width: next })
    }
    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <NodeViewWrapper
      as="figure"
      className={`gw-image gw-image--${align}${bordered ? ' gw-image--bordered' : ''}${selected ? ' is-selected' : ''}`}
    >
      {selected && (
        <div className="gw-image-toolbar" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
          <button
            type="button"
            className={align === 'left' ? 'is-active' : ''}
            title={t('image.alignLeft')}
            aria-label={t('image.alignLeft')}
            aria-pressed={align === 'left'}
            onClick={() => updateAttributes({ align: 'left' })}
          >
            <ImageAlignLeftIcon />
          </button>
          <button
            type="button"
            className={align === 'center' ? 'is-active' : ''}
            title={t('image.alignCenter')}
            aria-label={t('image.alignCenter')}
            aria-pressed={align === 'center'}
            onClick={() => updateAttributes({ align: 'center' })}
          >
            <ImageAlignCenterIcon />
          </button>
          <button
            type="button"
            className={align === 'right' ? 'is-active' : ''}
            title={t('image.alignRight')}
            aria-label={t('image.alignRight')}
            aria-pressed={align === 'right'}
            onClick={() => updateAttributes({ align: 'right' })}
          >
            <ImageAlignRightIcon />
          </button>
          <span className="gw-image-toolbar-sep" aria-hidden="true" />
          <button
            type="button"
            className={bordered ? 'is-active' : ''}
            title={t('image.border')}
            aria-label={t('image.border')}
            aria-pressed={bordered}
            onClick={() => updateAttributes({ bordered: !bordered })}
          >
            <ImageBorderIcon />
          </button>
          <span className="gw-image-toolbar-sep" aria-hidden="true" />
          <button
            type="button"
            className="gw-image-toolbar-danger"
            title={t('image.remove')}
            aria-label={t('image.remove')}
            onClick={() => deleteNode()}
          >
            <TrashIcon />
          </button>
        </div>
      )}

      <div className="gw-image-body" ref={bodyRef} style={width ? { width: `${width}px` } : undefined} contentEditable={false}>
        <img src={src} alt={alt} draggable={false} />
        <span className="gw-image-resize-handle" onMouseDown={startResize} aria-hidden="true" />
      </div>

      <input
        type="text"
        className="gw-image-caption"
        placeholder={t('image.captionPlaceholder')}
        value={caption}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => updateAttributes({ caption: e.target.value || null })}
      />
    </NodeViewWrapper>
  )
}
