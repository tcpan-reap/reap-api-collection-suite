#!/usr/bin/env node
/**
 * generate_postman_collection.js
 *
 * Fix: @babel/traverse ESM interop in Node 24
 * - In ESM, @babel/traverse exports a default function. Depending on bundling/interop,
 *   you may need traverse.default. This script normalizes it.
 *
 * Scans ONLY directories under ./tools whose name starts with a number:
 *   tools/1_..., tools/2_..., ..., tools/N_...
 *
 * Extracts axios.<method>(...) calls and generates:
 *   - generate_postman_schema/postman_collection.json
 *   - generate_postman_schema/postman_environment.template.json
 */

import fs from 'fs'
import path from 'path'
import process from 'process'
import { parse } from '@babel/parser'
import traverseImport from '@babel/traverse'

const traverse = typeof traverseImport === 'function' ? traverseImport : traverseImport.default

if (typeof traverse !== 'function') {
  console.error('Failed to load @babel/traverse as a function. Please ensure @babel/traverse is installed.')
  process.exit(1)
}

const args = new Map(
  process.argv.slice(2).flatMap((x, i, arr) => {
    if (!x.startsWith('--')) return []
    const key = x.slice(2)
    const val = arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true'
    return [[key, val]]
  })
)

const REPO_ROOT = process.cwd()
const TOOLS_DIR = path.resolve(REPO_ROOT, args.get('root') || './tools')
const COLLECTION_NAME = args.get('name') || 'Reap API Tools (Generated)'

const OUT_DIR = path.resolve(REPO_ROOT, 'generate_postman_schema')
const OUT_COLLECTION = path.join(OUT_DIR, 'postman_collection.json')
const OUT_ENV = path.join(OUT_DIR, 'postman_environment.template.json')

const CONSISTENT_HEADERS = [
  { key: 'x-reap-api-key', value: '{{API_KEY}}' },
  { key: 'Accept-Version', value: '{{ACCEPT_VERSION}}' },
  { key: 'Content-Type', value: 'application/json' },
  { key: 'accept', value: 'application/json' }
]

const DEFAULT_VARIABLES = [
  { key: 'API_BASE_URL', value: '' },
  { key: 'API_KEY', value: '' },
  { key: 'ACCEPT_VERSION', value: '' },
  { key: 'WEBHOOK_SUBSCRIBE_URL', value: '' }
]

/* -------------------- utils -------------------- */

const isDirectory = p => {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

const stableStringify = obj => {
  const seen = new WeakSet()

  const sorter = x => {
    if (x && typeof x === 'object') {
      if (seen.has(x)) return x
      seen.add(x)

      if (Array.isArray(x)) return x.map(sorter)

      return Object.keys(x)
        .sort()
        .reduce((o, k) => {
          o[k] = sorter(x[k])
          return o
        }, {})
    }
    return x
  }

  return JSON.stringify(sorter(obj), null, 2) + '\n'
}

const walkJsFilesRecursive = dir => {
  if (!isDirectory(dir)) return []

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    if (e.name === 'node_modules') return []

    const full = path.join(dir, e.name)
    if (e.isDirectory()) return walkJsFilesRecursive(full)
    if (e.isFile() && e.name.endsWith('.js')) return [full]
    return []
  })
}

/**
 * Only scan ./tools/<number>_* directories
 */
const collectJsFilesFromNumberedToolDirs = toolsDir => {
  if (!isDirectory(toolsDir)) return []

  const numberedDirs = fs
    .readdirSync(toolsDir, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const m = e.name.match(/^(\d+)(?:[_-].*)?$/)
      return m ? { name: e.name, index: Number(m[1]) } : null
    })
    .filter(Boolean)

  if (!numberedDirs.length) return []

  const maxIndex = Math.max(...numberedDirs.map(d => d.index))

  return numberedDirs
    .filter(d => d.index >= 1 && d.index <= maxIndex)
    .sort((a, b) => a.index - b.index)
    .flatMap(d => walkJsFilesRecursive(path.join(toolsDir, d.name)))
}

/* -------------------- axios extraction -------------------- */

const methodFromAxiosMember = callee => {
  if (!callee || callee.type !== 'MemberExpression') return null
  if (callee.object?.type !== 'Identifier' || callee.object.name !== 'axios') return null

  const prop = callee.property
  const name = prop?.type === 'Identifier' ? prop.name : null
  if (!name) return null

  const m = name.toUpperCase()
  return ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(m) ? m : null
}

