#!/usr/bin/env node
/**
 * Download portable Node.js into vendor/node/{target-triple}/
 * Usage: node scripts/setup-node.mjs [--target aarch64-apple-darwin] [--version 22.13.1]
 */
import { createWriteStream, existsSync, mkdirSync, rmSync, symlinkSync, unlinkSync } from 'node:fs'
import { chmod, copyFile, mkdir, readdir, rename } from 'node:fs/promises'
import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const NODE_VERSION = process.env.NODE_VERSION ?? '22.13.1'

const TRIPLE_TO_NODE = {
  'aarch64-apple-darwin': 'darwin-arm64',
  'x86_64-apple-darwin': 'darwin-x64',
  'aarch64-unknown-linux-gnu': 'linux-arm64',
  'x86_64-unknown-linux-gnu': 'linux-x64',
  'x86_64-pc-windows-msvc': 'win-x64',
}

function parseArgs() {
  const args = process.argv.slice(2)
  let target = process.env.TARGET ?? process.env.CARGO_BUILD_TARGET
  let version = NODE_VERSION
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--target' && args[i + 1]) target = args[++i]
    if (args[i] === '--version' && args[i + 1]) version = args[++i]
  }
  if (!target) {
    target = execSync('rustc --print host-tuple', { encoding: 'utf8' }).trim()
  }
  return { target, version }
}

async function download(url, dest) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`)
  await pipeline(res.body, createWriteStream(dest))
}

async function extractTarXz(archive, destDir) {
  mkdirSync(destDir, { recursive: true })
  execSync(`tar -xJf "${archive}" -C "${destDir}"`, { stdio: 'inherit' })
}

async function extractZip(archive, destDir) {
  mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${archive}' -DestinationPath '${destDir}' -Force"`, {
      stdio: 'inherit',
    })
  } else {
    execSync(`unzip -q -o "${archive}" -d "${destDir}"`, { stdio: 'inherit' })
  }
}

async function flattenNodeDir(extractDir, outDir, folderPrefix) {
  const entries = await readdir(extractDir)
  const folder = entries.find((e) => e.startsWith(folderPrefix))
  if (!folder) throw new Error(`Node extract folder not found in ${extractDir}`)
  const src = join(extractDir, folder)
  rmSync(outDir, { recursive: true, force: true })
  await rename(src, outDir)
}

async function main() {
  const { target, version } = parseArgs()
  const nodePlatform = TRIPLE_TO_NODE[target]
  if (!nodePlatform) {
    throw new Error(`Unsupported target triple: ${target}`)
  }

  const isWin = nodePlatform.startsWith('win')
  const ext = isWin ? 'zip' : 'tar.xz'
  const folderPrefix = `node-v${version}-`
  const filename = `node-v${version}-${nodePlatform}.${ext}`
  const url = `https://nodejs.org/dist/v${version}/${filename}`

  const vendorNode = join(root, 'vendor/node')
  const outDir = join(vendorNode, target)
  const staging = join(vendorNode, '.cache', target)
  const archive = join(staging, filename)

  mkdirSync(staging, { recursive: true })

  const nodeBin = join(outDir, isWin ? 'node.exe' : 'bin/node')
  if (existsSync(nodeBin)) {
    console.log(`[setup-node] ${target} already present at ${outDir}`)
  } else {
    console.log(`[setup-node] downloading ${url}`)
    await download(url, archive)
    const extractRoot = join(staging, 'extract')
    rmSync(extractRoot, { recursive: true, force: true })
    if (isWin) {
      await extractZip(archive, extractRoot)
    } else {
      await extractTarXz(archive, extractRoot)
    }
    await flattenNodeDir(extractRoot, outDir, folderPrefix)
    if (!isWin) {
      await chmod(nodeBin, 0o755)
    }
    console.log(`[setup-node] installed -> ${outDir}`)
  }

  // Symlink vendor/node/current -> host triple (local dev)
  if (target === execSync('rustc --print host-tuple', { encoding: 'utf8' }).trim()) {
    const currentLink = join(vendorNode, 'current')
    try {
      unlinkSync(currentLink)
    } catch {
      // ignore
    }
    try {
      symlinkSync(outDir, currentLink, 'dir')
      console.log(`[setup-node] linked vendor/node/current -> ${target}`)
    } catch {
      // Windows may need junction; copy marker file instead
      await mkdir(vendorNode, { recursive: true })
      await copyFile(join(outDir, isWin ? 'node.exe' : 'bin/node'), join(vendorNode, 'current-node' + (isWin ? '.exe' : '')))
    }
  }

  // Write manifest for Rust/build scripts
  const manifest = {
    version,
    target,
    nodePlatform,
    nodeBin: isWin ? 'node.exe' : 'bin/node',
    path: outDir,
  }
  await mkdir(outDir, { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  await writeFile(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
}

main().catch((err) => {
  console.error('[setup-node]', err)
  process.exit(1)
})
