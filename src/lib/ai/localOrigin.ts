/** True when GoWrite itself is being served from localhost/127.0.0.1 — e.g. `npm run dev`. */
export function isLocalPage(): boolean {
  const h = window.location.hostname
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]'
}

/**
 * A request to a "Custom" (local) server fails identically in the fetch API whether the server
 * is simply offline, or whether it's running fine but rejecting the request over CORS — this is
 * the single most common trap with this provider: it works from `localhost:5173` during
 * development because the local server's default CORS allowlist happens to include localhost,
 * then silently breaks once GoWrite is deployed to a real domain, because that domain's origin
 * was never added to the server's allowlist. We can't tell the two failure modes apart from the
 * fetch error alone, so once we know the page itself isn't local, the message leads with the
 * CORS explanation (the likely cause after a deploy) instead of just "is it running?".
 */
export function localServerUnreachableMessage(): string {
  if (isLocalPage()) {
    return 'No se pudo contactar con el servidor local. Comprueba que está en marcha y que el endpoint es correcto.'
  }
  return (
    'No se pudo contactar con el servidor local. Como GoWrite no se está sirviendo desde "localhost", esto casi ' +
    'siempre significa que el servidor está rechazando la petición por CORS, no que esté apagado: la mayoría de ' +
    `servidores locales (p. ej. Ollama) solo aceptan peticiones desde su propio origen. Añade "${window.location.origin}" ` +
    'a la lista de orígenes permitidos del servidor y reinícialo (en Ollama: variable de entorno OLLAMA_ORIGINS) y ' +
    'vuelve a intentarlo.'
  )
}
