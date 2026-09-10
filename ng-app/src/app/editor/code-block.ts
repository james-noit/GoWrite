import CodeBlock from '@tiptap/extension-code-block';
import type { NodeViewRendererProps } from '@tiptap/core';

/** Small language-tag input rendered inside every code block. Setting it fills the node's
 * `language` attribute, which `tiptap-markdown` already uses to write ` ```lang ` fences on
 * export — this view is the only piece needed for markdown code blocks to come out coloured.
 *
 * Ported from src/components/Editor/CodeBlockView.tsx: the original is a React node view
 * (`ReactNodeViewRenderer`); this is Tiptap's vanilla NodeView API instead, since the app no
 * longer renders through React. Behavior is unchanged. */
function codeBlockNodeView({ node, editor, getPos }: NodeViewRendererProps) {
  const dom = document.createElement('div');
  dom.className = 'code-block-view';

  const langInput = document.createElement('input');
  langInput.type = 'text';
  langInput.className = 'code-block-lang';
  langInput.placeholder = 'lang';
  langInput.spellcheck = false;
  langInput.contentEditable = 'false';
  langInput.value = (node.attrs['language'] as string | null) ?? '';
  langInput.addEventListener('mousedown', (e) => e.stopPropagation());
  langInput.addEventListener('input', () => {
    const pos = getPos();
    if (typeof pos !== 'number') return;
    editor.view.dispatch(
      editor.view.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        language: langInput.value || null,
      }),
    );
  });

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.appendChild(code);
  dom.append(langInput, pre);

  return {
    dom,
    contentDOM: code,
    update: (updatedNode: typeof node) => {
      if (updatedNode.type !== node.type) return false;
      const lang = (updatedNode.attrs['language'] as string | null) ?? '';
      if (langInput.value !== lang) langInput.value = lang;
      return true;
    },
  };
}

export const CodeBlockWithLanguageInput = CodeBlock.extend({
  addNodeView() {
    return codeBlockNodeView;
  },
});
