import { useCallback, useState } from 'react'
import './App.css'
import { ContextMenu } from './components/Editor/ContextMenu'
import { Editor } from './components/Editor/Editor'
import { Toolbar } from './components/Editor/Toolbar'
import { useGoWriteEditor } from './components/Editor/useGoWriteEditor'
import { Header } from './components/Header/Header'
import { MobileSupportButton } from './components/Header/MobileSupportButton'
import { SettingsModal, type SettingsTab } from './components/Settings/SettingsModal'
import { SummaryModal } from './components/SummaryModal'
import { useAiConnection } from './hooks/useAiConnection'
import { useAiTools } from './hooks/useAiTools'
import { useAutocomplete } from './hooks/useAutocomplete'
import { useDocuments } from './hooks/useDocuments'
import { useDragAndDrop } from './hooks/useDragAndDrop'
import { useEditorPrefs } from './hooks/useEditorPrefs'
import { useI18n } from './hooks/useI18n'
import { useLastAiEdit } from './hooks/useLastAiEdit'
import { useTheme } from './hooks/useTheme'
import { useViewportInsets } from './hooks/useViewportInsets'
import { exportAs, formatRegistry, importFile } from './lib/formats'
import type { TranslationKey } from './lib/i18n/translations'
import type { SummaryRequest } from './components/SummaryModal'
import type { FormatId } from './types'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>('general')
  const [summaryRequest, setSummaryRequest] = useState<SummaryRequest | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  const { t } = useI18n()
  const { theme, toggleTheme } = useTheme()
  const ai = useAiConnection()
  const tools = useAiTools()
  const editorPrefs = useEditorPrefs()
  const editor = useGoWriteEditor(() => {}, t('editor.placeholder'))
  const docs = useDocuments(editor)
  const lastAiEdit = useLastAiEdit(editor)

  useAutocomplete(editor, ai, tools.config.autocomplete, lastAiEdit.record)
  useViewportInsets()

  const [importing, setImporting] = useState(false)

  const handleImportFile = useCallback(
    async (file: File) => {
      if (!editor) return
      setImporting(true)
      try {
        await importFile(file, editor)
        docs.importAsCurrent(file.name)
        setImportError(null)
      } catch (err) {
        setImportError((err as Error).message)
      } finally {
        setImporting(false)
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

  ;(window as unknown as { __gwEditor?: unknown }).__gwEditor = editor
  ;(window as unknown as { __gwAi?: unknown }).__gwAi = ai

  const openSettings = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab)
    setSettingsOpen(true)
  }, [])

  const openSummary = useCallback((text: string, titleKey: TranslationKey) => {
    setSettingsOpen(false)
    setSummaryRequest({ text, titleKey })
  }, [])

  return (
    <div className="app-shell">
      <Header
        filename={docs.currentFilename}
        onRename={docs.rename}
        onImport={handleImportFile}
        onExport={handleExport}
        onOpenSettings={() => openSettings('general')}
        onOpenAiSettings={() => openSettings('ai')}
        ai={ai}
        autocompleteEnabled={tools.config.autocomplete.enabled}
        docs={docs}
      />

      <Toolbar editor={editor} quickFormatDelayMs={editorPrefs.config.quickFormatDelayMs} />
      <MobileSupportButton />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        theme={theme}
        onToggleTheme={toggleTheme}
        docs={docs}
        ai={ai}
        tools={tools}
        editorPrefs={editorPrefs}
      />

      <SummaryModal request={summaryRequest} onClose={() => setSummaryRequest(null)} ai={ai} />

      <ContextMenu editor={editor} ai={ai} onOpenSummary={openSummary} onAiInsertion={lastAiEdit.record} />

      <main className="app-main" ref={containerRef}>
        {importError && (
          <div className="import-error" role="alert">
            ⚠️ {importError}
            <button type="button" onClick={() => setImportError(null)} aria-label={t('app.importErrorDismiss')}>✕</button>
          </div>
        )}
        <Editor editor={editor} isDragOver={isDragOver} isLoading={importing || !docs.ready} />
        {lastAiEdit.hasUndo && (
          <button type="button" className="undo-ai-btn" onClick={lastAiEdit.undo}>
            {t('editor.undoAi')}
          </button>
        )}
      </main>
    </div>
  )
}
