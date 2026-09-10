import type { NodeViewRendererProps } from '@tiptap/core';
import TiptapImage from '@tiptap/extension-image';
import { effect, runInInjectionContext, type Injector } from '@angular/core';
import type { I18nService } from '../core/i18n/i18n.service';
import type { TranslationKey } from '../core/i18n/translations';
import { createIcon } from '../icons';

const MIN_WIDTH = 80;
type Align = 'left' | 'center' | 'right';

export interface ImageNodeViewDeps {
  i18n: I18nService | null;
  injector: Injector | null;
}

/** Selecting the image reveals a small floating toolbar (align / border / remove) and a
 * bottom-right resize handle; a text input below doubles as the figure's legend.
 *
 * Ported from src/components/Editor/ImageView.tsx: the original is a React node view
 * (`ReactNodeViewRenderer`) built with JSX event handlers and a `useI18n()` hook; this is
 * Tiptap's vanilla NodeView API with plain DOM, since the app no longer renders through React.
 * i18n reactivity (button labels updating when the locale changes) is reproduced via an Angular
 * `effect()` run in the injection context passed through `deps.injector` — vanilla NodeViews have
 * no Angular DI of their own, so the Image/CodeBlock extensions need to be `.configure()`d with
 * whatever injection context the editor was created in (see EditorService). Behavior is otherwise
 * unchanged. */
function imageNodeView(deps: ImageNodeViewDeps) {
  return ({ node, editor, getPos }: NodeViewRendererProps) => {
    let currentNode = node;

    const updateAttrs = (attrs: Record<string, unknown>) => {
      const pos = getPos();
      if (typeof pos !== 'number') return;
      editor.view.dispatch(
        editor.view.state.tr.setNodeMarkup(pos, undefined, { ...currentNode.attrs, ...attrs }),
      );
    };

    const figure = document.createElement('figure');

    const toolbar = document.createElement('div');
    toolbar.className = 'gw-image-toolbar';
    toolbar.contentEditable = 'false';
    toolbar.style.display = 'none';
    toolbar.addEventListener('mousedown', (e) => e.preventDefault());

    function makeButton(icon: Parameters<typeof createIcon>[0]): HTMLButtonElement {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.appendChild(createIcon(icon));
      return btn;
    }

    const alignLeftBtn = makeButton('imageAlignLeft');
    alignLeftBtn.addEventListener('click', () => updateAttrs({ align: 'left' }));
    const alignCenterBtn = makeButton('imageAlignCenter');
    alignCenterBtn.addEventListener('click', () => updateAttrs({ align: 'center' }));
    const alignRightBtn = makeButton('imageAlignRight');
    alignRightBtn.addEventListener('click', () => updateAttrs({ align: 'right' }));

    const sep1 = document.createElement('span');
    sep1.className = 'gw-image-toolbar-sep';
    sep1.setAttribute('aria-hidden', 'true');

    const borderBtn = makeButton('imageBorder');
    borderBtn.addEventListener('click', () => updateAttrs({ bordered: !currentNode.attrs['bordered'] }));

    const sep2 = document.createElement('span');
    sep2.className = 'gw-image-toolbar-sep';
    sep2.setAttribute('aria-hidden', 'true');

    const removeBtn = makeButton('trash');
    removeBtn.classList.add('gw-image-toolbar-danger');
    removeBtn.addEventListener('click', () => {
      const pos = getPos();
      if (typeof pos !== 'number') return;
      editor.view.dispatch(editor.view.state.tr.delete(pos, pos + currentNode.nodeSize));
    });

    toolbar.append(alignLeftBtn, alignCenterBtn, alignRightBtn, sep1, borderBtn, sep2, removeBtn);

    const body = document.createElement('div');
    body.className = 'gw-image-body';
    body.contentEditable = 'false';

    const img = document.createElement('img');
    img.draggable = false;

    const resizeHandle = document.createElement('span');
    resizeHandle.className = 'gw-image-resize-handle';
    resizeHandle.setAttribute('aria-hidden', 'true');

    let dragState: { startX: number; startWidth: number } | null = null;
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startWidth = body.getBoundingClientRect().width || (currentNode.attrs['width'] as number | null) || 300;
      dragState = { startX: e.clientX, startWidth };

      const onMove = (ev: MouseEvent) => {
        if (!dragState) return;
        const delta = ev.clientX - dragState.startX;
        const next = Math.max(MIN_WIDTH, Math.round(dragState.startWidth + delta));
        updateAttrs({ width: next });
      };
      const onUp = () => {
        dragState = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });

    body.append(img, resizeHandle);

    const captionInput = document.createElement('input');
    captionInput.type = 'text';
    captionInput.className = 'gw-image-caption';
    captionInput.addEventListener('mousedown', (e) => e.stopPropagation());
    captionInput.addEventListener('input', () => updateAttrs({ caption: captionInput.value || null }));

    figure.append(toolbar, body, captionInput);

    function applyNode(n: typeof node) {
      currentNode = n;
      const src = n.attrs['src'] as string;
      const alt = (n.attrs['alt'] as string | null) ?? '';
      const caption = (n.attrs['caption'] as string | null) ?? '';
      const width = n.attrs['width'] as number | null;
      const align = ((n.attrs['align'] as Align | null) ?? 'center') as Align;
      const bordered = !!n.attrs['bordered'];

      img.src = src;
      img.alt = alt;
      if (document.activeElement !== captionInput && captionInput.value !== caption) captionInput.value = caption;
      body.style.width = width ? `${width}px` : '';

      figure.className = `gw-image gw-image--${align}${bordered ? ' gw-image--bordered' : ''}`;
      alignLeftBtn.classList.toggle('is-active', align === 'left');
      alignCenterBtn.classList.toggle('is-active', align === 'center');
      alignRightBtn.classList.toggle('is-active', align === 'right');
      alignLeftBtn.setAttribute('aria-pressed', String(align === 'left'));
      alignCenterBtn.setAttribute('aria-pressed', String(align === 'center'));
      alignRightBtn.setAttribute('aria-pressed', String(align === 'right'));
      borderBtn.classList.toggle('is-active', bordered);
      borderBtn.setAttribute('aria-pressed', String(bordered));
    }
    applyNode(node);

    function applyLabels() {
      const t = (key: TranslationKey) => (deps.i18n ? deps.i18n.t(key) : key);
      for (const [btn, key] of [
        [alignLeftBtn, 'image.alignLeft'],
        [alignCenterBtn, 'image.alignCenter'],
        [alignRightBtn, 'image.alignRight'],
        [borderBtn, 'image.border'],
        [removeBtn, 'image.remove'],
      ] as const) {
        const label = t(key);
        btn.title = label;
        btn.setAttribute('aria-label', label);
      }
      captionInput.placeholder = t('image.captionPlaceholder');
    }
    applyLabels();

    let localeEffect: { destroy: () => void } | null = null;
    if (deps.i18n && deps.injector) {
      const i18n = deps.i18n;
      localeEffect = runInInjectionContext(deps.injector, () =>
        effect(() => {
          i18n.locale();
          applyLabels();
        }),
      );
    }

    return {
      dom: figure,
      update: (updatedNode: typeof node) => {
        if (updatedNode.type !== node.type) return false;
        applyNode(updatedNode);
        return true;
      },
      selectNode: () => {
        figure.classList.add('is-selected');
        toolbar.style.display = '';
      },
      deselectNode: () => {
        figure.classList.remove('is-selected');
        toolbar.style.display = 'none';
      },
      destroy: () => {
        localeEffect?.destroy();
      },
      stopEvent: (event: Event) => {
        const target = event.target as Node;
        return toolbar.contains(target) || target === captionInput;
      },
    };
  };
}

