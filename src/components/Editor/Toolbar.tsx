import type { Editor } from "@tiptap/core";
import { useEffect, useReducer, useRef, useState, type RefObject } from "react";
import type { UseAiConnection } from "../../hooks/useAiConnection";
import { useI18n } from "../../hooks/useI18n";
import type { TranslationKey } from "../../lib/i18n/translations";
import {
  AddColumnIcon,
  AddRowIcon,
  CellFormatIcon,
  DeleteColumnIcon,
  DeleteRowIcon,
  InsertTableIcon,
} from "../icons";

type TFunction = (key: TranslationKey) => string;

interface ToolbarButton {
  label?: string;
  labelKey?: TranslationKey;
  titleKey: TranslationKey;
  isActive?: (editor: Editor) => boolean;
  isDisabled?: (editor: Editor) => boolean;
  run: (editor: Editor, t: TFunction) => void;
}

interface ToolbarGroup {
  labelKey: TranslationKey;
  buttons: ToolbarButton[];
}

const groups: ToolbarGroup[] = [
  {
    labelKey: "toolbar.group.font",
    buttons: [
      {
        label: "B",
        titleKey: "toolbar.bold",
        isActive: (e) => e.isActive("bold"),
        run: (e) => e.chain().focus().toggleBold().run(),
      },
      {
        label: "I",
        titleKey: "toolbar.italic",
        isActive: (e) => e.isActive("italic"),
        run: (e) => e.chain().focus().toggleItalic().run(),
      },
      {
        label: "U",
        titleKey: "toolbar.underline",
        isActive: (e) => e.isActive("underline"),
        run: (e) => e.chain().focus().toggleUnderline().run(),
      },
      {
        label: "S",
        titleKey: "toolbar.strike",
        isActive: (e) => e.isActive("strike"),
        run: (e) => e.chain().focus().toggleStrike().run(),
      },
    ],
  },
  {
    labelKey: "toolbar.group.style",
    buttons: [
      {
        label: "H1",
        titleKey: "toolbar.h1",
        isActive: (e) => e.isActive("heading", { level: 1 }),
        run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: "H2",
        titleKey: "toolbar.h2",
        isActive: (e) => e.isActive("heading", { level: 2 }),
        run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: "H3",
        titleKey: "toolbar.h3",
        isActive: (e) => e.isActive("heading", { level: 3 }),
        run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
      },
    ],
  },
  {
    labelKey: "toolbar.group.lists",
    buttons: [
      {
        label: "•",
        titleKey: "toolbar.bulletList",
        isActive: (e) => e.isActive("bulletList"),
        run: (e) => e.chain().focus().toggleBulletList().run(),
      },
      {
        label: "1.",
        titleKey: "toolbar.orderedList",
        isActive: (e) => e.isActive("orderedList"),
        run: (e) => e.chain().focus().toggleOrderedList().run(),
      },
    ],
  },
  {
    labelKey: "toolbar.group.insert",
    buttons: [
      {
        label: "❝",
        titleKey: "toolbar.blockquote",
        isActive: (e) => e.isActive("blockquote"),
        run: (e) => e.chain().focus().toggleBlockquote().run(),
      },
      {
        label: "</>",
        titleKey: "toolbar.codeBlock",
        isActive: (e) => e.isActive("codeBlock"),
        run: (e) => e.chain().focus().toggleCodeBlock().run(),
      },
      {
        label: "🔗",
        titleKey: "toolbar.link",
        isActive: (e) => e.isActive("link"),
        run: (e, t) => {
          if (e.isActive("link")) {
            e.chain().focus().unsetLink().run();
            return;
          }
          const url = window.prompt(t("toolbar.linkPrompt"));
          if (url) e.chain().focus().setLink({ href: url }).run();
        },
      },
    ],
  },
  {
    labelKey: "toolbar.group.align",
    buttons: [
      {
        label: "⟸",
        titleKey: "toolbar.alignLeft",
        isActive: (e) => e.isActive({ textAlign: "left" }),
        run: (e) => e.chain().focus().setTextAlign("left").run(),
      },
      {
        label: "⟺",
        titleKey: "toolbar.alignCenter",
        isActive: (e) => e.isActive({ textAlign: "center" }),
        run: (e) => e.chain().focus().setTextAlign("center").run(),
      },
      {
        label: "⟹",
        titleKey: "toolbar.alignRight",
        isActive: (e) => e.isActive({ textAlign: "right" }),
        run: (e) => e.chain().focus().setTextAlign("right").run(),
      },
      {
        label: "☰",
        titleKey: "toolbar.alignJustify",
        isActive: (e) => e.isActive({ textAlign: "justify" }),
        run: (e) => e.chain().focus().setTextAlign("justify").run(),
      },
    ],
  },
];

interface AiStatusCardProps {
  ai: UseAiConnection;
  autocompleteEnabled: boolean;
  open: boolean;
  onToggle: () => void;
  buttonRef: RefObject<HTMLButtonElement>;
}

