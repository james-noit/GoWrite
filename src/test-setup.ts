// jsdom has no IndexedDB implementation at all. DocumentsService (root-provided) touches it from
// an effect() that fires as soon as an editor mounts, which now happens in any test that renders
// EditorHost/App — not just documents.service.spec.ts, which used to import this locally. Global,
// so no future spec has to remember to add it itself.
import 'fake-indexeddb/auto';

// jsdom implements no real layout engine, so `Range` (unlike `Element`) is missing
// `getClientRects`/`getBoundingClientRect` entirely — ProseMirror's `coordsAtPos` (used by
// editor.commands.scrollIntoView, which `autofocus` can trigger on any setContent()) calls
// `range.getClientRects()` and throws outright without this. A zero-size rect is a reasonable
// stand-in since no test in this app asserts on real pixel coordinates.
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  const zeroRect = (): DOMRect => ({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    toJSON: () => ({}),
  });
  Range.prototype.getClientRects = function (): DOMRectList {
    const rects = [] as unknown as DOMRectList;
    return rects;
  };
  Range.prototype.getBoundingClientRect = zeroRect;
}
