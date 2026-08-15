import type { Editor } from '@tiptap/core'
import { useCallback, useEffect, useRef, useState } from 'react'
import { deleteDocument, listDocuments, newDocumentId, putDocument, type StoredDocument } from '../lib/db'
import { documentStorage } from '../lib/storage'

const EMPTY_DOC_CONTENT = { type: 'doc', content: [{ type: 'paragraph' }] }
const DEFAULT_FILENAME = 'Documento sin título.md'

function sortByRecent(docs: StoredDocument[]): StoredDocument[] {
  return [...docs].sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Multi-document store backed by IndexedDB. On first run it migrates the old single-document
 * localStorage snapshot (if any) into the first IndexedDB record, then localStorage is only used
 * as a tiny pointer-free cache of the id list — the documents themselves live in IndexedDB.
 */
export function useDocuments(editor: Editor | null) {
  const [documents, setDocuments] = useState<StoredDocument[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const currentRef = useRef<StoredDocument | null>(null)
  const initStarted = useRef(false)

  useEffect(() => {
    currentRef.current = documents.find((d) => d.id === currentId) ?? null
  }, [documents, currentId])

  // Initial load (+ one-time migration from the legacy single-document localStorage snapshot).
  // Guarded by a ref rather than a `cancelled`-on-cleanup flag: React 18 StrictMode's dev-mode
  // double-invoke runs this effect's cleanup before the async work finishes, so a cancellation
  // flag would discard the only load that was ever going to complete. The ref only needs to stop
  // a *second* copy of the migration from running, not stop this one from finishing.
  useEffect(() => {
    if (!editor || initStarted.current) return
    initStarted.current = true
    void (async () => {
      let docs = await listDocuments()
      if (docs.length === 0) {
        const legacy = documentStorage.get()
        const now = Date.now()
        const seed: StoredDocument = legacy
          ? { id: newDocumentId(), filename: legacy.filename, content: legacy.content, createdAt: now, updatedAt: legacy.updatedAt || now }
          : { id: newDocumentId(), filename: DEFAULT_FILENAME, content: EMPTY_DOC_CONTENT, createdAt: now, updatedAt: now }
        await putDocument(seed)
        docs = [seed]
      }
      const sorted = sortByRecent(docs)
      setDocuments(sorted)
      setCurrentId(sorted[0].id)
      editor.commands.setContent(sorted[0].content)
      setReady(true)
    })()
  }, [editor])

  // Debounced autosave of the current document's content.
  useEffect(() => {
    if (!editor || !ready) return
    let timeout: ReturnType<typeof setTimeout>
    const save = () => {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const current = currentRef.current
        if (!current) return
        const updated: StoredDocument = { ...current, content: editor.getJSON(), updatedAt: Date.now() }
        void putDocument(updated)
        setDocuments((prev) => sortByRecent(prev.map((d) => (d.id === updated.id ? updated : d))))
      }, 500)
    }
    editor.on('update', save)
    return () => {
      clearTimeout(timeout)
      editor.off('update', save)
    }
  }, [editor, ready])

  const rename = useCallback((filename: string) => {
    const current = currentRef.current
    if (!current) return
    const updated: StoredDocument = { ...current, filename, updatedAt: Date.now() }
    void putDocument(updated)
    setDocuments((prev) => sortByRecent(prev.map((d) => (d.id === updated.id ? updated : d))))
  }, [])

  const createNew = useCallback(() => {
    if (!editor) return
    const now = Date.now()
    const doc: StoredDocument = { id: newDocumentId(), filename: DEFAULT_FILENAME, content: EMPTY_DOC_CONTENT, createdAt: now, updatedAt: now }
    void putDocument(doc)
    setDocuments((prev) => sortByRecent([doc, ...prev]))
    setCurrentId(doc.id)
    editor.commands.setContent(doc.content)
  }, [editor])

  const openDocument = useCallback(
    (id: string) => {
      if (!editor) return
      const doc = documents.find((d) => d.id === id)
      if (!doc) return
      setCurrentId(id)
      editor.commands.setContent(doc.content)
    },
    [editor, documents],
  )

  const importAsCurrent = useCallback(
    (filename: string) => {
      const current = currentRef.current
      if (!editor || !current) return
      const updated: StoredDocument = { ...current, filename, content: editor.getJSON(), updatedAt: Date.now() }
      void putDocument(updated)
      setDocuments((prev) => sortByRecent(prev.map((d) => (d.id === updated.id ? updated : d))))
    },
    [editor],
  )

  /** Wipes the current document's saved content back to blank, keeping its id/filename in place. */
  const clearCurrentStorage = useCallback(() => {
    const current = currentRef.current
    if (!editor || !current) return
    const now = Date.now()
    const cleared: StoredDocument = { ...current, content: EMPTY_DOC_CONTENT, updatedAt: now }
    void putDocument(cleared)
    setDocuments((prev) => sortByRecent(prev.map((d) => (d.id === cleared.id ? cleared : d))))
    editor.commands.setContent(EMPTY_DOC_CONTENT)
  }, [editor])

  const removeDocument = useCallback(
    (id: string) => {
      void deleteDocument(id)
      setDocuments((prev) => {
        const remaining = prev.filter((d) => d.id !== id)
        if (id === currentId && editor) {
          if (remaining.length > 0) {
            setCurrentId(remaining[0].id)
            editor.commands.setContent(remaining[0].content)
          } else {
            const now = Date.now()
            const fresh: StoredDocument = { id: newDocumentId(), filename: DEFAULT_FILENAME, content: EMPTY_DOC_CONTENT, createdAt: now, updatedAt: now }
            void putDocument(fresh)
            setCurrentId(fresh.id)
            editor.commands.setContent(fresh.content)
            return [fresh]
          }
        }
        return remaining
      })
    },
    [currentId, editor],
  )

  const currentFilename = documents.find((d) => d.id === currentId)?.filename ?? DEFAULT_FILENAME

  return {
    documents,
    currentId,
    currentFilename,
    ready,
    rename,
    createNew,
    openDocument,
    importAsCurrent,
    removeDocument,
    clearCurrentStorage,
  }
}

export type UseDocuments = ReturnType<typeof useDocuments>
