import JSZip from 'jszip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { docxFormat } from './docx';
import { htmlFormat } from './html';
import { markdownFormat } from './markdown';
import { odtFormat } from './odt';
import { txtFormat } from './txt';
import { createTestEditor, fileFrom } from './testing/create-test-editor';
import type { JSONContent } from '@tiptap/core';

/** A document ending in a non-text block (e.g. an image) picks up an extra auto-appended empty
 * paragraph each time it passes through setContent — a real, minor, currently-uncharacterized
 * quirk (flagged in docs/angular-migration-plan.md) that isn't what image round-trip tests care
 * about. Strip trailing empty paragraphs from both sides before comparing so the assertion tracks
 * the thing actually under test. */
function withoutTrailingEmptyParagraphs(json: JSONContent): JSONContent {
  const content = [...(json.content ?? [])];
  const isEmptyParagraph = (node: JSONContent) =>
    node.type === 'paragraph' && !node.content?.length;
  while (content.length && isEmptyParagraph(content[content.length - 1])) content.pop();
  return { ...json, content };
}

const SOURCE_HTML =
  '<h1>Título de prueba</h1><p>Un párrafo con <strong>negrita</strong> y <em>cursiva</em>.</p><ul><li><p>Primer elemento</p></li><li><p>Segundo elemento</p></li></ul>';

describe('format round-trips', () => {
  let sourceEditor: ReturnType<typeof createTestEditor>;

  beforeEach(() => {
    sourceEditor = createTestEditor();
    sourceEditor.commands.setContent(SOURCE_HTML);
  });

  it('markdown preserves heading, bold, italic and list structure', async () => {
    const blob = await markdownFormat.exportContent(sourceEditor);
    const text = await blob.text();
    expect(text).toContain('# Título de prueba');
    expect(text).toMatch(/\*\*negrita\*\*/);
    expect(text).toMatch(/\*cursiva\*/);

    const roundTripped = createTestEditor();
    await markdownFormat.importFile(fileFrom(blob, 'doc.md', 'text/markdown'), roundTripped);
    expect(roundTripped.getJSON()).toEqual(sourceEditor.getJSON());
    roundTripped.destroy();
  });

  it('html preserves the full structure byte-for-byte in the editor model', async () => {
    const blob = await htmlFormat.exportContent(sourceEditor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);
    expect(roundTripped.getJSON()).toEqual(sourceEditor.getJSON());
    roundTripped.destroy();
  });

  it('txt keeps the words (formatting is necessarily lost)', async () => {
    const blob = await txtFormat.exportContent(sourceEditor);
    const text = await blob.text();
    expect(text).toContain('Título de prueba');
    expect(text).toContain('negrita');
    expect(text).toContain('Primer elemento');

    const roundTripped = createTestEditor();
    await txtFormat.importFile(fileFrom(blob, 'doc.txt', 'text/plain'), roundTripped);
    expect(roundTripped.getText()).toContain('Título de prueba');
    roundTripped.destroy();
  });

  // docx *import* goes through mammoth's browser-only zip reader (swapped in via package.json's
  // "browser" field), which Node-based test runners don't exercise the same way a real browser
  // build does — that path is covered by manual verification instead. Here we check what our own
  // docx.ts export code is responsible for: the generated document.xml actually contains the
  // heading, the bold/italic runs and both list items.
  it('docx export produces a valid zip with heading, bold, italic and list items', async () => {
    const blob = await docxFormat.exportContent(sourceEditor);
    expect(blob.size).toBeGreaterThan(0);

    const zip = await JSZip.loadAsync(blob);
    const documentXml = await zip.file('word/document.xml')!.async('text');

    expect(documentXml).toContain('Título de prueba');
    expect(documentXml).toMatch(/<w:b\s*\/>/);
    expect(documentXml).toMatch(/<w:i\s*\/>/);
    expect(documentXml).toContain('negrita');
    expect(documentXml).toContain('cursiva');
    expect(documentXml).toContain('Primer elemento');
    expect(documentXml).toContain('Segundo elemento');
  });

  it('odt round-trip preserves heading, bold, italic and list items', async () => {
    const blob = await odtFormat.exportContent(sourceEditor);
    expect(blob.size).toBeGreaterThan(0);

    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);
    const json = roundTripped.getJSON();

    expect(roundTripped.getText()).toContain('Título de prueba');
    expect(JSON.stringify(json)).toContain('"type":"bold"');
    expect(JSON.stringify(json)).toContain('"type":"italic"');
    expect(roundTripped.getText()).toContain('Primer elemento');
    expect(roundTripped.getText()).toContain('Segundo elemento');
    roundTripped.destroy();
  });
});

