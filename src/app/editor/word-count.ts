import type { Editor } from '@tiptap/core';

export interface WordCount {
  words: number;
  chars: number;
}

/** Ported from src/hooks/useWordCount.ts's countOf() helper. */
export function countOf(editor: Editor): WordCount {
  const text = editor.getText();
  const trimmed = text.trim();
  const words = trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
  return { words, chars: text.length };
}
