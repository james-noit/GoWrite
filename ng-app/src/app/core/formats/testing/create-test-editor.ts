import { Editor } from '@tiptap/core';
import { buildEditorExtensions } from '../../../editor/editor-extensions';

/** A headless Tiptap editor with the app's real extension set (see editor-extensions.ts) for
 * exercising format import/export in tests — no Angular DI needed, since format round-tripping
 * doesn't touch the Image NodeView's i18n-reactive toolbar (that only matters for the on-screen
 * mini-toolbar, not the node's schema/attributes/serialization). Keeping this on the *same*
 * extension-building function EditorService uses (rather than a second hand-maintained list) is
 * what makes these tests actually cover the real editor — see editor-extensions.ts's doc comment
 * for why that matters. */
export function createTestEditor(): Editor {
  return new Editor({
    extensions: buildEditorExtensions({ placeholder: '', imageDeps: { i18n: null, injector: null } }),
  });
}

export function fileFrom(blob: Blob, filename: string, type: string): File {
  return new File([blob], filename, { type });
}
