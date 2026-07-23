import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface GhostSuggestionState {
  text: string
  pos: number
}

export interface GhostSuggestionStorage {
  onAccept: (() => void) | null
  onReject: (() => void) | null
}

const ghostKey = new PluginKey<GhostSuggestionState | null>('ghostSuggestion')

/**
 * Renders an inline "ghost" completion at the cursor: gray suggestion text followed by
 * accept (✓) / reject (✕) buttons. State is driven externally via showGhost/hideGhost;
 * any document change clears the suggestion automatically.
 */
export const GhostSuggestion = Extension.create<Record<string, never>, GhostSuggestionStorage>({
  name: 'ghostSuggestion',

  addStorage() {
    return { onAccept: null, onReject: null }
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!ghostKey.getState(this.editor.state)) return false
        this.storage.onAccept?.()
        return true
      },
      Escape: () => {
        if (!ghostKey.getState(this.editor.state)) return false
        this.storage.onReject?.()
        return true
      },
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    return [
      new Plugin<GhostSuggestionState | null>({
        key: ghostKey,
        state: {
          init: () => null,
          apply(tr, value) {
            const meta = tr.getMeta(ghostKey) as GhostSuggestionState | null | undefined
            if (meta !== undefined) return meta
            if (value && tr.docChanged) return null
            return value
          },
        },
        props: {
          decorations(state) {
            const ghost = ghostKey.getState(state)
            if (!ghost) return null
            const widget = Decoration.widget(
              ghost.pos,
              () => {
                const wrap = document.createElement('span')
                wrap.className = 'ghost-suggestion'
                wrap.contentEditable = 'false'

                const textEl = document.createElement('span')
                textEl.className = 'ghost-suggestion-text'
                textEl.textContent = ghost.text

                const accept = document.createElement('button')
                accept.type = 'button'
                accept.className = 'ghost-btn ghost-btn--accept'
                accept.title = 'Aceptar sugerencia'
                accept.textContent = '✓'
                accept.addEventListener('mousedown', (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  storage.onAccept?.()
                })

                const reject = document.createElement('button')
                reject.type = 'button'
                reject.className = 'ghost-btn ghost-btn--reject'
                reject.title = 'Rechazar sugerencia'
                reject.textContent = '✕'
                reject.addEventListener('mousedown', (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  storage.onReject?.()
                })

                wrap.append(textEl, accept, reject)
                return wrap
              },
              { side: 1 },
            )
            return DecorationSet.create(state.doc, [widget])
          },
        },
      }),
    ]
  },
})

export function getGhost(editor: Editor): GhostSuggestionState | null {
  return ghostKey.getState(editor.state) ?? null
}

export function showGhost(editor: Editor, text: string): void {
  const pos = editor.state.selection.head
  editor.view.dispatch(editor.state.tr.setMeta(ghostKey, { text, pos }))
}

export function hideGhost(editor: Editor): void {
  editor.view.dispatch(editor.state.tr.setMeta(ghostKey, null))
}

declare module '@tiptap/core' {
  interface Storage {
    ghostSuggestion: GhostSuggestionStorage
  }
}
