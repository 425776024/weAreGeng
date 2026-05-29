#!/usr/bin/env node
/**
 * 从政府机构及高校公开网页抓取人才名单，写入 data/experts/
 */
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { fetchText } from './lib/http.mjs'
import {
  parseCasAcademicians,
  parseCasElectionList,
  parseCaeAcademicians,
  parseCaeElectionList,
  parseNsfcFundingTable,
  parseUniversityTalentPage,
  discoverNsfcTalentListPages,
  extractCaeProfileUniversity,
  mergeAllExperts,
  buildUniversityProbeUrls,
  parseNationalTalentPage,
  getUniversityDomain,
} from './lib/talent-parsers.mjs'
import { OFFICIAL_SOURCES } from './lib/official-sources.mjs'
import { UNIVERSITY_TALENT_SOURCES } from './lib/university-talent-sources.mjs'
import { CURATED_UNIVERSITY_PAGES } from './lib/curated-university-pages.mjs'
import {
  NATIONAL_TALENT_SOURCES,
  NSFC_LIFE_SCIENCE_PAGE_RANGE,
} from './lib/national-talent-sources.mjs'
import { NCKU1897_SOURCES } from './lib/ncku1897-sources.mjs'
import { YOUQING_MIRROR_SOURCES } from './lib/youqing-mirror-sources.mjs'
import {
  CRAWL_DIR,
  EXPERTS_BY_HONOR_DIR,
  EXPERTS_DIR,
  PATHS,
} from './lib/data-paths.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT_DIR = EXPERTS_BY_HONOR_DIR
const MANIFEST_PATH = PATHS.manifest
const UNIVERSITIES_PATH = PATHS.universities
const DISCOVERED_PATH = PATHS.discoveredUniversityPages
const UNIVERSITY_TALENTS_PATH = PATHS.universityTalents

const CAE_PROFILE_LIMIT = Number(process.env.CAE_PROFILE_LIMIT || 950)
const UNI_PROBE = process.env.UNI_PROBE !== '0'
const UNI_QUICK_PROBE = process.env.UNI_QUICK_PROBE !== '0'
const UNI_PROBE_CONCURRENCY = Number(process.env.UNI_PROBE_CONCURRENCY || 12)
const UNI_QUICK_PROBE_CONCURRENCY = Number(process.env.UNI_QUICK_PROBE_CONCURRENCY || 16)
const MIN_UNI_ROWS = Number(process.env.MIN_UNI_ROWS || 5)

