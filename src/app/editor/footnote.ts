import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

/**
 * Footnotes: a `footnoteReference` inline atom in the main flow (rendered as a small superscript
 * marker) paired by `id` with a `footnoteItem` living inside a single `footnotes` section appended
 * at the end of the document. Both node types render their own static HTML/CSS (theme.css); the
 * only dynamic part — which number each pair shows — comes from `footnoteNumberingPlugin` below,
 * which counts `footnoteReference` occurrences in document order and stamps the resulting number
 * onto both the reference and its matching item as a `data-number` attribute (read by a CSS
 * `content: attr(data-number)` rule) via decorations, so no per-node NodeView/update() wiring is
 * needed just to keep numbers in sync as footnotes are added, removed or reordered.
 */

function generateFootnoteId(): string {
  return `fn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Ref id -> its 1-based number, in the order references first appear in the main document flow
 * (the `footnotes` section itself is skipped so an id's number always comes from its reference,
 * never from item order, which could differ after reordering/undo). */
function computeFootnoteNumbers(doc: ProseMirrorNode): Map<string, number> {
  const numbers = new Map<string, number>();
  doc.descendants((node) => {
    if (node.type.name === 'footnotes') return false;
    if (node.type.name === 'footnoteReference') {
      const id = node.attrs['id'] as string;
      if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
    }
    return true;
  });
  return numbers;
}

const footnoteNumberingKey = new PluginKey('footnoteNumbering');

const footnoteNumberingPlugin = new Plugin({
  key: footnoteNumberingKey,
  props: {
    decorations(state) {
      const numbers = computeFootnoteNumbers(state.doc);
      if (numbers.size === 0) return null;
      const decorations: Decoration[] = [];
      state.doc.descendants((node, pos) => {
        if (node.type.name === 'footnoteReference' || node.type.name === 'footnoteItem') {
          const number = numbers.get(node.attrs['id'] as string);
          if (number != null) {
            decorations.push(Decoration.node(pos, pos + node.nodeSize, { 'data-number': String(number) }));
          }
        }
        return true;
      });
      return DecorationSet.create(state.doc, decorations);
    },
    handleClickOn(view, pos, node) {
      if (node.type.name !== 'footnoteReference') return false;
      const id = node.attrs['id'] as string;
      const target = view.dom.querySelector<HTMLElement>(`.footnote-item[data-footnote-id="${CSS.escape(id)}"]`);
      if (!target) return false;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('is-flash');
      window.setTimeout(() => target.classList.remove('is-flash'), 900);
      return true;
    },
  },
});

export const FootnoteReference = Node.create({
  name: 'footnoteReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return { id: { default: null, parseHTML: (el) => el.getAttribute('data-footnote-id') } };
  },

  parseHTML() {
    return [{ tag: 'sup.footnote-ref[data-footnote-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sup', mergeAttributes(HTMLAttributes, { class: 'footnote-ref', 'data-footnote-id': HTMLAttributes['id'], contenteditable: 'false' })];
  },
});

export const FootnoteItem = Node.create({
  name: 'footnoteItem',
  content: 'paragraph+',
  defining: true,

  addAttributes() {
    return { id: { default: null, parseHTML: (el) => el.getAttribute('data-footnote-id') } };
  },

  parseHTML() {
    return [{ tag: 'div.footnote-item[data-footnote-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'footnote-item', 'data-footnote-id': HTMLAttributes['id'] }), 0];
  },
});

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    footnotes: {
      insertFootnote: () => ReturnType;
    };
  }
}

export const Footnotes = Node.create({
  name: 'footnotes',
  group: 'block',
  content: 'footnoteItem+',
  isolating: true,
  defining: true,

  parseHTML() {
    return [{ tag: 'section.footnotes' }];
  },

  renderHTML() {
    return ['section', { class: 'footnotes' }, 0];
  },

  addProseMirrorPlugins() {
    return [footnoteNumberingPlugin];
  },

  addCommands() {
    return {
      insertFootnote:
        () =>
        ({ state, dispatch, editor }) => {
          // A footnote's own text is a normal editable paragraph, so without this guard clicking
          // "insert footnote" while still typing inside one would insert a *nested* reference into
          // that footnote's own content instead of the main flow — invisible and uncounted, since
          // computeFootnoteNumbers deliberately doesn't descend into `footnotes` (see its comment).
          for (let depth = state.selection.$from.depth; depth >= 0; depth--) {
            if (state.selection.$from.node(depth).type.name === 'footnotes') return false;
          }
          if (!dispatch) return true;
          const { schema } = state;
          const id = generateFootnoteId();

          let tr = state.tr.replaceSelectionWith(schema.nodes['footnoteReference'].create({ id }), false);

          let footnotesPos: number | null = null;
          let footnotesNode: ProseMirrorNode | null = null;
          tr.doc.forEach((node, offset) => {
            if (node.type.name === 'footnotes') {
              footnotesPos = offset;
              footnotesNode = node;
            }
          });

          const newItem = schema.nodes['footnoteItem'].create({ id }, schema.nodes['paragraph'].create());
          let focusPos: number;

          if (footnotesNode !== null && footnotesPos !== null) {
            const insertPos = footnotesPos + (footnotesNode as ProseMirrorNode).nodeSize - 1;
            tr = tr.insert(insertPos, newItem);
            focusPos = insertPos + 2;
          } else {
            const endPos = tr.doc.content.size;
            tr = tr.insert(endPos, schema.nodes['footnotes'].create(null, newItem));
            focusPos = endPos + 3;
          }

          tr.setSelection(TextSelection.near(tr.doc.resolve(focusPos)));
          dispatch(tr.scrollIntoView());
          window.setTimeout(() => editor.view.focus(), 0);
          return true;
        },
    };
  },
});

/** Bundles the three node types so callers only need to add one entry to the extension list. */
export const FootnoteExtensions = [FootnoteReference, FootnoteItem, Footnotes];

/** True when the document has at least one footnote — used to show export/format warnings. */
export function hasFootnotes(doc: ProseMirrorNode): boolean {
  let found = false;
  doc.descendants((node) => {
    if (node.type.name === 'footnoteReference') found = true;
    return !found;
  });
  return found;
}
