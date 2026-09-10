import type { Editor } from '@tiptap/core';

interface StoredFormat {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  highlightColor?: string;
}

let storedFormat: StoredFormat | null = null;
let currentEditor: Editor | null = null;
let selectionHandler: (() => void) | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

function detach() {
  if (currentEditor && selectionHandler) {
    currentEditor.off('selectionUpdate', selectionHandler);
  }
  currentEditor = null;
  selectionHandler = null;
}

/** Forces the target selection to exactly match the copied format: marks/attributes present in
 * the source are set, everything else is explicitly unset so leftover formatting on the target
 * doesn't survive the paste (matching how a format painter is expected to behave). */
function applyStoredFormat(editor: Editor) {
  if (!storedFormat) return;

  const chain = editor.chain().focus();

  storedFormat.bold ? chain.setMark('bold') : chain.unsetMark('bold');
  storedFormat.italic ? chain.setMark('italic') : chain.unsetMark('italic');
  storedFormat.underline ? chain.setMark('underline') : chain.unsetMark('underline');
  storedFormat.strike ? chain.setMark('strike') : chain.unsetMark('strike');

  if (storedFormat.color) chain.setColor(storedFormat.color);
  else chain.unsetColor();

  if (storedFormat.fontFamily) chain.setFontFamily(storedFormat.fontFamily);
  else chain.unsetFontFamily();

  if (storedFormat.fontSize) chain.setFontSize(storedFormat.fontSize);
  else chain.unsetFontSize();

  if (storedFormat.highlightColor) chain.setHighlight({ color: storedFormat.highlightColor });
  else chain.unsetHighlight();

  chain.run();
}

/** Ported from src/components/Editor/formatPainter.ts — a plain module-level singleton, same
 * pattern as ghost-suggestion.ts's ProseMirror plugin, unchanged (no Angular in this file at
 * all; Toolbar wraps it with a signal for template reactivity). */
export const formatPainter = {
  isActive: () => storedFormat !== null,

  /** Lets a component re-render whenever the active state flips, even when that happens outside
   * an editor transaction (e.g. deactivating via the toolbar button, which doesn't itself edit
   * the document). Returns an unsubscribe function. */
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Copies the formatting at the current selection and starts watching the editor: the next
   * (and every subsequent) non-empty selection made by the user gets that formatting applied
   * automatically, until `clear()` is called. */
  copyFormat: (editor: Editor) => {
    const textStyleAttrs = editor.getAttributes('textStyle');
    const highlightAttrs = editor.getAttributes('highlight');

    storedFormat = {
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      color: textStyleAttrs['color'] || undefined,
      fontFamily: textStyleAttrs['fontFamily'] || undefined,
      fontSize: textStyleAttrs['fontSize'] || undefined,
      highlightColor: highlightAttrs['color'] || undefined,
    };

    detach();
    currentEditor = editor;
    selectionHandler = () => {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      applyStoredFormat(editor);
    };
    editor.on('selectionUpdate', selectionHandler);
    notify();
  },

  clear: () => {
    detach();
    storedFormat = null;
    notify();
  },
};
