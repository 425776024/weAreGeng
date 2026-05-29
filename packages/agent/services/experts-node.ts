import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface NodeExpert {
  id: string
  name: string
  title?: string
  university?: string
  field?: string
  tags?: string[]
}

let cached: NodeExpert[] | null = null

function expertsRoot(): string {
  const base = process.env.WEAREGENG_DATA_DIR ?? join(process.cwd(), 'data', 'experts')
  const byHonor = join(base, 'by-honor')
  return existsSync(byHonor) ? byHonor : base
}

export function loadExpertsFromDisk(): NodeExpert[] {
  if (cached) return cached
  const dir = expertsRoot()
  if (!existsSync(dir)) {
    cached = []
    return cached
  }
  const experts: NodeExpert[] = []
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.json') || file.startsWith('.')) continue
    try {
      const raw = readFileSync(join(dir, file), 'utf-8')
      const parsed = JSON.parse(raw) as NodeExpert[] | { experts?: NodeExpert[] }
      const list = Array.isArray(parsed) ? parsed : (parsed.experts ?? [])
      experts.push(...list)
    } catch {
      // skip invalid files
    }
  }
  cached = experts
  return experts
}

export function searchExpertsOnDisk(name: string, limit = 20): NodeExpert[] {
  const q = name.toLowerCase()
  return loadExpertsFromDisk()
    .filter((e) => e.name.includes(name) || e.name.toLowerCase().includes(q))
    .slice(0, limit)
}
