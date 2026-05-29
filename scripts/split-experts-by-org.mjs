#!/usr/bin/env node
/**
 * 将 data/experts/by-honor/*.json 按 university 拆分为 data/experts/by-org/
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from 'fs'
import { join } from 'path'
import {
  DATA_DIR,
  EXPERTS_BY_HONOR_DIR,
  EXPERTS_BY_ORG_DIR,
  PATHS,
} from './lib/data-paths.mjs'
import { normalizeOrgName, slugifyOrg, UNKNOWN_ORG } from './lib/normalize-org.mjs'

function loadExperts() {
  if (!existsSync(EXPERTS_BY_HONOR_DIR)) return []
  const files = readdirSync(EXPERTS_BY_HONOR_DIR).filter((f) => f.endsWith('.json'))
  const experts = []
  const seen = new Set()

  for (const file of files) {
    const raw = JSON.parse(readFileSync(join(EXPERTS_BY_HONOR_DIR, file), 'utf-8'))
    const list = Array.isArray(raw) ? raw : [raw]
    for (const e of list) {
      if (!e?.name) continue
      const id = e.id || e.name
      if (seen.has(id)) continue
      seen.add(id)
      experts.push({
        ...e,
        id,
        university: normalizeOrgName(e.university, e.field || e.title),
      })
    }
  }

  return experts
}

function loadUniversities() {
  if (!existsSync(PATHS.universities)) return []
  return JSON.parse(readFileSync(PATHS.universities, 'utf-8'))
}

function matchUniversityId(orgName, universities) {
  if (!orgName || orgName === UNKNOWN_ORG) return undefined
  for (const u of universities) {
    if (orgName === u.name) return u.id
    if (orgName.includes(u.name) || u.name.includes(orgName)) return u.id
    if (orgName.includes(u.shortName)) return u.id
  }
  return undefined
}

function main() {
  const experts = loadExperts()
  const universities = loadUniversities()
  const groups = new Map()

  for (const expert of experts) {
    const orgName = expert.university || UNKNOWN_ORG
    const orgId = slugifyOrg(orgName)
    if (!groups.has(orgId)) {
      groups.set(orgId, {
        id: orgId,
        name: orgName,
        universityId: matchUniversityId(orgName, universities),
        experts: [],
      })
    }
    groups.get(orgId).experts.push(expert)
  }

  mkdirSync(EXPERTS_BY_ORG_DIR, { recursive: true })
  for (const file of readdirSync(EXPERTS_BY_ORG_DIR)) {
    if (file.endsWith('.json')) rmSync(join(EXPERTS_BY_ORG_DIR, file), { force: true })
  }

  const index = []
  for (const group of groups.values()) {
    group.experts.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    group.count = group.experts.length
    const filename = `${group.id}.json`
    writeFileSync(join(EXPERTS_BY_ORG_DIR, filename), `${JSON.stringify(group, null, 2)}\n`, 'utf-8')
    index.push({
      id: group.id,
      name: group.name,
      universityId: group.universityId,
      count: group.count,
      file: `by-org/${filename}`,
    })
  }

  index.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'))
  writeFileSync(
    PATHS.orgIndex,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), orgs: index }, null, 2)}\n`,
    'utf-8'
  )

  console.log(`已拆分 ${experts.length} 人 → ${groups.size} 个单位`)
  console.log(`  荣誉汇总: ${EXPERTS_BY_HONOR_DIR.replace(DATA_DIR, 'data')}`)
  console.log(`  单位索引: data/experts/by-org/_index.json`)
}

main()
