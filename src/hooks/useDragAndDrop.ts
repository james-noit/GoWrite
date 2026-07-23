import { useEffect, useRef, useState } from 'react'

export function useDragAndDrop(onDropFile: (file: File) => void) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  useEffect(() => {
    const node = containerRef.current
    if (!node) return

    let dragDepth = 0

    const isFileDrag = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

    const onDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragDepth += 1
      setIsDragOver(true)
    }
    const onDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
    }
    const onDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragDepth = Math.max(0, dragDepth - 1)
      if (dragDepth === 0) setIsDragOver(false)
    }
    const onDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return
      e.preventDefault()
      dragDepth = 0
      setIsDragOver(false)
      const file = e.dataTransfer?.files?.[0]
      if (file) onDropFile(file)
    }

    node.addEventListener('dragenter', onDragEnter)
    node.addEventListener('dragover', onDragOver)
    node.addEventListener('dragleave', onDragLeave)
    node.addEventListener('drop', onDrop)

    return () => {
      node.removeEventListener('dragenter', onDragEnter)
      node.removeEventListener('dragover', onDragOver)
      node.removeEventListener('dragleave', onDragLeave)
      node.removeEventListener('drop', onDrop)
    }
  }, [onDropFile])

  return { containerRef, isDragOver }
}