const templateLiteralToPostmanRaw = node => {
  if (!node) return null
  if (node.type === 'StringLiteral') return node.value

  if (node.type === 'TemplateLiteral') {
    return node.quasis.reduce((raw, q, i) => {
      raw += q.value.cooked ?? ''
      if (i < node.expressions.length) {
        const expr = node.expressions[i]
        raw += expr.type === 'Identifier' ? `{{${expr.name}}}` : '{{VAR}}'
      }
      return raw
    }, '')
  }

  return null
}

const astLiteralToJsonValue = node => {
  if (!node) return undefined

  switch (node.type) {
    case 'StringLiteral':
    case 'NumericLiteral':
    case 'BooleanLiteral':
      return node.value
    case 'NullLiteral':
      return null
    case 'Identifier':
      return `{{${node.name}}}`
    case 'ObjectExpression':
      return Object.fromEntries(
        node.properties
          .filter(p => p.type === 'ObjectProperty')
          .map(p => {
            const key =
              p.key.type === 'Identifier'
                ? p.key.name
                : p.key.type === 'StringLiteral'
                  ? p.key.value
                  : null

            return [key ?? 'key', astLiteralToJsonValue(p.value)]
          })
      )
    case 'ArrayExpression':
      return node.elements.map(el => astLiteralToJsonValue(el))
    default:
      return '{{VALUE}}'
  }
}

const rawUrlToPostmanUrl = raw => {
  const url = { raw }
  const prefix = '{{API_BASE_URL}}'

  if (raw.startsWith(prefix)) {
    const rest = raw.slice(prefix.length)
    url.host = [prefix]
    url.path = rest.split('?')[0].split('/').filter(Boolean)
  }
  return url
}

const inferRequestName = (filePath, method, rawUrl) => {
  const rel = path.relative(REPO_ROOT, filePath).replace(/\\/g, '/')
  return `${method} ${rawUrl} (${rel})`
}

const extractAxiosRequestsFromFile = filePath => {
  const code = fs.readFileSync(filePath, 'utf8')

  let ast
  try {
    ast = parse(code, {
      sourceType: 'module',
      // your repo is ESM; allow modern syntax if present
      plugins: ['jsx', 'typescript', 'topLevelAwait', 'importMeta']
    })
  } catch {
    return []
  }

  const found = []

  traverse(ast, {
    CallExpression(p) {
      const node = p.node
      const method = methodFromAxiosMember(node.callee)
      if (!method) return

      const [urlNode, arg2Node] = node.arguments
      const rawUrl = templateLiteralToPostmanRaw(urlNode)
      if (!rawUrl) return

      // For GET/DELETE etc, arg2 is usually config (no body)
      const body =
        ['POST', 'PUT', 'PATCH'].includes(method) ? astLiteralToJsonValue(arg2Node) ?? '{{BODY}}' : null

      found.push({ filePath, method, rawUrl, body })
    }
  })

  return found
}

/* -------------------- postman builders -------------------- */

const buildPostmanCollection = requests => ({
  info: {
    name: COLLECTION_NAME,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  variable: DEFAULT_VARIABLES,
  item: requests
    .slice()
    .sort((a, b) =>
      `${a.rawUrl}::${a.method}::${a.filePath}`.localeCompare(
        `${b.rawUrl}::${b.method}::${b.filePath}`
      )
    )
    .map(r => ({
      name: inferRequestName(r.filePath, r.method, r.rawUrl),
      request: {
        method: r.method,
        header: CONSISTENT_HEADERS,
        url: rawUrlToPostmanUrl(r.rawUrl),
        ...(r.body && {
          body: {
            mode: 'raw',
            raw: stableStringify(r.body).trimEnd(),
            options: { raw: { language: 'json' } }
          }
        })
      }
    }))
})

const buildEnvironmentTemplate = () => ({
  name: 'Reap API (Template)',
  values: DEFAULT_VARIABLES.map(v => ({
    key: v.key,
    value: v.value,
    enabled: true,
    type: 'default'
  })),
  _postman_variable_scope: 'environment',
  _postman_exported_at: new Date().toISOString(),
  _postman_exported_using: 'generate_postman_schema'
})

/* -------------------- main -------------------- */

const main = () => {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const jsFiles = collectJsFilesFromNumberedToolDirs(TOOLS_DIR)
  const requests = jsFiles.flatMap(extractAxiosRequestsFromFile)

  fs.writeFileSync(OUT_COLLECTION, stableStringify(buildPostmanCollection(requests)), 'utf8')
  fs.writeFileSync(OUT_ENV, stableStringify(buildEnvironmentTemplate()), 'utf8')

  console.log(`Scanned numbered tool dirs in ${TOOLS_DIR}`)
  console.log(`JS files found: ${jsFiles.length}`)
  console.log(`Axios requests extracted: ${requests.length}`)
  console.log(`Generated: ${OUT_COLLECTION}`)
  console.log(`Generated: ${OUT_ENV}`)
}

main()
