import type { JSONContent } from '@tiptap/core'

export interface StoredDocument {
  id: string
  filename: string
  content: JSONContent
  createdAt: number
  updatedAt: number
}

const DB_NAME = 'gowrite'
const DB_VERSION = 1
const STORE = 'documents'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('No se pudo abrir la base de datos local.'))
  })
  return dbPromise
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const request = run(tx.objectStore(STORE))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Error de base de datos local.'))
  })
}

export async function listDocuments(): Promise<StoredDocument[]> {
  const all = await withStore<StoredDocument[]>('readonly', (store) => store.getAll())
  return all.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getDocument(id: string): Promise<StoredDocument | undefined> {
  return withStore('readonly', (store) => store.get(id))
}

export async function putDocument(doc: StoredDocument): Promise<void> {
  await withStore('readwrite', (store) => store.put(doc))
}

export async function deleteDocument(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id))
}

export function newDocumentId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `doc-${Date.now()}-${Math.random().toString(36).slice(2)}`
}
