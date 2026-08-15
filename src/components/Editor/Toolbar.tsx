import type { Editor } from "@tiptap/core";
import { useEffect, useReducer, useRef, useState, type RefObject } from "react";
import type { UseAiConnection } from "../../hooks/useAiConnection";
import { useI18n } from "../../hooks/useI18n";
import type { TranslationKey } from "../../lib/i18n/translations";

type TFunction = (key: TranslationKey) => string;

interface ToolbarButton {
  label: string;
  titleKey: TranslationKey;
  isActive?: (editor: Editor) => boolean;
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

function FormatGroups({ editor }: { editor: Editor }) {
  const { t } = useI18n();
  return (
    <div className="toolbar-groups scroll-thin">
      {groups.map((group) => (
        <div className="toolbar-group" key={group.labelKey}>
          <span className="toolbar-group-label">{t(group.labelKey)}</span>
          <div className="toolbar-group-buttons">
            {group.buttons.map((btn) => (
              <button
                key={btn.titleKey}
                type="button"
                title={t(btn.titleKey)}
                className={`toolbar-btn${btn.isActive?.(editor) ? " is-active" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => btn.run(editor, t)}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>
      ))}
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
