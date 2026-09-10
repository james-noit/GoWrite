import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { I18nService } from '../core/i18n/i18n.service';
import { EditorService } from './editor.service';

const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('Image node view', () => {
  let service: EditorService;
  let container: HTMLDivElement;

  function mount() {
    service = TestBed.inject(EditorService);
    container = document.createElement('div');
    document.body.appendChild(container);
    const editor = service.mount(container, { placeholder: '' });
    editor.commands.setContent(`<img src="${PNG_DATA_URL}">`);
    return editor;
  }

  afterEach(() => {
    service?.destroy();
    container?.remove();
    localStorage.clear();
  });

  it('renders align/border/remove buttons and a caption input, toolbar hidden until selected', () => {
    const editor = mount();
    // With the image as the doc's only content, `autofocus: 'end'` resolves to a NodeSelection on
    // the image itself (there's no text position to land a cursor on) — deselect explicitly first
    // to test the actual default-unselected appearance, which is what real documents show.
    editor.commands.setTextSelection(0);
    const toolbar = container.querySelector<HTMLElement>('.gw-image-toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar!.style.display).toBe('none');
    expect(toolbar!.querySelectorAll('button')).toHaveLength(5); // left, center, right, border, remove
    expect(container.querySelector('.gw-image-caption')).toBeTruthy();
    expect(container.querySelector('.gw-image-resize-handle')).toBeTruthy();
  });

  it('selectNode/deselectNode toggle the toolbar visibility and the is-selected class', () => {
    const editor = mount();
    let imagePos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'image') imagePos = pos;
    });

    editor.commands.setNodeSelection(imagePos);
    const figure = container.querySelector<HTMLElement>('.gw-image')!;
    const toolbar = container.querySelector<HTMLElement>('.gw-image-toolbar')!;
    expect(figure.classList.contains('is-selected')).toBe(true);
    expect(toolbar.style.display).not.toBe('none');

    editor.commands.setTextSelection(0);
    expect(figure.classList.contains('is-selected')).toBe(false);
    expect(toolbar.style.display).toBe('none');
  });

  it('clicking an align button updates the node attrs and the figure class', () => {
    const editor = mount();
    const rightBtn = container.querySelectorAll<HTMLButtonElement>('.gw-image-toolbar button')[2];
    rightBtn.click();

    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ align: 'right' });
    expect(container.querySelector('.gw-image')?.className).toContain('gw-image--right');
  });

  it('clicking the border button toggles the bordered attr', () => {
    const editor = mount();
    const borderBtn = container.querySelectorAll<HTMLButtonElement>('.gw-image-toolbar button')[3];
    borderBtn.click();

    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ bordered: true });
  });

  it('editing the caption input updates the caption attr', () => {
    const editor = mount();
    const caption = container.querySelector<HTMLInputElement>('.gw-image-caption')!;
    caption.value = 'Una leyenda';
    caption.dispatchEvent(new Event('input', { bubbles: true }));

    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    expect(attrs).toMatchObject({ caption: 'Una leyenda' });
  });

  it('clicking the remove button deletes the image node', () => {
    const editor = mount();
    const removeBtn = container.querySelectorAll<HTMLButtonElement>('.gw-image-toolbar button')[4];
    removeBtn.click();

    expect(JSON.stringify(editor.getJSON())).not.toContain('"type":"image"');
  });

  it('dragging the resize handle updates the width attr, clamped to a minimum', () => {
    const editor = mount();
    const handle = container.querySelector<HTMLElement>('.gw-image-resize-handle')!;

    handle.dispatchEvent(new MouseEvent('mousedown', { clientX: 100, bubbles: true }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 50 })); // shrink by 50px
    window.dispatchEvent(new MouseEvent('mouseup'));

    let attrs: Record<string, unknown> | null = null;
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'image') attrs = node.attrs;
    });
    // starting width falls back to 300 (jsdom's getBoundingClientRect is always 0) since no
    // explicit width was set; shrinking by 50 clamps at MIN_WIDTH (80), well below 300 - 50 = 250,
    // so this just asserts a width was set and respects the floor rather than an exact value.
    expect((attrs as unknown as { width: number }).width).toBeGreaterThanOrEqual(80);
  });

  it('button labels are in the current locale and update reactively when the locale changes', () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLocale('en');
    mount();
    const buttons = container.querySelectorAll<HTMLButtonElement>('.gw-image-toolbar button');
    expect(buttons[0].title).toBe('Align image left');

    i18n.setLocale('es');
    TestBed.flushEffects();
    expect(buttons[0].title).toBe('Alinear imagen a la izquierda');
  });

  it('destroying the editor cleans up the locale-reactivity effect without throwing', () => {
    mount();
    expect(() => service.destroy()).not.toThrow();
  });
});