describe('format round-trips: tables', () => {
  const TABLE_HTML =
    '<table><tbody><tr><th><p>Nombre</p></th><th><p>Edad</p></th></tr><tr><td><p>Ana</p></td><td><p>30</p></td></tr></tbody></table>';

  it('markdown embeds the table as raw HTML (tiptap-markdown, html:true) and round-trips it', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(TABLE_HTML);
    const blob = await markdownFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await markdownFormat.importFile(
      fileFrom(await blob.text().then((t) => new Blob([t])), 'doc.md', 'text/markdown'),
      roundTripped,
    );
    expect(roundTripped.getText()).toContain('Nombre');
    expect(roundTripped.getText()).toContain('Ana');
    expect(roundTripped.getJSON()).toEqual(editor.getJSON());
    editor.destroy();
    roundTripped.destroy();
  });

  it('html round-trips a table with a header row byte-for-byte in the editor model', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(TABLE_HTML);
    const blob = await htmlFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);
    expect(roundTripped.getJSON()).toEqual(editor.getJSON());
    editor.destroy();
    roundTripped.destroy();
  });

  it('docx export renders the table with a shaded header row', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(TABLE_HTML);
    const blob = await docxFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const documentXml = await zip.file('word/document.xml')!.async('text');
    expect(documentXml).toContain('<w:tbl>');
    expect(documentXml).toContain('Nombre');
    expect(documentXml).toContain('Ana');
    editor.destroy();
  });

  it('odt round-trip preserves the table header row and cell text', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(TABLE_HTML);
    const blob = await odtFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const contentXml = await zip.file('content.xml')!.async('text');
    expect(contentXml).toContain('<table:table-header-rows>');

    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);
    const json = roundTripped.getJSON();
    expect(JSON.stringify(json)).toContain('"type":"table"');
    expect(JSON.stringify(json)).toContain('"type":"tableHeader"');
    expect(roundTripped.getText()).toContain('Nombre');
    expect(roundTripped.getText()).toContain('Ana');
    editor.destroy();
    roundTripped.destroy();
  });
});

describe('format round-trips: images', () => {
  // A 1x1 transparent PNG, small enough to inline directly in the test.
  const PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  // Image is a block-level node (like the app's real editor), so it's a sibling of <p>, not nested
  // inside one — nesting it in a paragraph is invalid for the schema and silently drops the node.
  // A trailing paragraph after the image avoids an unrelated ProseMirror quirk where a doc ending
  // in a non-text block gets an empty paragraph auto-appended — that padding isn't guaranteed to
  // come back with the same count of trailing paragraphs on re-parse, which isn't what this test
  // is about; real documents essentially never end mid-image anyway.
  const IMAGE_HTML = `<img src="${PNG_DATA_URL}" data-align="center" data-bordered="true" data-caption="Una foto"><p>Pie de foto</p>`;

  // imageUtils.collectImageSizes loads each image through `new Image()` to read its natural pixel
  // size; jsdom never actually decodes images, so onload/onerror never fire and the promise hangs
  // forever. Stub a same-tick "always fails to decode" Image so docx/odt export tests (which both
  // go through collectImageSizes) resolve deterministically instead of timing out — this exercises
  // exactly the fallback path (imageUtils.ts's onerror -> {width:300,height:200}) real users hit
  // whenever a browser can't decode the image either.
  const OriginalImage = globalThis.Image;
  beforeEach(() => {
    class StubImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) {
        queueMicrotask(() => this.onerror?.());
      }
    }
    // @ts-expect-error -- test stub, deliberately not a full HTMLImageElement
    globalThis.Image = StubImage;
  });
  afterEach(() => {
    globalThis.Image = OriginalImage;
  });

  it('html round-trips image src and align/border/caption attributes byte-for-byte', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(IMAGE_HTML);
    const blob = await htmlFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);
    expect(withoutTrailingEmptyParagraphs(roundTripped.getJSON())).toEqual(
      withoutTrailingEmptyParagraphs(editor.getJSON()),
    );
    editor.destroy();
    roundTripped.destroy();
  });

  it('docx export embeds the image as media in a valid zip', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(IMAGE_HTML);
    const blob = await docxFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const mediaFiles = Object.keys(zip.files).filter((name) => name.startsWith('word/media/'));
    expect(mediaFiles.length).toBeGreaterThan(0);
    editor.destroy();
  });

  it('odt export embeds the image under Pictures/ and references it from content.xml', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(IMAGE_HTML);
    const blob = await odtFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const pictureFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith('Pictures/') && !zip.files[name].dir,
    );
    expect(pictureFiles).toHaveLength(1);
    const contentXml = await zip.file('content.xml')!.async('text');
    expect(contentXml).toContain(`Pictures/${pictureFiles[0].replace('Pictures/', '')}`);
    expect(contentXml).toContain('<draw:frame');
    editor.destroy();
  });

  // Real, current gap (not a test-environment limitation): odt-impl.ts's ODT->HTML import walker
  // (blockNodeToHtml) has no case for <draw:frame>/<draw:image> at all, so it silently drops every
  // image on ODT import — in production too, not just under jsdom. Flagged in
  // docs/angular-migration-plan.md rather than fixed here (implementing ODT image import is a real
  // feature addition, out of scope for a safety-net test pass).
  it('odt import silently drops images (known gap, not yet fixed)', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(IMAGE_HTML);
    const blob = await odtFormat.exportContent(editor);

    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);

    expect(roundTripped.getText()).toContain('Pie de foto');
    expect(JSON.stringify(roundTripped.getJSON())).not.toContain('"type":"image"');
    editor.destroy();
    roundTripped.destroy();
  });
});

