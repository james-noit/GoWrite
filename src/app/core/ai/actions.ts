import type { Editor } from '@tiptap/core';
import type { AiConfig, ChatMessage } from '../types';
import { streamChat } from './stream';

const SYSTEM_PROMPT = `Eres un asistente de escritura integrado en GoWrite, un editor de texto. Sigues estas reglas en todas tus respuestas:
- Devuelve únicamente el texto solicitado, en texto plano.
- No añadas saludos, explicaciones, notas, títulos, comillas ni bloques de código.
- Escribe siempre en el mismo idioma que el texto proporcionado.
- Nunca contradigas los hechos, nombres o datos que aparecen en el texto proporcionado.`;

export function documentText(editor: Editor): string {
  return editor.getText({ blockSeparator: '\n\n' });
}

export function textBeforeCursor(editor: Editor): string {
  const head = editor.state.selection.head;
  return editor.state.doc.textBetween(0, head, '\n');
}

function clampRange(minWords: number, maxWords: number): { min: number; max: number } {
  const min = Math.max(1, Math.round(minWords) || 1);
  const max = Math.max(min, Math.round(maxWords) || min);
  return { min, max };
}

function messagesFor(instruction: string, text: string): ChatMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${instruction}\n\n<texto>\n${text}\n</texto>` },
  ];
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
  );
}

export function continuationMessages(
  text: string,
  minWords: number,
  maxWords: number,
): ChatMessage[] {
  const { min, max } = clampRange(minWords, maxWords);
  return messagesFor(
    `El contenido de <texto> es un documento en progreso, o un fragmento seleccionado dentro de él. Escribe la parte que continúa justo después. Instrucciones:
- Mantén la voz, el estilo, el tono, el tiempo verbal y la persona del autor.
- Sé coherente con los hechos, personajes y datos ya establecidos.
- Haz avanzar el contenido aportando material nuevo; no resumas ni repitas lo ya escrito.
- Escribe entre ${min} y ${max} palabras.
- Separa los párrafos con una línea en blanco cuando corresponda.
Devuelve únicamente el texto nuevo.`,
    text,
  );
}

export function autocompleteCodeMessages(
  text: string,
  minWords: number,
  maxWords: number,
): ChatMessage[] {
  const { min, max } = clampRange(minWords, maxWords);
  return messagesFor(
    `El contenido de <texto> es código fuente que el usuario lleva escrito dentro de un bloque de código, y puede terminar a mitad de línea o de expresión. Escribe su continuación inmediata. Instrucciones:
- Continúa exactamente desde donde termina el código, sin repetir lo ya escrito.
- Usa el mismo lenguaje de programación, estilo de indentación y convenciones de nombres que el resto del código.
- Conserva los saltos de línea y la indentación tal cual deban aparecer en el código; no los conviertas en espacios.
- No incluyas explicaciones, comentarios que no pidan el contexto, ni delimitadores de bloque de código (\`\`\`).
- Escribe aproximadamente entre ${min} y ${max} palabras de código.
Devuelve únicamente el código de continuación, en texto plano.`,
    text,
  );
}

export function autocompleteMessages(
  text: string,
  minWords: number,
  maxWords: number,
): ChatMessage[] {
  const { min, max } = clampRange(minWords, maxWords);
  return messagesFor(
    `El contenido de <texto> es lo que el usuario lleva escrito y puede terminar a mitad de frase. Escribe su continuación inmediata. Instrucciones:
- Continúa exactamente desde donde termina, de modo que texto y continuación se lean como una sola pieza (si hay una frase a medias, complétala primero).
- Imita el estilo, el tono, el tiempo verbal y la persona del autor.
- No repitas ni reformules nada del texto original.
- Escribe entre ${min} y ${max} palabras.
Devuelve únicamente la continuación.`,
    text,
  );
}

export function editMessages(text: string, instruction: string): ChatMessage[] {
  return messagesFor(
    `Modifica el contenido de <texto> aplicando esta instrucción: "${instruction}". Instrucciones:
- Aplica únicamente los cambios que pide la instrucción; conserva todo lo demás tal cual.
- Mantén el idioma original salvo que la instrucción pida lo contrario.
Devuelve únicamente el texto modificado completo.`,
    text,
  );
}

export interface FormatOptions {
  paragraphs: boolean;
  punctuation: boolean;
  structure: boolean;
}

export function formatMessages(text: string, options: FormatOptions): ChatMessage[] {
  const rules: string[] = [];
  if (options.paragraphs) {
    rules.push(
      '- Organiza el texto en párrafos coherentes, con saltos de línea en blanco entre ellos.',
    );
  }
  if (options.punctuation) {
    rules.push(
      '- Corrige mayúsculas, minúsculas, tildes y puntuación siguiendo las normas ortográficas.',
    );
  }
  if (options.structure) {
    rules.push(
      '- Cuando el contenido lo sugiera, usa sintaxis Markdown (#, ##, -, 1.) para reflejar títulos y listas.',
    );
  }
  return messagesFor(
    `Da formato al contenido de <texto> sin cambiar su significado ni añadir información nueva. Instrucciones:
${rules.join('\n')}
- No resumas ni reescribas el contenido; conserva las palabras originales salvo los ajustes de formato indicados.
- Devuelve el texto en Markdown simple, listo para insertarse en un editor.
Devuelve únicamente el texto formateado.`,
    text,
  );
}

export async function generate(params: {
  messages: ChatMessage[];
  config: AiConfig;
  signal: AbortSignal;
  onDelta?: (fullTextSoFar: string) => void;
  maxTokens?: number;
}): Promise<string> {
  let full = '';
  await streamChat(
    params.config,
    params.messages,
    (delta) => {
      full += delta;
      params.onDelta?.(full);
    },
    params.signal,
    { maxTokens: params.maxTokens },
  );
  return full;
}
