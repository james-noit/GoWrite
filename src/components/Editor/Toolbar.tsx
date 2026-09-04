import type { Editor } from "@tiptap/core";
import { useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../../hooks/useI18n";
import { formatGroups as groups, type TFunction, type ToolbarButton } from "./formatGroups";
import { formatPainter } from "./formatPainter";
import { insertTableAction, tableEditActions } from "./tableActions";

type SavedSelection = { from: number; to: number } | null;

// The desktop-style single-row strip only makes sense with a mouse (fine pointer) or on a
// genuinely wide screen — a touch tablet at 768-1023px still needs the phone's disclosure sheet,
// since a coarse pointer's larger touch targets would otherwise push a third of the controls off
// the edge of a single non-wrapping row.
const FULL_TIER_QUERY = "(min-width: 1024px), (min-width: 768px) and (pointer: fine)";

function useMediaQuery(query: string): boolean {
  const subscribe = (onChange: () => void) => {
    const mql = window.matchMedia(query);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  };
  const getSnapshot = () => window.matchMedia(query).matches;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// The four native inputs below (two <select>, two <input type="color">) can't be guarded with
// preventDefault — that would stop their pickers from opening — so instead we snapshot the
// editor's selection whenever the user touches toolbar chrome, and restore it if the act of
// opening a native picker collapsed it. Buttons don't need this: preventDefault on their
// mousedown already keeps the selection alive.
function restoreSelectionIfCollapsed(editor: Editor, saved: SavedSelection) {
  if (!saved || saved.from === saved.to) return;
  const { from, to } = editor.state.selection;
  if (from === to) editor.commands.setTextSelection(saved);
}

const FONT_FAMILIES = [
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: '"Times New Roman", serif', label: "Times New Roman" },
  { value: '"Courier New", monospace', label: "Courier New" },
  { value: "Verdana, sans-serif", label: "Verdana" },
  { value: '"Trebuchet MS", sans-serif', label: "Trebuchet MS" },
];

const FONT_SIZES = ["12px", "14px", "16px", "18px", "20px", "24px", "28px", "32px", "40px"];

const DEFAULT_FONT_FAMILY_LABEL = "Inter";
const DEFAULT_FONT_SIZE_LABEL = "16px";

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

interface TypographyControlsProps {
  editor: Editor;
  getSavedSelection: () => SavedSelection;
}

function TypographyControls({ editor, getSavedSelection }: TypographyControlsProps) {
  const { t } = useI18n();
  const rawColor = (editor.getAttributes("textStyle").color as string | undefined) ?? "";
  const safeColor = HEX_COLOR_RE.test(rawColor) ? rawColor : "#000000";
  const rawHighlight = (editor.getAttributes("highlight").color as string | undefined) ?? "";
  const safeHighlight = HEX_COLOR_RE.test(rawHighlight) ? rawHighlight : "#ffff00";
  const currentFamily = (editor.getAttributes("textStyle").fontFamily as string | undefined) ?? "";
  const currentSize = (editor.getAttributes("textStyle").fontSize as string | undefined) ?? "";

  return (
    <div className="toolbar-typography">
      <span className="toolbar-color-swatch" title={t("toolbar.fontColor")}>
        <span className="toolbar-color-icon" aria-hidden="true">
          A<span className="toolbar-color-bar" style={{ backgroundColor: safeColor }} />
        </span>
        <input
          type="color"
          value={safeColor}
          aria-label={t("toolbar.fontColor")}
          onChange={(e) => {
            restoreSelectionIfCollapsed(editor, getSavedSelection());
            editor.chain().focus().setColor(e.target.value).run();
          }}
        />
      </span>
      {rawColor && (
        <button
          type="button"
          className="toolbar-color-clear"
          title={t("toolbar.clearFormat")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetColor().run()}
        >
          ✕
        </button>
      )}

      <select
        className="toolbar-select"
        title={t("toolbar.fontFamily")}
        aria-label={t("toolbar.fontFamily")}
        value={currentFamily}
        onChange={(e) => {
          restoreSelectionIfCollapsed(editor, getSavedSelection());
          const value = e.target.value;
          if (!value) editor.chain().focus().unsetFontFamily().run();
          else editor.chain().focus().setFontFamily(value).run();
        }}
      >
        <option value="">{DEFAULT_FONT_FAMILY_LABEL}</option>
        {FONT_FAMILIES.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <select
        className="toolbar-select toolbar-select--size"
        title={t("toolbar.fontSize")}
        aria-label={t("toolbar.fontSize")}
        value={currentSize}
        onChange={(e) => {
          restoreSelectionIfCollapsed(editor, getSavedSelection());
          const value = e.target.value;
          if (!value) editor.chain().focus().unsetFontSize().run();
          else editor.chain().focus().setFontSize(value).run();
        }}
      >
        <option value="">{DEFAULT_FONT_SIZE_LABEL}</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>

      <span className="toolbar-color-swatch toolbar-color-swatch--highlight" title={t("toolbar.fontBackground")}>
        <span className="toolbar-color-icon toolbar-color-icon--highlight" aria-hidden="true" style={{ backgroundColor: safeHighlight }}>
          A
        </span>
        <input
          type="color"
          value={safeHighlight}
          aria-label={t("toolbar.fontBackground")}
          onChange={(e) => {
            restoreSelectionIfCollapsed(editor, getSavedSelection());
            editor.chain().focus().setHighlight({ color: e.target.value }).run();
          }}
        />
      </span>
      {rawHighlight && (
        <button
          type="button"
          className="toolbar-color-clear"
          title={t("toolbar.clearFormat")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().unsetHighlight().run()}
        >
          ✕
        </button>
      )}
    </div>
  );
}

function TableControls({ editor }: { editor: Editor }) {
  const { t } = useI18n();
  const inTable = editor.isActive("table");

  return (
    <div className="toolbar-group">
      <span className="toolbar-group-label">{t("toolbar.group.table")}</span>
      <div className="toolbar-group-buttons">
        <button
          type="button"
          title={t(insertTableAction.titleKey)}
          className="toolbar-btn toolbar-btn--labelled"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertTableAction.run(editor)}
        >
          <insertTableAction.icon />
          {t("toolbar.insertTableLabel")}
        </button>

        {inTable &&
          tableEditActions.map((action) => (
            <button
              key={action.key}
              type="button"
              title={t(action.titleKey)}
              className={`toolbar-btn${action.isActive?.(editor) ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => action.run(editor)}
            >
              <action.icon />
            </button>
          ))}
      </div>
    </div>
  );
}

function GroupButtons({ editor, buttons, t }: { editor: Editor; buttons: ToolbarButton[]; t: TFunction }) {
  return (
    <div className="toolbar-group-buttons">
      {buttons.map((btn) => {
        const disabled = btn.isDisabled?.(editor) ?? false;
        return (
          <button
            key={btn.titleKey}
            type="button"
            title={t(btn.titleKey)}
            disabled={disabled}
            className={`toolbar-btn${btn.isActive?.(editor) ? " is-active" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => btn.run(editor, t)}
          >
            {btn.icon ? <btn.icon /> : btn.labelKey ? t(btn.labelKey) : btn.label}
          </button>
        );
      })}
    </div>
  );
}

interface FormatGroupsProps {
  editor: Editor;
  getSavedSelection: () => SavedSelection;
}

function FormatGroups({ editor, getSavedSelection }: FormatGroupsProps) {
  const { t } = useI18n();
  return (
    <div className="toolbar-groups scroll-thin">
      {groups.map((group) =>
        group.labelKey === "toolbar.group.font" ? (
          <div className="toolbar-group" key={group.labelKey}>
            <span className="toolbar-group-label">{t(group.labelKey)}</span>
            <div className="toolbar-font-controls">
              <GroupButtons editor={editor} buttons={group.buttons} t={t} />
              <TypographyControls editor={editor} getSavedSelection={getSavedSelection} />
            </div>
          </div>
        ) : (
          <div className="toolbar-group" key={group.labelKey}>
            <span className="toolbar-group-label">{t(group.labelKey)}</span>
            <GroupButtons editor={editor} buttons={group.buttons} t={t} />
          </div>
        ),
      )}
      <TableControls editor={editor} />
    </div>
  );
}

interface ToolbarProps {
  editor: Editor | null;
}

export function Toolbar({ editor }: ToolbarProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const isFullTier = useMediaQuery(FULL_TIER_QUERY);
  const rootRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const savedSelectionRef = useRef<SavedSelection>(null);
  const [, forceUpdate] = useReducer((c: number) => c + 1, 0);

  // The active/inactive state of each format button depends on the cursor's current marks/node,
  // which Tiptap tracks internally — React only re-renders when props change, so without this the
  // toolbar would keep showing whatever was active the last time the cursor moved into the editor.
  useEffect(() => {
    if (!editor) return;
    const onTransaction = () => forceUpdate();
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  // The format painter can deactivate itself outside of an editor transaction (e.g. the toolbar
  // button toggling it off without editing the document), so it needs its own re-render trigger.
  useEffect(() => formatPainter.subscribe(() => forceUpdate()), []);

  // The sheet is non-modal by design (the document must stay reachable while formatting), so it
  // only closes on an explicit action: the toggle, its own close button, or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  // The sheet is portalled to <body>, outside rootRef, so a single capture-phase listener
  // covers both it and the inline toolbar: it snapshots the editor's selection whenever the user
  // touches toolbar chrome, so a native picker that steals focus (a <select> or a color input)
  // can have the selection restored before its command runs.
  useEffect(() => {
    if (!editor) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !sheetRef.current?.contains(target)) return;
      const { from, to } = editor.state.selection;
      savedSelectionRef.current = { from, to };
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [editor]);

  // The sheet can occlude the lower half of a short viewport, so nudge the caret back into view
  // once it opens rather than leaving the user formatting text they can no longer see.
  useEffect(() => {
    if (!menuOpen || !editor) return;
    const id = requestAnimationFrame(() => editor.commands.scrollIntoView());
    return () => cancelAnimationFrame(id);
  }, [menuOpen, editor]);

  if (!editor) return null;

  const getSavedSelection = () => savedSelectionRef.current;

  return (
    <div className="format-bar glass-panel" ref={rootRef}>
      <div className="format-bar-top">
        {isFullTier ? (
          <div className="format-bar-inline">
            <FormatGroups editor={editor} getSavedSelection={getSavedSelection} />
          </div>
        ) : (
          <button
            type="button"
            className="format-tab"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-label={t("toolbar.showFormatBar")}
          >
            {t("toolbar.format")} {menuOpen ? "▴" : "▾"}
          </button>
        )}
      </div>

      {!isFullTier &&
        menuOpen &&
        createPortal(
          <div className="fmt-sheet" role="group" aria-label={t("toolbar.format")} ref={sheetRef}>
            <div className="fmt-sheet-grab" aria-hidden="true" />
            <div className="fmt-sheet-header">
              <span className="fmt-sheet-title">{t("toolbar.format")}</span>
              <button
                type="button"
                className="icon-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setMenuOpen(false)}
                aria-label={t("common.close")}
              >
                ✕
              </button>
            </div>
            <div className="fmt-sheet-body">
              <FormatGroups editor={editor} getSavedSelection={getSavedSelection} />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
