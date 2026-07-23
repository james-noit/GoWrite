/**
 * The user only provides the base server URL (e.g. http://127.0.0.1:1234 for LM Studio,
 * http://localhost:11434 for Ollama). We always append the correct OpenAI-compatible path
 * ourselves, discarding any path the user may have typed — this is what most local-LLM
 * servers get wrong when configured by hand (e.g. /v1/completions instead of /v1/chat/completions).
 */
function origin(base: string): string {
  return new URL(base.trim()).origin
}

export function customChatCompletionsUrl(base: string): string {
  return `${origin(base)}/v1/chat/completions`
}

export function customModelsUrl(base: string): string {
  return `${origin(base)}/v1/models`
}
