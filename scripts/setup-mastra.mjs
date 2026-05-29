#!/usr/bin/env node
/**
 * Prepare installable Mastra packages for npm `file:` dependencies.
 * - vendor/mastra — upstream source clone (read/patch/build)
 * - vendor/mastra-packages — npm-pack snapshots with resolved package.json
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const vendorSource = join(root, 'vendor/mastra/packages')
const vendorPackages = join(root, 'vendor/mastra-packages')

const packages = [
  { name: '@mastra/schema-compat', dir: 'schema-compat' },
  { name: '@mastra/core', dir: 'core' },
  { name: '@mastra/mcp', dir: 'mcp' },
  { name: '@mastra/memory', dir: 'memory' },
  { name: '@mastra/libsql', dir: 'libsql' },
]

function hasInstallable(dir) {
  return existsSync(join(vendorPackages, dir, 'dist', 'index.js'))
}

function copyDistFromSource(dir) {
  const src = join(vendorSource, dir, 'dist')
  const dest = join(vendorPackages, dir, 'dist')
  if (!existsSync(src)) return false
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  return true
}

function copyDistFromPath(srcRoot, dir) {
  const src = join(srcRoot, 'dist')
  const dest = join(vendorPackages, dir, 'dist')
  if (!existsSync(src)) return false
  rmSync(dest, { recursive: true, force: true })
  cpSync(src, dest, { recursive: true })
  return true
}

function tryVendorBuildLibsql() {
  try {
    execSync('pnpm --filter @mastra/libsql run build:lib', {
      cwd: join(root, 'vendor/mastra'),
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

function extractFromNpmPack(pkgName, dir) {
  const staging = join(root, 'node_modules/.mastra-setup', pkgName.replace('/', '-'))
  mkdirSync(staging, { recursive: true })

  execSync(`npm pack ${pkgName} --pack-destination "${staging}"`, {
    cwd: root,
    stdio: 'inherit',
  })

  const packed = execSync(`ls -1 "${staging}"/*.tgz | tail -1`, { encoding: 'utf8' }).trim()
  const extractDir = join(staging, 'extract')
  rmSync(extractDir, { recursive: true, force: true })
  mkdirSync(extractDir, { recursive: true })
  execSync(`tar -xzf "${packed}" -C "${extractDir}"`, { stdio: 'inherit' })

  const target = join(vendorPackages, dir)
  rmSync(target, { recursive: true, force: true })
  cpSync(join(extractDir, 'package'), target, { recursive: true })
  console.log(`[setup-mastra] synced ${pkgName} -> vendor/mastra-packages/${dir}`)
}

function tryVendorBuild() {
  try {
    execSync('pnpm --filter @mastra/schema-compat run build:lib', {
      cwd: join(root, 'vendor/mastra'),
      stdio: 'pipe',
    })
    execSync('pnpm --filter @mastra/core run build:lib', {
      cwd: join(root, 'vendor/mastra'),
      stdio: 'pipe',
    })
    execSync('pnpm --filter @mastra/mcp run build:lib', {
      cwd: join(root, 'vendor/mastra'),
      stdio: 'pipe',
    })
    execSync('pnpm --filter @mastra/memory run build:lib', {
      cwd: join(root, 'vendor/mastra'),
      stdio: 'pipe',
    })
    return true
  } catch {
    return false
  }
}

function sanitizePackageJson(dir) {
  const pkgPath = join(vendorPackages, dir, 'package.json')
  if (!existsSync(pkgPath)) return
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  delete pkg.devDependencies
  if (dir === 'core' && pkg.dependencies?.['@mastra/schema-compat']) {
    pkg.dependencies['@mastra/schema-compat'] = 'file:../schema-compat'
  }
  if (dir === 'mcp' && pkg.dependencies?.['@mastra/core']) {
    pkg.dependencies['@mastra/core'] = 'file:../core'
  }
  if (dir === 'memory' && pkg.dependencies?.['@mastra/schema-compat']) {
    pkg.dependencies['@mastra/schema-compat'] = 'file:../schema-compat'
  }
  if (dir === 'memory' && pkg.peerDependencies?.['@mastra/core']) {
    pkg.peerDependencies['@mastra/core'] = 'file:../core'
  }
  if (dir === 'libsql' && pkg.peerDependencies?.['@mastra/core']) {
    pkg.peerDependencies['@mastra/core'] = 'file:../core'
  }
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`)
}

function syncPackage(dir) {
  mkdirSync(join(vendorPackages, dir), { recursive: true })

  if (tryVendorBuild() && copyDistFromSource(dir)) {
    const pkgJsonPath = join(vendorSource, dir, 'package.json')
    if (existsSync(pkgJsonPath)) {
      cpSync(pkgJsonPath, join(vendorPackages, dir, 'package.json'))
    }
    sanitizePackageJson(dir)
    console.log(`[setup-mastra] built ${dir} from vendor/mastra source`)
    return
  }

  if (dir === 'libsql') {
    const libsqlSrc = join(root, 'vendor/mastra/stores/libsql')
    if (tryVendorBuildLibsql() && copyDistFromPath(libsqlSrc, dir)) {
      const pkgJsonPath = join(libsqlSrc, 'package.json')
      if (existsSync(pkgJsonPath)) {
        cpSync(pkgJsonPath, join(vendorPackages, dir, 'package.json'))
      }
      sanitizePackageJson(dir)
      console.log('[setup-mastra] built libsql from vendor/mastra/stores/libsql')
      return
    }
  }

  const meta = packages.find((p) => p.dir === dir)
  if (meta) extractFromNpmPack(meta.name, dir)
  sanitizePackageJson(dir)
}

mkdirSync(vendorPackages, { recursive: true })

const missing = packages.filter((p) => !hasInstallable(p.dir))
if (missing.length === 0) {
  for (const pkg of packages) sanitizePackageJson(pkg.dir)
  console.log('[setup-mastra] vendor/mastra-packages already present')
  process.exit(0)
}

console.log('[setup-mastra] preparing:', missing.map((p) => p.dir).join(', '))

for (const pkg of packages) {
  if (!hasInstallable(pkg.dir)) {
    syncPackage(pkg.dir)
  }
}

for (const pkg of packages) sanitizePackageJson(pkg.dir)

console.log('[setup-mastra] done')
