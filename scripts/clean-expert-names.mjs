#!/usr/bin/env node
/** 清洗 by-honor 汇总中的误识别姓名（导航、单位名、研究方向等） */
import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { EXPERTS_BY_HONOR_DIR, CRAWL_DIR, ROOT } from './lib/data-paths.mjs'
import {
  classifyInvalidExpertRecord,
  isValidExpertRecord,
  mergeAllExperts,
} from './lib/talent-parsers.mjs'

const HONOR_FILES = readdirSync(EXPERTS_BY_HONOR_DIR).filter((f) => f.endsWith('.json'))

function cleanList(list, label) {
  const kept = []
  const removed = []
  const reasons = {}

  for (const row of list) {
    if (isValidExpertRecord(row)) {
      kept.push(row)
      continue
    }
    removed.push(row)
    const reason = classifyInvalidExpertRecord(row)
    reasons[reason] = (reasons[reason] || 0) + 1
  }

  console.log(`  ${label}: ${list.length} → ${kept.length}（移除 ${removed.length}）`)
  if (removed.length) {
    const reasonText = Object.entries(reasons)
      .filter(([k]) => k !== 'valid')
      .map(([k, n]) => `${k} ${n}`)
      .join('，')
    console.log(`    原因: ${reasonText}`)
    console.log(
      `    示例: ${removed
        .slice(0, 10)
        .map((r) => r.name)
        .join('、')}${removed.length > 10 ? '…' : ''}`
    )
  }
  return kept
}

let totalRemoved = 0
for (const file of HONOR_FILES) {
  const path = join(EXPERTS_BY_HONOR_DIR, file)
  const list = JSON.parse(readFileSync(path, 'utf-8'))
  const cleaned = cleanList(list, file)
  totalRemoved += list.length - cleaned.length
  writeFileSync(path, `${JSON.stringify(cleaned, null, 2)}\n`, 'utf-8')
}

const uniPath = join(CRAWL_DIR, 'university-talents.json')
try {
  const uni = JSON.parse(readFileSync(uniPath, 'utf-8'))
  const cleanedUni = cleanList(uni, 'university-talents.json')
  writeFileSync(uniPath, `${JSON.stringify(cleanedUni, null, 2)}\n`, 'utf-8')
} catch {
  /* optional */
}

console.log(`\n合计移除 ${totalRemoved} 条无效记录`)

const { spawnSync } = await import('child_process')
const split = spawnSync('node', ['scripts/split-experts-by-org.mjs'], {
  cwd: ROOT,
  stdio: 'inherit',
})
if (split.status !== 0) process.exit(split.status ?? 1)

const all = HONOR_FILES.flatMap((f) =>
  JSON.parse(readFileSync(join(EXPERTS_BY_HONOR_DIR, f), 'utf-8'))
)
console.log(`清洗后 ${mergeAllExperts([all]).length} 人（按姓名+荣誉去重）`)