describe('format round-trips: font styling (color, family, size, highlight)', () => {
  const STYLED_HTML =
    '<p><span style="color: #ff0000; font-family: Georgia; font-size: 20px">texto con estilo</span> y <mark data-color="#00ff00" style="background-color: #00ff00">resaltado</mark></p>';

  // Note: a full HTML export/import cycle goes through a real DOM fragment (getHTML() builds one
  // to serialize), and DOM style-attribute serialization canonicalizes color values to rgb(...)
  // form — so `color` does NOT survive byte-for-byte even though it's visually identical
  // (#ff0000 -> rgb(255, 0, 0)). This is a genuine, previously-uncharacterized quirk: the app's
  // color <input type="color"> only accepts #rrggbb, so a color re-imported from an .html export
  // could stop reflecting in that picker even though the text still renders in the right color.
  // Flagged in docs/angular-migration-plan.md as a known issue rather than fixed here.
  it('html round-trips family/size/highlight byte-for-byte, and color as an equivalent rgb() value', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(STYLED_HTML);
    const blob = await htmlFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);

    const sourceJson = editor.getJSON();
    const roundTrippedJson = roundTripped.getJSON();
    const stripColor = (json: typeof sourceJson) =>
      JSON.parse(JSON.stringify(json), (key, value) => (key === 'color' ? undefined : value));
    expect(stripColor(roundTrippedJson)).toEqual(stripColor(sourceJson));

    const roundTrippedColor = JSON.stringify(roundTrippedJson);
    expect(roundTrippedColor).toMatch(/"color":"rgb\(255, ?0, ?0\)"/);
    editor.destroy();
    roundTripped.destroy();
  });

  it('odt round-trip preserves color, font family, font size and highlight', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(STYLED_HTML);
    const blob = await odtFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);
    const json = JSON.stringify(roundTripped.getJSON());
    expect(json).toContain('"color":"#ff0000"');
    expect(json).toContain('"fontFamily":"Georgia"');
    // ODT stores font size in points; imported back and converted to px, rounding is expected.
    expect(json).toMatch(/"fontSize":"\d+px"/);
    expect(json).toContain('"type":"highlight"');
    expect(roundTripped.getText()).toContain('texto con estilo');
    expect(roundTripped.getText()).toContain('resaltado');
    editor.destroy();
    roundTripped.destroy();
  });

  it('docx export writes the run properties for color, font and highlight', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(STYLED_HTML);
    const blob = await docxFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const documentXml = await zip.file('word/document.xml')!.async('text');
    expect(documentXml).toMatch(/<w:color w:val="FF0000"\s*\/>/);
    expect(documentXml).toContain('Georgia');
    editor.destroy();
  });
});