function AiStatusCard({
  ai,
  autocompleteEnabled,
  open,
  onToggle,
  buttonRef,
}: AiStatusCardProps) {
  const { t } = useI18n();
  const [showIntro, setShowIntro] = useState(false);
  const statusLabel = t(`ai.status.${ai.status}` as TranslationKey);
  const metaText = ai.isConnected ? ai.config.model || ai.meta.defaultModel : statusLabel;

  // One-shot welcome effect (spin the border, sweep a reflection, pop) once the page has
  // fully finished loading — never replays afterwards, since this state only ever flips once.
  useEffect(() => {
    if (document.readyState === "complete") {
      setShowIntro(true);
      return;
    }
    const onLoad = () => setShowIntro(true);
    window.addEventListener("load", onLoad, { once: true });
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return (
    <button
      ref={buttonRef}
      type="button"
      className={`toolbar-ai-card toolbar-ai-card--${ai.status}${open ? " is-open" : ""}${showIntro ? " ai-intro" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
      title={`${t("ai.buttonLabel")} — ${statusLabel}`}
    >
      <span className="toolbar-ai-dot" aria-hidden="true" />
      <span className="toolbar-ai-text">
        <span className="toolbar-ai-label">{t("ai.buttonLabel")}</span>
        <span className="toolbar-ai-meta">{metaText}</span>
      </span>
      {autocompleteEnabled && (
        <span
          className="toolbar-ai-auto"
          title={t("ai.autocomplete")}
          aria-label={t("ai.autocomplete")}
        >
          ⚡
        </span>
      )}
    </button>
  );
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

function TypographyControls({ editor }: { editor: Editor }) {
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
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
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
          onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
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
          title={t("toolbar.insertTable")}
          className="toolbar-btn toolbar-btn--labelled"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <InsertTableIcon />
          {t("toolbar.insertTableLabel")}
        </button>

        {inTable && (
          <>
            <button
              type="button"
              title={t("toolbar.addColumn")}
              className="toolbar-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().addColumnAfter().run()}
            >
              <AddColumnIcon />
            </button>
            <button
              type="button"
              title={t("toolbar.addRow")}
              className="toolbar-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().addRowAfter().run()}
            >
              <AddRowIcon />
            </button>
            <button
              type="button"
              title={t("toolbar.deleteColumn")}
              className="toolbar-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().deleteColumn().run()}
            >
              <DeleteColumnIcon />
            </button>
            <button
              type="button"
              title={t("toolbar.deleteRow")}
              className="toolbar-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().deleteRow().run()}
            >
              <DeleteRowIcon />
            </button>
            <button
              type="button"
              title={t("toolbar.cellFormat")}
              className={`toolbar-btn${editor.isActive("tableHeader") ? " is-active" : ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => editor.chain().focus().toggleHeaderCell().run()}
            >
              <CellFormatIcon />
            </button>
          </>
        )}
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
            {btn.labelKey ? t(btn.labelKey) : btn.label}
          </button>
        );
      })}
    </div>
  );
}

function FormatGroups({ editor }: { editor: Editor }) {
  const { t } = useI18n();
  return (
    <div className="toolbar-groups scroll-thin">
      {groups.map((group) =>
        group.labelKey === "toolbar.group.font" ? (
          <div className="toolbar-group" key={group.labelKey}>
            <span className="toolbar-group-label">{t(group.labelKey)}</span>
            <div className="toolbar-font-controls">
              <GroupButtons editor={editor} buttons={group.buttons} t={t} />
              <TypographyControls editor={editor} />
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
  ai: UseAiConnection;
  autocompleteEnabled: boolean;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  aiButtonRef: RefObject<HTMLButtonElement>;
}

export function Toolbar({
  editor,
  ai,
  autocompleteEnabled,
  aiPanelOpen,
  onToggleAiPanel,
  aiButtonRef,
}: ToolbarProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
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

  // On mobile, the accordion collapses when focus/clicks leave the toolbar — unless pinned.
  useEffect(() => {
    if (!menuOpen || pinned) return;
    const onFocusChange = (e: Event) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onFocusChange);
    document.addEventListener("focusin", onFocusChange);
    return () => {
      document.removeEventListener("mousedown", onFocusChange);
      document.removeEventListener("focusin", onFocusChange);
    };
  }, [menuOpen, pinned]);

  if (!editor) return null;

  return (
    <div className="format-bar glass-panel" ref={rootRef}>
      <div className="format-bar-top">
        <div className="format-bar-inline">
          <FormatGroups editor={editor} />
        </div>

        <button
          type="button"
          className="format-tab"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={t("toolbar.showFormatBar")}
        >
          {t("toolbar.format")} {menuOpen ? "▴" : "▾"}
        </button>

        <AiStatusCard
          ai={ai}
          autocompleteEnabled={autocompleteEnabled}
          open={aiPanelOpen}
          onToggle={onToggleAiPanel}
          buttonRef={aiButtonRef}
        />
      </div>

      <div className={`toolbar-accordion${menuOpen ? " is-open" : ""}`}>
        <div className="toolbar-accordion-inner">
          <FormatGroups editor={editor} />
          <button
            type="button"
            className={`toolbar-pin${pinned ? " is-pinned" : ""}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPinned((v) => !v)}
            aria-pressed={pinned}
            title={pinned ? t("toolbar.pinOn") : t("toolbar.pinOff")}
          >
            📌
          </button>
        </div>
      </div>
    </div>
  );
}
