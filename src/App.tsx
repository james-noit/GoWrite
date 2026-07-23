import { useCallback, useState } from 'react'
import './App.css'
import { Editor } from './components/Editor/Editor'
import { Toolbar } from './components/Editor/Toolbar'
import { useGoWriteEditor } from './components/Editor/useGoWriteEditor'
import { AiPanel } from './components/Header/AiPanel'
import { Header } from './components/Header/Header'
import { SummaryModal } from './components/SummaryModal'
import { useAiConnection } from './hooks/useAiConnection'
import { useAiTools } from './hooks/useAiTools'
import { useAutocomplete } from './hooks/useAutocomplete'
import { useDocuments } from './hooks/useDocuments'
import { useDragAndDrop } from './hooks/useDragAndDrop'
import { useI18n } from './hooks/useI18n'
import { useLastAiEdit } from './hooks/useLastAiEdit'
import { useTheme } from './hooks/useTheme'
import { exportAs, formatRegistry, importFile } from './lib/formats'
import type { FormatId } from './types'

export default function App() {
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const ai = useAiConnection()
  const tools = useAiTools()
  const editor = useGoWriteEditor(() => {}, t('editor.placeholder'))
  const docs = useDocuments(editor)
  const lastAiEdit = useLastAiEdit(editor)

  useAutocomplete(editor, ai, tools.config.autocomplete, lastAiEdit.record)

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!editor) return
      try {
        await importFile(file, editor)
        docs.importAsCurrent(file.name)
        setImportError(null)
      } catch (err) {
        setImportError((err as Error).message)
      }
    },
    [editor, docs],
  )

  const handleExport = useCallback(
    (formatId: FormatId) => {
      if (!editor) return
      void exportAs(formatRegistry[formatId], editor, docs.currentFilename)
    },
    [editor, docs.currentFilename],
  )

  const { containerRef, isDragOver } = useDragAndDrop(handleImportFile)

  return (
    <div className="app-shell">
      <Header
        filename={docs.currentFilename}
        onRename={docs.rename}
        onImport={handleImportFile}
        onExport={handleExport}
        theme={theme}
        onToggleTheme={toggleTheme}
        ai={ai}
        aiPanelOpen={aiPanelOpen}
        onToggleAiPanel={() => setAiPanelOpen((v) => !v)}
        docs={docs}
      />

      <Toolbar editor={editor} />

      <AiPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        editor={editor}
        ai={ai}
        tools={tools}
        onOpenSummary={() => {
          setAiPanelOpen(false)
          setSummaryOpen(true)
        }}
        onAiInsertion={lastAiEdit.record}
      />

      <SummaryModal open={summaryOpen} onClose={() => setSummaryOpen(false)} editor={editor} ai={ai} />

      <main className="app-main" ref={containerRef}>
        {importError && (
          <div className="import-error" role="alert">
            ⚠️ {importError}
            <button type="button" onClick={() => setImportError(null)} aria-label={t('app.importErrorDismiss')}>✕</button>
          </div>
        )}
        <Editor editor={editor} isDragOver={isDragOver} />
        {lastAiEdit.hasUndo && (
          <button type="button" className="undo-ai-btn" onClick={lastAiEdit.undo}>
            {t('editor.undoAi')}
          </button>
        )}
      </main>
    </div>
  )
}
