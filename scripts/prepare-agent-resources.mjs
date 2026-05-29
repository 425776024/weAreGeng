#!/usr/bin/env node
/**
 * Stage Node + agent bundle into src-tauri/resources/agent-runtime for Tauri packaging.
 * Usage: node scripts/prepare-agent-resources.mjs [--target aarch64-apple-darwin]
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { chmod } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function parseTarget() {
  const args = process.argv.slice(2)
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) return args[++i]
  }
  return process.env.TARGET ?? execSync('rustc --print host-tuple', { encoding: 'utf8' }).trim()
}

async function main() {
  const target = parseTarget()
  const nodeSrc = join(root, 'vendor/node', target)
  const nodeBin = join(nodeSrc, process.platform === 'win32' ? 'node.exe' : 'bin/node')
  const agentBundle = join(root, 'dist/agent-runner.mjs')
  const dest = join(root, 'src-tauri/resources/agent-runtime')

  if (!existsSync(nodeBin)) {
    console.error(`[prepare-agent-resources] missing ${nodeBin} — run: npm run setup:node -- --target ${target}`)
    process.exit(1)
  }
  if (!existsSync(agentBundle)) {
    console.error(`[prepare-agent-resources] missing ${agentBundle} — run: npm run build:agent`)
    process.exit(1)
  }

  rmSync(dest, { recursive: true, force: true })
  mkdirSync(dest, { recursive: true })
  mkdirSync(join(dest, 'bin'), { recursive: true })

  const isWin = target.includes('windows') || target.includes('pc-windows-msvc')
  if (isWin) {
    cpSync(join(nodeSrc, 'node.exe'), join(dest, 'bin/node.exe'))
  } else {
    cpSync(join(nodeSrc, 'bin/node'), join(dest, 'bin/node'))
    await chmod(join(dest, 'bin/node'), 0o755)
    cpSync(join(nodeSrc, 'lib'), join(dest, 'lib'), { recursive: true })
    if (existsSync(join(nodeSrc, 'share'))) {
      cpSync(join(nodeSrc, 'share'), join(dest, 'share'), { recursive: true })
    }
  }

  cpSync(agentBundle, join(dest, 'agent-runner.mjs'))
  const mapFile = join(root, 'dist/agent-runner.mjs.map')
  if (existsSync(mapFile)) {
    cpSync(mapFile, join(dest, 'agent-runner.mjs.map'))
  }

  const dataExperts = join(root, 'data/experts')
  if (existsSync(dataExperts)) {
    cpSync(dataExperts, join(dest, 'data/experts'), { recursive: true })
  }

  writeFileSync(
    join(dest, 'manifest.json'),
    `${JSON.stringify({ target, nodeVersion: JSON.parse(readFileSync(join(nodeSrc, 'manifest.json'), 'utf8')).version }, null, 2)}\n`,
  )

  console.log(`[prepare-agent-resources] staged -> ${dest} (${target})`)
}

main().catch((err) => {
  console.error('[prepare-agent-resources]', err)
  process.exit(1)
})
