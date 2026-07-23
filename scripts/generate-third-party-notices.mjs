#!/usr/bin/env node
// Regenerate THIRD-PARTY-NOTICES.md from the license metadata actually present in node_modules.
// Run with: npm run notices

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const nodeModulesDir = path.join(rootDir, 'node_modules')

const LICENSE_FILENAMES = [
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'License',
  'License.md',
  'license',
  'LICENCE',
  'LICENCE.md',
]

function findLicenseFile(pkgDir) {
  for (const name of LICENSE_FILENAMES) {
    const p = path.join(pkgDir, name)
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

function licenseIdOf(pkgJson) {
  if (typeof pkgJson.license === 'string') return pkgJson.license
  if (pkgJson.license && typeof pkgJson.license === 'object') return pkgJson.license.type
  if (Array.isArray(pkgJson.licenses)) return pkgJson.licenses.map((l) => l.type).join(' OR ')
  return 'UNKNOWN'
}

function collectPackages(dir, scope, acc) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue

    if (entry.name.startsWith('@')) {
      collectPackages(path.join(dir, entry.name), entry.name, acc)
      continue
    }

    const pkgDir = path.join(dir, entry.name)
    const pkgJsonPath = path.join(pkgDir, 'package.json')
    if (!existsSync(pkgJsonPath)) continue

    try {
      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf8'))
      const name = scope ? `${scope}/${entry.name}` : entry.name
      const licenseFile = findLicenseFile(pkgDir)
      acc.set(name, {
        name,
        version: pkgJson.version ?? 'unknown',
        license: licenseIdOf(pkgJson),
        licenseText: licenseFile ? readFileSync(licenseFile, 'utf8').trim() : null,
        homepage: pkgJson.homepage ?? (pkgJson.repository && (pkgJson.repository.url || pkgJson.repository)) ?? '',
      })
    } catch {
      // skip unreadable package.json
    }
  }
}

const packages = new Map()
collectPackages(nodeModulesDir, null, packages)

const sorted = [...packages.values()].sort((a, b) => a.name.localeCompare(b.name))

let out = ''
out += '# Avisos de terceros (Third-Party Notices)\n\n'
out += 'GoWrite se construye con las siguientes dependencias de código abierto. '
out += 'Este fichero se genera automáticamente con `npm run notices` a partir de las licencias '
out += `declaradas en \`node_modules\` (${sorted.length} paquetes en el momento de la generación) `
out += 'y se conserva para cumplir con los términos de atribución de cada licencia (MIT, BSD, Apache-2.0, etc.).\n\n'
out += '---\n\n'

for (const p of sorted) {
  out += `## ${p.name}@${p.version}\n\n`
  out += `- Licencia: ${p.license}\n`
  if (p.homepage) out += `- Fuente: ${typeof p.homepage === 'string' ? p.homepage.replace(/^git\+/, '') : ''}\n`
  out += '\n'
  if (p.licenseText) {
    out += '```\n' + p.licenseText + '\n```\n\n'
  } else {
    out += '_No se encontró un fichero de licencia dentro del paquete; se indica únicamente el identificador SPDX declarado._\n\n'
  }
  out += '---\n\n'
}

writeFileSync(path.join(rootDir, 'THIRD-PARTY-NOTICES.md'), out)
console.log(`THIRD-PARTY-NOTICES.md generado con ${sorted.length} paquetes.`)