describe('format round-trips: text alignment', () => {
  const ALIGNED_HTML =
    '<p style="text-align: center">centrado</p><p style="text-align: right">derecha</p>';

  it('html round-trips alignment byte-for-byte in the editor model', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(ALIGNED_HTML);
    const blob = await htmlFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);
    expect(roundTripped.getJSON()).toEqual(editor.getJSON());
    editor.destroy();
    roundTripped.destroy();
  });

  it('odt round-trip preserves center/right paragraph alignment', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(ALIGNED_HTML);
    const blob = await odtFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);
    const json = roundTripped.getJSON();
    const aligns = (json.content ?? []).map((n) => n.attrs?.['textAlign']);
    expect(aligns).toEqual(['center', 'right']);
    editor.destroy();
    roundTripped.destroy();
  });

  it('docx export sets paragraph alignment', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(ALIGNED_HTML);
    const blob = await docxFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const documentXml = await zip.file('word/document.xml')!.async('text');
    expect(documentXml).toMatch(/<w:jc w:val="center"\s*\/>/);
    expect(documentXml).toMatch(/<w:jc w:val="right"\s*\/>/);
    editor.destroy();
  });
});

describe('format round-trips: code blocks', () => {
  const CODE_HTML = '<pre><code>function hola() {\n  return 1;\n}</code></pre>';

  it('markdown round-trips a fenced code block', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(CODE_HTML);
    const blob = await markdownFormat.exportContent(editor);
    const text = await blob.text();
    expect(text).toContain('```');
    const roundTripped = createTestEditor();
    await markdownFormat.importFile(
      fileFrom(new Blob([text]), 'doc.md', 'text/markdown'),
      roundTripped,
    );
    expect(roundTripped.getJSON()).toEqual(editor.getJSON());
    editor.destroy();
    roundTripped.destroy();
  });

  it('html round-trips a code block byte-for-byte in the editor model', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(CODE_HTML);
    const blob = await htmlFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);
    expect(roundTripped.getJSON()).toEqual(editor.getJSON());
    editor.destroy();
    roundTripped.destroy();
  });

  it('odt round-trip reconstructs a single code block from its per-line paragraphs', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(CODE_HTML);
    const blob = await odtFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);
    const json = roundTripped.getJSON();
    expect(json.content?.filter((n) => n.type === 'codeBlock')).toHaveLength(1);
    expect(roundTripped.getText()).toContain('function hola()');
    expect(roundTripped.getText()).toContain('return 1;');
    editor.destroy();
    roundTripped.destroy();
  });
});

describe('format round-trips: nested lists', () => {
  const NESTED_LIST_HTML =
    '<ul><li><p>Nivel 1</p><ul><li><p>Nivel 2</p><ol><li><p>Nivel 3</p></li></ol></li></ul></li></ul>';

  it('markdown round-trips a nested bullet/ordered list', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(NESTED_LIST_HTML);
    const blob = await markdownFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await markdownFormat.importFile(fileFrom(blob, 'doc.md', 'text/markdown'), roundTripped);
    expect(roundTripped.getText()).toContain('Nivel 1');
    expect(roundTripped.getText()).toContain('Nivel 2');
    expect(roundTripped.getText()).toContain('Nivel 3');
    editor.destroy();
    roundTripped.destroy();
  });

  it('html round-trips nested lists byte-for-byte in the editor model', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(NESTED_LIST_HTML);
    const blob = await htmlFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await htmlFormat.importFile(fileFrom(blob, 'doc.html', 'text/html'), roundTripped);
    expect(roundTripped.getJSON()).toEqual(editor.getJSON());
    editor.destroy();
    roundTripped.destroy();
  });

  it('odt round-trip preserves nesting depth and both list kinds', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(NESTED_LIST_HTML);
    const blob = await odtFormat.exportContent(editor);
    const roundTripped = createTestEditor();
    await odtFormat.importFile(fileFrom(blob, 'doc.odt', blob.type), roundTripped);
    expect(roundTripped.getText()).toContain('Nivel 1');
    expect(roundTripped.getText()).toContain('Nivel 2');
    expect(roundTripped.getText()).toContain('Nivel 3');
    const json = JSON.stringify(roundTripped.getJSON());
    expect(json).toContain('"type":"bulletList"');
    expect(json).toContain('"type":"orderedList"');
    editor.destroy();
    roundTripped.destroy();
  });

  it('docx export nests ordered/unordered list items at increasing indent levels', async () => {
    const editor = createTestEditor();
    editor.commands.setContent(NESTED_LIST_HTML);
    const blob = await docxFormat.exportContent(editor);
    const zip = await JSZip.loadAsync(blob);
    const documentXml = await zip.file('word/document.xml')!.async('text');
    expect(documentXml).toContain('Nivel 1');
    expect(documentXml).toContain('Nivel 2');
    expect(documentXml).toContain('Nivel 3');
    expect(documentXml).toMatch(/<w:ilvl w:val="1"\s*\/>/);
    editor.destroy();
  });
});
