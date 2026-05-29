#!/usr/bin/env node
/**
 * Bundle Mastra agent worker for production (no tsx required).
 */
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'dist')
const outfile = join(outDir, 'agent-runner.mjs')

mkdirSync(outDir, { recursive: true })

console.log('[build-agent-runner] bundling packages/agent/runner/stdio.ts ...')

await build({
  entryPoints: [join(root, 'packages/agent/runner/stdio.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  outfile,
  sourcemap: true,
  logLevel: 'info',
  banner: {
    js: "import { createRequire as __createRequire } from 'module'; const require = __createRequire(import.meta.url);",
  },
  // Mastra ships many packages; keep heavy optional native deps external if needed
  external: ['@yogsoth-ai/semantic-scholar-mcp'],
})

console.log(`[build-agent-runner] wrote ${outfile}`)
