import { useEffect, useState } from 'react'

const PHRASES = [
  'Chimpancés escribiendo a máquina…',
  'Generando mediante robots…',
  'Tecleando muy deprisa…',
  'Consultando a las musas…',
  'Afilando lápices digitales…',
  'Sobornando al corrector ortográfico…',
  'Despertando a las neuronas artificiales…',
]

export function FunnyLoader() {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * PHRASES.length))

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % PHRASES.length), 2200)
    return () => window.clearInterval(id)
  }, [])

  return (
    // A single static aria-label announces "generating" once; the rotating phrase is aria-hidden
    // so screen readers aren't spammed with a new announcement every 2.2s.
    <span className="funny-loader" role="status" aria-live="polite" aria-label="Generando respuesta de la IA, por favor espera">
      <span className="spinner" aria-hidden="true" />
      <span className="funny-loader-text" aria-hidden="true">{PHRASES[index]}</span>
    </span>
  )
}
