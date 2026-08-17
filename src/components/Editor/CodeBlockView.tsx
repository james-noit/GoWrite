import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react'

/** Small language-tag input rendered inside every code block. Setting it fills the node's
 * `language` attribute, which `tiptap-markdown` already uses to write ` ```lang ` fences on
 * export — this view is the only piece needed for markdown code blocks to come out coloured. */
export function CodeBlockView({ node, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper className="code-block-view">
      <input
        type="text"
        className="code-block-lang"
        placeholder="lang"
        spellCheck={false}
        contentEditable={false}
        value={(node.attrs.language as string | null) ?? ''}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => updateAttributes({ language: e.target.value || null })}
      />
      <pre>
        <NodeViewContent<'code'> as="code" />
      </pre>
    </NodeViewWrapper>
  )
}