function writeJson(name, data) {
  writeFileSync(join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, 'utf-8')
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function enrichCaeProfiles(cae, limit) {
  let enriched = 0
  const targets = cae.filter((p) => !p.university?.trim() && p.profilePath).slice(0, limit)
  console.log(`  补全工程院院士单位（${targets.length}/${cae.length}，上限 ${limit}）…`)

  for (const person of targets) {
    try {
      const url = `https://www.cae.cn${person.profilePath}`
      const html = fetchText(url)
      const university = extractCaeProfileUniversity(html)
      if (university) {
        person.university = university
        person.source = url
        enriched++
      }
    } catch {
      /* skip */
    }
    if (enriched % 50 === 0 && enriched > 0) process.stdout.write(`    ${enriched}… `)
    await sleep(60)
  }
  console.log(`\n  工程院院士单位补全: ${enriched} 人`)
  return cae
}

function fetchNationalTalentLists() {
  let rows = []
  const sources = [...NATIONAL_TALENT_SOURCES, ...NCKU1897_SOURCES, ...YOUQING_MIRROR_SOURCES]
  console.log(
    `\n抓取全国杰青/优青公示（${sources.length} 源，含 ncku1897 ${NCKU1897_SOURCES.length} 页、优青镜像 ${YOUQING_MIRROR_SOURCES.length} 页）…`
  )
  for (const src of sources) {
    if (src.disabled) continue
    try {
      const html = fetchText(src.url, undefined, src.parser === 'ncku-wiki' ? 25 : 20)
      const parsed = parseNationalTalentPage(html, src)
      if (parsed.length) {
        rows.push(...parsed)
        console.log(`  ✓ ${src.year} ${src.honor}: ${parsed.length} — ${src.url.slice(0, 72)}…`)
      }
    } catch {
      console.log(`  ✗ ${src.year} ${src.honor}: ${src.url.slice(0, 60)}…`)
    }
  }
  return mergeAllExperts([rows])
}

function fetchNsfcDepartmentPages() {
  const pages = new Map()
  const indexUrls = [
    OFFICIAL_SOURCES.nsfcLifeSciencesIndex.url,
    ...Array.from({ length: 9 }, (_, i) => `https://www.nsfc.gov.cn/p1/2853/3102/sqyzz${i + 1}.html`),
  ]

  for (const indexUrl of indexUrls) {
    try {
      const indexHtml = fetchText(indexUrl, undefined, 15)
      for (const p of discoverNsfcTalentListPages(indexHtml, 'https://www.nsfc.gov.cn')) {
        pages.set(p.path, p)
      }
    } catch {
      /* skip dead index */
    }
  }

  for (let i = NSFC_LIFE_SCIENCE_PAGE_RANGE.from; i <= NSFC_LIFE_SCIENCE_PAGE_RANGE.to; i++) {
    const path = `/p1/2853/3102/${i}.html`
    if (!pages.has(path)) {
      pages.set(path, {
        path,
        url: `https://www.nsfc.gov.cn${path}`,
        title: path,
      })
    }
  }

  let jieqing = []
  let youqing = []
  for (const page of pages.values()) {
    try {
      const html = fetchText(page.url)
      const rows = parseNsfcFundingTable(html, page)
      if (!rows.length) continue
      const honor = rows[0].honor
      if (honor === '优青') youqing.push(...rows)
      else jieqing.push(...rows)
      console.log(`  NSFC ${page.title || page.path}: ${rows.length} 人`)
    } catch {
      /* skip dead links */
    }
  }
  return {
    jieqing: mergeAllExperts([jieqing]),
    youqing: mergeAllExperts([youqing]),
    pages: [...pages.values()],
  }
}

async function probeOneUniversity(uni) {
  for (const url of buildUniversityProbeUrls(uni.id)) {
    try {
      const html = fetchText(url, undefined, 8)
      if (html.length < 6000 || !/杰青|杰出青年|优青|优秀青年|千青|青年千人|gjjcqn|yxqn|yxqx|qqrj/i.test(html)) continue

      for (const honor of ['杰青', '优青', '千青']) {
        for (const type of ['table', 'list-links', 'year-name-field', 'name-unit-lines']) {
          const rows = parseUniversityTalentPage(html, {
            type,
            honor,
            universityName: uni.name,
            url,
          })
          if (rows.length >= MIN_UNI_ROWS) {
            return {
              universityId: uni.id,
              universityName: uni.name,
              honor,
              url,
              count: rows.length,
              rows,
            }
          }
        }
      }
    } catch {
      /* skip */
    }
  }
  return null
}

async function probeUniversityLists(universities) {
  const discovered = []
  console.log(`\n探测高校人才名单页（${universities.length} 所，并发 ${UNI_PROBE_CONCURRENCY}）…`)

  for (let i = 0; i < universities.length; i += UNI_PROBE_CONCURRENCY) {
    const batch = universities.slice(i, i + UNI_PROBE_CONCURRENCY)
    const results = await Promise.all(batch.map((uni) => probeOneUniversity(uni)))
    for (const d of results) {
      if (!d) continue
      discovered.push(d)
      console.log(`  ✓ ${d.universityName} (${d.honor}): ${d.count} — ${d.url}`)
    }
  }

  if (discovered.length) {
    saveDiscoveredUniversityPages([
      ...loadDiscoveredUniversityPages(),
      ...discovered.map(({ rows, ...meta }) => meta),
    ])
  }

  return discovered
}

async function batchProbe17158Lists(universities) {
  const discovered = []
  const knownUrls = new Set(loadDiscoveredUniversityPages().map((p) => p.url))
  console.log(`\n批量探测 /17158/list.htm（${universities.length} 所，并发 ${UNI_QUICK_PROBE_CONCURRENCY}）…`)

  async function probe17158(uni) {
    const domain = getUniversityDomain(uni.id)
    const urls = [
      `http://ac.${domain}/17158/list.htm`,
      `https://ac.${domain}/17158/list.htm`,
      `https://www.${domain}/17158/list.htm`,
      `https://${domain}/17158/list.htm`,
    ]
    for (const url of urls) {
      if (knownUrls.has(url)) continue
      try {
        const html = fetchText(url, undefined, 6)
        if (html.length < 4000) continue
        for (const type of ['table', 'list-links', 'name-unit-lines']) {
          for (const honor of ['杰青', '优青']) {
            const rows = parseUniversityTalentPage(html, {
              type,
              honor,
              universityName: uni.name,
              url,
            })
            if (rows.length >= MIN_UNI_ROWS) {
              knownUrls.add(url)
              return {
                universityId: uni.id,
                universityName: uni.name,
                honor,
                url,
                count: rows.length,
                rows,
              }
            }
          }
        }
      } catch {
        /* skip */
      }
    }
    return null
  }

  for (let i = 0; i < universities.length; i += UNI_QUICK_PROBE_CONCURRENCY) {
    const batch = universities.slice(i, i + UNI_QUICK_PROBE_CONCURRENCY)
    const results = await Promise.all(batch.map((uni) => probe17158(uni)))
    for (const d of results) {
      if (!d) continue
      discovered.push(d)
      console.log(`  ✓ ${d.universityName} (${d.honor}): ${d.count} — ${d.url}`)
    }
  }

  if (discovered.length) {
    const merged = new Map(loadDiscoveredUniversityPages().map((p) => [p.url, p]))
    for (const d of discovered) merged.set(d.url, d)
    saveDiscoveredUniversityPages([...merged.values()])
  }

  return discovered
}

async function quickProbeUniversityLists(universities) {
  const discovered = []
  const knownUrls = new Set(loadDiscoveredUniversityPages().map((p) => p.url))
  console.log(`\n快速探测高校人才页（${universities.length} 所，每校前 3 URL，并发 ${UNI_QUICK_PROBE_CONCURRENCY}）…`)

  async function probeQuick(uni) {
    for (const url of buildUniversityProbeUrls(uni.id).slice(0, 5)) {
      if (knownUrls.has(url)) continue
      try {
        const html = fetchText(url, undefined, 5)
        if (html.length < 4000 || !/杰青|杰出青年|优青|优秀青年|千青|青年千人|gjjcqn|yxqn|yxqx|qqrj/i.test(html)) continue

        for (const honor of ['杰青', '优青', '千青']) {
          for (const type of ['table', 'list-links', 'year-name-field', 'name-unit-lines']) {
            const rows = parseUniversityTalentPage(html, {
              type,
              honor,
              universityName: uni.name,
              url,
            })
            if (rows.length >= MIN_UNI_ROWS) {
              knownUrls.add(url)
              return {
                universityId: uni.id,
                universityName: uni.name,
                honor,
                url,
                count: rows.length,
                rows,
              }
            }
          }
        }
      } catch {
        /* skip */
      }
    }
    return null
  }

  for (let i = 0; i < universities.length; i += UNI_QUICK_PROBE_CONCURRENCY) {
    const batch = universities.slice(i, i + UNI_QUICK_PROBE_CONCURRENCY)
    const results = await Promise.all(batch.map((uni) => probeQuick(uni)))
    for (const d of results) {
      if (!d) continue
      discovered.push(d)
      console.log(`  ✓ ${d.universityName} (${d.honor}): ${d.count} — ${d.url}`)
    }
  }

  if (discovered.length) {
    const merged = new Map(loadDiscoveredUniversityPages().map((p) => [p.url, p]))
    for (const d of discovered) merged.set(d.url, d)
    saveDiscoveredUniversityPages([...merged.values()])
  }

  return discovered
}

function normalizeDiscoveredPage(page) {
  return {
    universityId: page.universityId || page.id,
    universityName: page.universityName || page.name,
    honor: page.honor || '杰青',
    url: page.url,
    count: page.count,
  }
}

function loadDiscoveredUniversityPages() {
  if (!existsSync(DISCOVERED_PATH)) return []
  try {
    const data = JSON.parse(readFileSync(DISCOVERED_PATH, 'utf-8'))
    return (data.pages || []).map(normalizeDiscoveredPage).filter((p) => p.url)
  } catch {
    return []
  }
}

function saveDiscoveredUniversityPages(pages) {
  writeFileSync(
    DISCOVERED_PATH,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), pages: pages.map(normalizeDiscoveredPage) }, null, 2)}\n`,
    'utf-8'
  )
}

function fetchDiscoveredUniversityPages(universities) {
  const rows = []
  const uniById = new Map(universities.map((u) => [u.id, u.name]))
  const pages = loadDiscoveredUniversityPages()
  if (!pages.length) return rows

  console.log(`\n加载已探测高校名单（${pages.length} 页）…`)
  for (const page of pages) {
    const universityName = page.universityName || uniById.get(page.universityId) || page.universityId
    try {
      const html = fetchText(page.url, undefined, 12)
      const parsed = parseUniversityTalentPage(html, {
        type: 'table',
        honor: page.honor || '杰青',
        universityName,
        url: page.url,
      })
      if (parsed.length) {
        rows.push(...parsed)
        console.log(`  ✓ ${universityName} (${page.honor || '杰青'}): ${parsed.length}`)
        continue
      }
      for (const type of ['list-links', 'year-name-field', 'name-unit-lines']) {
        const alt = parseUniversityTalentPage(html, {
          type,
          honor: page.honor || '杰青',
          universityName,
          url: page.url,
        })
        if (alt.length) {
          rows.push(...alt)
          console.log(`  ✓ ${universityName} (${page.honor || '杰青'}, ${type}): ${alt.length}`)
          break
        }
      }
    } catch {
      /* skip */
    }
  }
  return rows
}

function fetchCuratedUniversityPages() {
  const rows = []
  console.log(`\n抓取精选高校名单（${CURATED_UNIVERSITY_PAGES.length} 页）…`)
  for (const page of CURATED_UNIVERSITY_PAGES) {
    try {
      const html = fetchText(page.url)
      const parsed = parseUniversityTalentPage(html, {
        ...page,
        universityName: page.universityName,
      })
      if (parsed.length) {
        rows.push(...parsed)
        console.log(`  ✓ ${page.universityName} (${page.honor}): ${parsed.length} — ${page.url}`)
      }
    } catch {
      console.log(`  ✗ ${page.universityName}: ${page.url.slice(0, 50)}…`)
    }
  }
  return rows
}

async function main() {
  console.log('正在从政府及高校公开页面抓取人才数据…\n')
  const manifest = {
    fetchedAt: new Date().toISOString(),
    sources: [],
    counts: {},
    notes: [],
  }

  // 1. 中科院院士
  const casHtml = fetchText(OFFICIAL_SOURCES.casAcademicians.url)
  let cas = parseCasAcademicians(casHtml, OFFICIAL_SOURCES.casAcademicians.url)
  manifest.sources.push(OFFICIAL_SOURCES.casAcademicians)
  console.log(`中科院院士（名单）: ${cas.length} 人`)

  for (const item of OFFICIAL_SOURCES.casElectionLists) {
    const html = fetchText(item.url)
    const rows = parseCasElectionList(html, item)
    cas = mergeAllExperts([cas, rows])
    console.log(`  CAS ${item.year} 增选: ${rows.length} 人（合并后 ${cas.length}）`)
    manifest.sources.push({
      org: '中国科学院学部',
      type: 'cas-election',
      year: item.year,
      url: item.url,
      count: rows.length,
    })
  }
  manifest.counts['yuanshi-cas'] = cas.length

  // 2. 工程院院士
  const caeHtml = fetchText(OFFICIAL_SOURCES.caeAcademicians.url)
  let cae = parseCaeAcademicians(caeHtml, OFFICIAL_SOURCES.caeAcademicians.url)
  console.log(`工程院院士（名单）: ${cae.length} 人`)

  for (const item of OFFICIAL_SOURCES.caeElectionLists) {
    const html = fetchText(item.url)
    const rows = parseCaeElectionList(html, item)
    cae = mergeAllExperts([cae, rows])
    console.log(`  CAE ${item.year} 增选: ${rows.length} 人（含单位 ${rows.filter((r) => r.university).length}）`)
    manifest.sources.push({
      org: '中国工程院',
      type: 'cae-election',
      year: item.year,
      url: item.url,
      count: rows.length,
    })
  }

  cae = await enrichCaeProfiles(cae, CAE_PROFILE_LIMIT)
  manifest.counts['yuanshi-cae'] = cae.length

  // 3. 国自然生命科学部 + 全国公示
  const nsfc = fetchNsfcDepartmentPages()
  let jieqing = nsfc.jieqing
  let youqing = nsfc.youqing

  const national = fetchNationalTalentLists()
  jieqing = mergeAllExperts([jieqing, national.filter((p) => p.honor === '杰青')])
  youqing = mergeAllExperts([youqing, national.filter((p) => p.honor === '优青')])

  manifest.sources.push({
    org: '国家自然科学基金委员会',
    url: OFFICIAL_SOURCES.nsfcLifeSciencesIndex.url,
    type: 'nsfc-dept-jieqing-youqing',
    pages: nsfc.pages.map((p) => p.url),
  })
  manifest.counts.jieqing = jieqing.length
  manifest.counts.youqing = youqing.length
  console.log(`杰青合计: ${jieqing.length} 人`)
  console.log(`优青合计: ${youqing.length} 人`)

  // 4. 高校公开名单
  const universities = JSON.parse(readFileSync(UNIVERSITIES_PATH, 'utf-8'))
  let universityTalents = fetchCuratedUniversityPages()
  universityTalents.push(...fetchDiscoveredUniversityPages(universities))

  for (const src of UNIVERSITY_TALENT_SOURCES) {
    for (const page of src.pages) {
      try {
        const html = fetchText(page.url)
        const rows = parseUniversityTalentPage(html, {
          ...page,
          universityName: src.universityName,
        })
        universityTalents.push(...rows)
        console.log(`  ${src.universityName} (${page.honor}): ${rows.length} 人`)
      } catch {
        /* skip */
      }
    }
  }

  if (UNI_QUICK_PROBE) {
    const quickDiscovered = [
      ...(await batchProbe17158Lists(universities)),
      ...(await quickProbeUniversityLists(universities)),
    ]
    const knownIds = new Set([
      ...CURATED_UNIVERSITY_PAGES.map((p) => p.universityId),
      ...UNIVERSITY_TALENT_SOURCES.map((s) => s.universityId),
    ])
    for (const d of quickDiscovered) {
      if (knownIds.has(d.universityId)) continue
      universityTalents.push(...d.rows)
      manifest.sources.push({
        org: d.universityName,
        type: 'university-quick-probed',
        honor: d.honor,
        url: d.url,
        count: d.count,
      })
    }
  }

  if (UNI_PROBE) {
    const discovered = await probeUniversityLists(universities)
    const knownIds = new Set([
      ...CURATED_UNIVERSITY_PAGES.map((p) => p.universityId),
      ...UNIVERSITY_TALENT_SOURCES.map((s) => s.universityId),
    ])
    for (const d of discovered) {
      if (knownIds.has(d.universityId)) continue
      universityTalents.push(...d.rows)
      manifest.sources.push({
        org: d.universityName,
        type: 'university-probed',
        honor: d.honor,
        url: d.url,
        count: d.count,
      })
    }
  }

  const qianqing = []
  universityTalents = mergeAllExperts([universityTalents])
  for (const p of universityTalents) {
    if (p.honor === '千青') qianqing.push(p)
  }
  jieqing = mergeAllExperts([jieqing, universityTalents.filter((p) => p.honor === '杰青')])
  youqing = mergeAllExperts([youqing, universityTalents.filter((p) => p.honor === '优青')])
  manifest.counts['university-talents'] = universityTalents.length
  manifest.counts.jieqing = jieqing.length
  manifest.counts.youqing = youqing.length
  manifest.counts.qianqing = qianqing.length
  console.log(
    `高校名单: ${universityTalents.length} 人（并入后 杰青 ${jieqing.length} / 优青 ${youqing.length} / 千青 ${qianqing.length}）`
  )

  if (!qianqing.length) {
    manifest.notes.push(
      '青年千人/海外优青：暂无全国完整公开 HTML 名单；可通过各高校人事处公示页逐校补充。'
    )
  }

  if (existsSync(OUT_DIR)) {
    for (const sub of ['biology', 'cs', 'math', 'medicine']) {
      const p = join(EXPERTS_DIR, sub)
      if (existsSync(p)) rmSync(p, { recursive: true, force: true })
    }
  } else {
    mkdirSync(OUT_DIR, { recursive: true })
  }
  mkdirSync(CRAWL_DIR, { recursive: true })

  writeJson('yuanshi-cas.json', cas)
  writeJson('yuanshi-cae.json', cae)
  writeJson('jieqing.json', jieqing)
  writeJson('youqing.json', youqing)
  writeJson('qianqing.json', qianqing)
  writeFileSync(UNIVERSITY_TALENTS_PATH, `${JSON.stringify(universityTalents, null, 2)}\n`, 'utf-8')

  const totalUnique = mergeAllExperts([cas, cae, jieqing, youqing, qianqing]).length
  manifest.counts.total = totalUnique
  manifest.counts.totalRaw = cas.length + cae.length + jieqing.length + youqing.length
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8')

  console.log(`\n完成，去重后 ${totalUnique} 人`)
  console.log(`  荣誉汇总: data/experts/by-honor/`)
  console.log(`  抓取元数据: data/crawl/manifest.json`)

  const { spawnSync } = await import('child_process')
  const split = spawnSync('node', ['scripts/split-experts-by-org.mjs'], {
    cwd: ROOT,
    stdio: 'inherit',
  })
  if (split.status !== 0) process.exit(split.status ?? 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
