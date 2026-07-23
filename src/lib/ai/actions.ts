import type { Editor } from '@tiptap/core'
import type { AiConfig, ChatMessage } from '../../types'
import { streamChat } from './stream'

const SYSTEM_PROMPT = `Eres un asistente de escritura integrado en GoWrite, un editor de texto. Sigues estas reglas en todas tus respuestas:
- Devuelve únicamente el texto solicitado, en texto plano.
- No añadas saludos, explicaciones, notas, títulos, comillas ni bloques de código.
- Escribe siempre en el mismo idioma que el texto proporcionado.
- Nunca contradigas los hechos, nombres o datos que aparecen en el texto proporcionado.`

export function documentText(editor: Editor): string {
  return editor.getText({ blockSeparator: '\n\n' })
}

export function textBeforeCursor(editor: Editor): string {
  const head = editor.state.selection.head
  return editor.state.doc.textBetween(0, head, '\n')
}

export interface EditorScope {
  text: string
  hasSelection: boolean
  /** Where a generated result should be inserted: end of the selection, or end of the doc. */
  insertPos: number
}

/** Resolves what a tool should operate on: the current selection if non-empty, otherwise the whole document. */
export function scopeText(editor: Editor): EditorScope {
  const { from, to, empty } = editor.state.selection
  if (!empty) {
    return { text: editor.state.doc.textBetween(from, to, '\n'), hasSelection: true, insertPos: to }
  }
  return { text: documentText(editor), hasSelection: false, insertPos: editor.state.doc.content.size }
}

function clampRange(minWords: number, maxWords: number): { min: number; max: number } {
  const min = Math.max(1, Math.round(minWords) || 1)
  const max = Math.max(min, Math.round(maxWords) || min)
  return { min, max }
}

function messagesFor(instruction: string, text: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${instruction}\n\n<texto>\n${text}\n</texto>` },
  ]
}

export function summaryMessages(text: string): ChatMessage[] {
  return messagesFor(
    `Resume el contenido de <texto> (puede ser el documento completo o solo un fragmento seleccionado por el usuario). Instrucciones:
- Recoge las ideas principales y los datos esenciales; no añadas información, interpretaciones ni opiniones propias.
- Conserva el tono y la terminología del original.
- El resumen debe ser claro y sustancialmente más corto que el original.
- Si el original es largo, organiza el resumen en párrafos breves.
Devuelve únicamente el resumen.`,
    text,
  )
}

export function continuationMessages(text: string, minWords: number, maxWords: number): ChatMessage[] {
  const { min, max } = clampRange(minWords, maxWords)
  return messagesFor(
    `El contenido de <texto> es un documento en progreso, o un fragmento seleccionado dentro de él. Escribe la parte que continúa justo después. Instrucciones:
- Mantén la voz, el estilo, el tono, el tiempo verbal y la persona del autor.
- Sé coherente con los hechos, personajes y datos ya establecidos.
- Haz avanzar el contenido aportando material nuevo; no resumas ni repitas lo ya escrito.
- Escribe entre ${min} y ${max} palabras.
- Separa los párrafos con una línea en blanco cuando corresponda.
Devuelve únicamente el texto nuevo.`,
    text,
  )
}

export function autocompleteMessages(text: string, minWords: number, maxWords: number): ChatMessage[] {
  const { min, max } = clampRange(minWords, maxWords)
  return messagesFor(
    `El contenido de <texto> es lo que el usuario lleva escrito y puede terminar a mitad de frase. Escribe su continuación inmediata. Instrucciones:
- Continúa exactamente desde donde termina, de modo que texto y continuación se lean como una sola pieza (si hay una frase a medias, complétala primero).
- Imita el estilo, el tono, el tiempo verbal y la persona del autor.
- No repitas ni reformules nada del texto original.
- Escribe entre ${min} y ${max} palabras.
Devuelve únicamente la continuación.`,
    text,
  )
}

export function editMessages(text: string, instruction: string): ChatMessage[] {
  return messagesFor(
    `Modifica el contenido de <texto> aplicando esta instrucción: "${instruction}". Instrucciones:
- Aplica únicamente los cambios que pide la instrucción; conserva todo lo demás tal cual.
- Mantén el idioma original salvo que la instrucción pida lo contrario.
Devuelve únicamente el texto modificado completo.`,
    text,
  )
}

export async function generate(params: {
  messages: ChatMessage[]
  config: AiConfig
  signal: AbortSignal
  onDelta?: (fullTextSoFar: string) => void
  maxTokens?: number
}): Promise<string> {
  let full = ''
  await streamChat(
    params.config,
    params.messages,
    (delta) => {
      full += delta
      params.onDelta?.(full)
    },
    params.signal,
    { maxTokens: params.maxTokens },
  )
  return full
}