/** Extends the base image node with resize/align/border/caption attributes, all persisted as
 * plain HTML attributes on the <img> so they round-trip through getHTML()/setContent() and
 * through tiptap-markdown's default image serializer without any extra wiring. */
export const Image = TiptapImage.extend<{ deps: ImageNodeViewDeps }>({
  addOptions() {
    return {
      ...this.parent!(),
      // Every image the app inserts (paste, file picker, AI-generated) is a data: URL — the base
      // extension's default (false) exists to block data: URIs from arbitrary pasted/untrusted
      // HTML, but here it silently dropped every image on re-import of the app's own HTML export
      // (and of Markdown/ODT content carrying embedded HTML), which is strictly worse. Fixed
      // during the React->Angular migration's Phase 1 safety net — see
      // docs/angular-migration-plan.md §6.
      allowBase64: true,
      deps: { i18n: null, injector: null },
    };
  },
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const style = (el as HTMLElement).style.width;
          if (style) return parseInt(style, 10) || null;
          const attr = el.getAttribute('width');
          return attr ? parseInt(attr, 10) || null : null;
        },
        renderHTML: (attrs) => (attrs['width'] ? { style: `width: ${attrs['width']}px` } : {}),
      },
      align: {
        default: 'center',
        parseHTML: (el) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs) => ({ 'data-align': attrs['align'] || 'center' }),
      },
      bordered: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-bordered') === 'true',
        renderHTML: (attrs) => ({ 'data-bordered': attrs['bordered'] ? 'true' : 'false' }),
      },
      caption: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-caption'),
        renderHTML: (attrs) => (attrs['caption'] ? { 'data-caption': attrs['caption'] } : {}),
      },
    };
  },
  addNodeView() {
    return imageNodeView(this.options.deps);
  },
});

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(file);
  });
}
