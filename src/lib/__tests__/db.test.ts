import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { deleteDocument, listDocuments, newDocumentId, putDocument } from '../db'

const emptyDoc = { type: 'doc', content: [{ type: 'paragraph' }] }

describe('lib/db (IndexedDB document store)', () => {
  beforeEach(async () => {
    // fake-indexeddb keeps state across tests in the same process; start each test from a clean slate.
    for (const doc of await listDocuments()) {
      await deleteDocument(doc.id)
    }
  })

  it('starts empty', async () => {
    expect(await listDocuments()).toEqual([])
  })

  it('stores and retrieves a document', async () => {
    const id = newDocumentId()
    const now = Date.now()
    await putDocument({ id, filename: 'a.md', content: emptyDoc, createdAt: now, updatedAt: now })

    const all = await listDocuments()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id, filename: 'a.md' })
  })

  it('lists documents most-recently-updated first', async () => {
    const now = Date.now()
    await putDocument({ id: 'older', filename: 'older.md', content: emptyDoc, createdAt: now, updatedAt: now })
    await putDocument({ id: 'newer', filename: 'newer.md', content: emptyDoc, createdAt: now, updatedAt: now + 1000 })

    const all = await listDocuments()
    expect(all.map((d) => d.id)).toEqual(['newer', 'older'])
  })

  it('overwrites a document with the same id', async () => {
    const id = newDocumentId()
    const now = Date.now()
    await putDocument({ id, filename: 'first.md', content: emptyDoc, createdAt: now, updatedAt: now })
    await putDocument({ id, filename: 'renamed.md', content: emptyDoc, createdAt: now, updatedAt: now + 1 })

    const all = await listDocuments()
    expect(all).toHaveLength(1)
    expect(all[0].filename).toBe('renamed.md')
  })

  it('deletes a document', async () => {
    const id = newDocumentId()
    const now = Date.now()
    await putDocument({ id, filename: 'gone.md', content: emptyDoc, createdAt: now, updatedAt: now })
    expect(await listDocuments()).toHaveLength(1)

    await deleteDocument(id)
    expect(await listDocuments()).toHaveLength(0)
  })

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 100 }, () => newDocumentId()))
    expect(ids.size).toBe(100)
  })
})
